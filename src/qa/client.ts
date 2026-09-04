import { qaProducts, type QaProduct } from '../qa.js';

interface QaAccessErrors {
  blocked: string;
  closed: string;
  request: string;
  timeout: string;
}

interface QaSessionRequest {
  context?: QaContext;
  errors: QaAccessErrors;
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
const QA_REQUEST_TIMEOUT_MS = 30 * 1000;
const QA_TOKEN_STORAGE_PREFIX = 'sive.qa.access-token:';
const qaAccessTokens = new Map<string, StoredQaAccessToken>();
const qaAccessTokenRequests = new Map<string, Promise<string>>();

export interface QaContext {
  locale: 'zh-CN' | 'en-US';
  product: QaProduct;
  version?: string;
}

const qaProductSet = new Set<QaProduct>(qaProducts);

interface QaReadRequest {
  errors: QaAccessErrors;
  serviceBaseUrl: string;
}

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

export function requestQaSessionDetail({
  errors,
  serviceBaseUrl,
  sessionId,
}: QaReadRequest & { sessionId: string }): Promise<Response> {
  const url = new URL('/integrations/qa/session', serviceBaseUrl);
  url.searchParams.set('id', sessionId);
  return fetchWithAccessToken(
    { errors, serviceBaseUrl },
    url,
    { headers: { Accept: 'application/json' } },
  );
}

export function requestQaSessionHistory({
  errors,
  serviceBaseUrl,
}: QaReadRequest): Promise<Response> {
  return fetchWithAccessToken(
    { errors, serviceBaseUrl },
    new URL('/integrations/qa/sessions', serviceBaseUrl),
    { headers: { Accept: 'application/json' } },
  );
}

export function requestQaSessionStream({
  errors,
  serviceBaseUrl,
  sessionId,
  signal,
}: QaReadRequest & { sessionId: string; signal: AbortSignal }): Promise<Response> {
  const url = new URL('/integrations/qa/session/stream', serviceBaseUrl);
  url.searchParams.set('id', sessionId);
  return fetchWithAccessToken(
    { errors, serviceBaseUrl },
    url,
    { headers: { Accept: 'text/event-stream' }, signal },
    false,
  );
}

async function submitWithAccessToken(
  request: QaSessionRequest & { serviceOrigin: string },
): Promise<string> {
  return submitQaSession(request);
}

async function fetchWithAccessToken(
  request: QaReadRequest,
  url: URL,
  init: RequestInit,
  withTimeout = true,
): Promise<Response> {
  const serviceOrigin = new URL(request.serviceBaseUrl).origin;
  let accessToken = getQaAccessToken(serviceOrigin);
  if (!accessToken) {
    accessToken = await getOrRequestQaAccessToken({ ...request, serviceOrigin });
  }

  const send = (token: string) =>
    fetchQaRequest(url, init, token, request.errors.request, withTimeout);
  let response = await send(accessToken);
  if (response.status !== 401 && response.status !== 403) return response;

  clearQaAccessToken(serviceOrigin);
  accessToken = await getOrRequestQaAccessToken({ ...request, serviceOrigin });
  response = await send(accessToken);
  return response;
}

async function fetchQaRequest(
  url: URL,
  init: RequestInit,
  accessToken: string,
  requestError: string,
  withTimeout: boolean,
): Promise<Response> {
  const controller = withTimeout ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), QA_REQUEST_TIMEOUT_MS)
    : 0;
  try {
    return await fetch(url, {
      ...init,
      credentials: 'omit',
      headers: {
        ...Object.fromEntries(new Headers(init.headers).entries()),
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller?.signal ?? init.signal,
    });
  } catch (error) {
    if (!withTimeout && error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new Error(requestError);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

function getOrRequestQaAccessToken(
  request: Pick<QaSessionRequest, 'errors' | 'serviceBaseUrl'> & {
    serviceOrigin: string;
  },
): Promise<string> {
  const existing = qaAccessTokenRequests.get(request.serviceOrigin);
  if (existing) return existing;

  const pending = requestQaAccessToken(request).finally(() => {
    if (qaAccessTokenRequests.get(request.serviceOrigin) === pending) {
      qaAccessTokenRequests.delete(request.serviceOrigin);
    }
  });
  qaAccessTokenRequests.set(request.serviceOrigin, pending);
  return pending;
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
        !Number.isFinite(data.expiresIn) ||
        data.expiresIn <= 0 ||
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
  context,
  errors,
  message,
  serviceBaseUrl,
  sessionId,
}: QaSessionRequest & { serviceOrigin: string }): Promise<string> {
  let response: Response;
  let payload: QaSubmitResponse;
  try {
    response = await fetchWithAccessToken(
      { errors, serviceBaseUrl },
      new URL('/integrations/qa/session', serviceBaseUrl),
      {
        body: JSON.stringify({
          ...(context ? { context } : {}),
          input: message,
          ...(sessionId ? { sessionId } : {}),
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    payload = (await response.json()) as QaSubmitResponse;
  } catch (error) {
    throw error instanceof Error ? error : new Error(errors.request);
  }

  const nextSessionId = payload.data?.session;
  if (!response.ok || typeof nextSessionId !== 'string') {
    throw new Error(payload.error || errors.request);
  }

  return nextSessionId;
}
