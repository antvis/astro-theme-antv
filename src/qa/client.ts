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
  type: 'sive.qa.auth.ready';
}

interface QaSubmitResponse {
  data?: {
    session?: string;
  };
  error?: string;
}

const QA_WINDOW_NAME = 'antv-qa-auth';
const QA_WINDOW_TIMEOUT_MS = 5 * 60 * 1000;
const QA_REQUEST_TIMEOUT_MS = 30 * 1000;
const qaAuthenticationRequests = new Map<string, Promise<void>>();

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
  return submitQaSession({ context, errors, message, serviceBaseUrl, sessionId });
}

export function requestQaSessionDetail({
  errors,
  serviceBaseUrl,
  sessionId,
}: QaReadRequest & { sessionId: string }): Promise<Response> {
  const url = new URL('/integrations/qa/session', serviceBaseUrl);
  url.searchParams.set('id', sessionId);
  return fetchWithSiveCookie(
    { errors, serviceBaseUrl },
    url,
    { headers: { Accept: 'application/json' } },
  );
}

export function requestQaSessionHistory({
  errors,
  serviceBaseUrl,
}: QaReadRequest): Promise<Response> {
  return fetchWithSiveCookie(
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
  return fetchWithSiveCookie(
    { errors, serviceBaseUrl },
    url,
    { headers: { Accept: 'text/event-stream' }, signal },
    false,
  );
}

async function fetchWithSiveCookie(
  request: QaReadRequest,
  url: URL,
  init: RequestInit,
  withTimeout = true,
): Promise<Response> {
  const serviceOrigin = new URL(request.serviceBaseUrl).origin;
  const send = () =>
    fetchQaRequest(url, init, request.errors.request, withTimeout);
  let response = await send();
  if (response.status !== 401 && response.status !== 403) return response;

  await getOrRequestQaAuthentication({ ...request, serviceOrigin });
  response = await send();
  return response;
}

async function fetchQaRequest(
  url: URL,
  init: RequestInit,
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
      credentials: 'include',
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

function getOrRequestQaAuthentication(
  request: Pick<QaSessionRequest, 'errors' | 'serviceBaseUrl'> & {
    serviceOrigin: string;
  },
): Promise<void> {
  const existing = qaAuthenticationRequests.get(request.serviceOrigin);
  if (existing) return existing;

  const pending = requestQaAuthentication(request).finally(() => {
    if (qaAuthenticationRequests.get(request.serviceOrigin) === pending) {
      qaAuthenticationRequests.delete(request.serviceOrigin);
    }
  });
  qaAuthenticationRequests.set(request.serviceOrigin, pending);
  return pending;
}

function requestQaAuthentication({
  errors,
  serviceBaseUrl,
  serviceOrigin,
}: Pick<QaSessionRequest, 'errors' | 'serviceBaseUrl'> & {
  serviceOrigin: string;
}): Promise<void> {
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
      if (data?.type !== 'sive.qa.auth.ready') return;

      cleanup();
      resolve();
    };

    window.addEventListener('message', handleMessage);
  });
}

async function submitQaSession({
  context,
  errors,
  message,
  serviceBaseUrl,
  sessionId,
}: QaSessionRequest): Promise<string> {
  let response: Response;
  let payload: QaSubmitResponse;
  try {
    response = await fetchWithSiveCookie(
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
