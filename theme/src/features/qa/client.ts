import { qaProducts, type QaProduct } from '../../../../dist/qa';

interface QaSessionRequest {
  context?: QaContext;
  errors: {
    blocked: string;
    closed: string;
    request: string;
    timeout: string;
  };
  message: string;
  serviceBaseUrl: string;
  sessionId?: string;
}

interface QaReadyMessage {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  type: 'sive.qa.auth.ready';
}

interface QaSubmitResponse {
  data?: {
    session?: string;
  };
  error?: string;
}

interface StoredQaAccessToken {
  accessToken: string;
  expiresAt: number;
}

const QA_WINDOW_NAME = 'antv-qa-auth';
const QA_WINDOW_TIMEOUT_MS = 5 * 60 * 1000;
const QA_TOKEN_STORAGE_PREFIX = 'sive.qa.access-token:';
const qaAccessTokens = new Map<string, StoredQaAccessToken>();

export interface QaContext {
  locale: 'zh-CN' | 'en-US';
  product: QaProduct;
  version?: string;
}

const qaProductSet = new Set<QaProduct>(qaProducts);

export function toQaProduct(value: string): QaProduct | null {
  const product = value.trim().toLowerCase() as QaProduct;
  return qaProductSet.has(product) ? product : null;
}

export function requestQaSession({
  context,
  errors,
  message,
  serviceBaseUrl,
  sessionId,
}: QaSessionRequest): Promise<string> {
  const serviceOrigin = new URL(serviceBaseUrl).origin;
  return submitWithAccessToken({
    context,
    errors,
    message,
    serviceBaseUrl,
    serviceOrigin,
    sessionId,
  });
}

async function submitWithAccessToken(
  request: QaSessionRequest & { serviceOrigin: string },
): Promise<string> {
  let accessToken = getQaAccessToken(request.serviceOrigin);
  if (!accessToken) {
    accessToken = await requestQaAccessToken(request);
  }

  try {
    return await submitQaSession({ ...request, accessToken });
  } catch (error) {
    if (!(error instanceof QaAuthorizationError)) throw error;
    clearQaAccessToken(request.serviceOrigin);
    accessToken = await requestQaAccessToken(request);
    return submitQaSession({ ...request, accessToken });
  }
}

function requestQaAccessToken({
  errors,
  serviceBaseUrl,
  serviceOrigin,
}: Pick<QaSessionRequest, 'errors' | 'serviceBaseUrl'> & {
  serviceOrigin: string;
}): Promise<string> {
  const bridgeUrl = new URL('/integrations/qa/auth', serviceBaseUrl);
  bridgeUrl.searchParams.set('origin', window.location.origin);

  const width = 480;
  const height = 660;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    bridgeUrl.toString(),
    QA_WINDOW_NAME,
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`,
  );

  if (!popup) {
    return Promise.reject(new Error(errors.blocked));
  }

  popup.focus();

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(errors.timeout));
    }, QA_WINDOW_TIMEOUT_MS);
    const closedTimer = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error(errors.closed));
    }, 300);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(closedTimer);
      window.removeEventListener('message', handleMessage);
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== serviceOrigin || event.source !== popup) return;
      const data = event.data as Partial<QaReadyMessage> | null;
      if (
        data?.type !== 'sive.qa.auth.ready' ||
        typeof data.accessToken !== 'string' ||
        typeof data.expiresIn !== 'number' ||
        data.tokenType !== 'Bearer'
      )
        return;

      cleanup();
      saveQaAccessToken(serviceOrigin, data.accessToken, data.expiresIn);
      resolve(data.accessToken);
    };

    window.addEventListener('message', handleMessage);
  });
}

function getQaAccessToken(serviceOrigin: string): string | null {
  const cached =
    qaAccessTokens.get(serviceOrigin) ?? readStoredQaAccessToken(serviceOrigin);
  if (!cached || cached.expiresAt <= Date.now() + 30_000) {
    clearQaAccessToken(serviceOrigin);
    return null;
  }
  qaAccessTokens.set(serviceOrigin, cached);
  return cached.accessToken;
}

function readStoredQaAccessToken(
  serviceOrigin: string,
): StoredQaAccessToken | null {
  try {
    const value = window.sessionStorage.getItem(
      `${QA_TOKEN_STORAGE_PREFIX}${serviceOrigin}`,
    );
    if (!value) return null;
    const token = JSON.parse(value) as Partial<StoredQaAccessToken>;
    return typeof token.accessToken === 'string' &&
      typeof token.expiresAt === 'number'
      ? { accessToken: token.accessToken, expiresAt: token.expiresAt }
      : null;
  } catch {
    return null;
  }
}

function saveQaAccessToken(
  serviceOrigin: string,
  accessToken: string,
  expiresIn: number,
): void {
  const token = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  qaAccessTokens.set(serviceOrigin, token);
  try {
    window.sessionStorage.setItem(
      `${QA_TOKEN_STORAGE_PREFIX}${serviceOrigin}`,
      JSON.stringify(token),
    );
  } catch {
    // The in-memory token still avoids repeated popups in this page.
  }
}

function clearQaAccessToken(serviceOrigin: string): void {
  qaAccessTokens.delete(serviceOrigin);
  try {
    window.sessionStorage.removeItem(
      `${QA_TOKEN_STORAGE_PREFIX}${serviceOrigin}`,
    );
  } catch {
    // Ignore unavailable storage.
  }
}

async function submitQaSession({
  accessToken,
  context,
  errors,
  message,
  serviceBaseUrl,
  sessionId,
}: QaSessionRequest & {
  accessToken: string;
  serviceOrigin: string;
}): Promise<string> {
  let response: Response;
  try {
    response = await fetch(
      new URL('/integrations/qa/session', serviceBaseUrl),
      {
        body: JSON.stringify({
          ...(context ? { context } : {}),
          input: message,
          ...(sessionId ? { sessionId } : {}),
        }),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  } catch {
    throw new Error(errors.request);
  }

  let payload: QaSubmitResponse;
  try {
    payload = (await response.json()) as QaSubmitResponse;
  } catch {
    throw new Error(errors.request);
  }

  const nextSessionId = payload.data?.session;
  if (!response.ok || typeof nextSessionId !== 'string') {
    if (response.status === 401 || response.status === 403) {
      throw new QaAuthorizationError(payload.error || errors.request);
    }
    throw new Error(payload.error || errors.request);
  }

  return nextSessionId;
}

class QaAuthorizationError extends Error {}
