import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createX6PreviewAdapter } from '../src/qa-adapters/x6.js';
import {
  requestQaSessionDetail,
  requestQaSessionHistory,
  requestQaSessionStream,
} from '../src/qa/client.js';

const errors = {
  blocked: 'blocked',
  closed: 'closed',
  request: 'request failed',
  timeout: 'timeout',
};

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('QA authenticated reads', () => {
  it('uses the cached bearer token for detail, history, and SSE', async () => {
    const serviceBaseUrl = 'https://sive.example';
    const sessionStorage = createStorage();
    sessionStorage.setItem(
      `sive.qa.access-token:${serviceBaseUrl}`,
      JSON.stringify({ accessToken: 'short-lived-token', expiresAt: Date.now() + 60_000 }),
    );
    vi.stubGlobal('window', {
      clearTimeout,
      sessionStorage,
      setTimeout,
    });
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await requestQaSessionDetail({ errors, serviceBaseUrl, sessionId: 'session-1' });
    await requestQaSessionHistory({ errors, serviceBaseUrl });
    const controller = new AbortController();
    await requestQaSessionStream({
      errors,
      serviceBaseUrl,
      sessionId: 'session-1',
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://sive.example/integrations/qa/session?id=session-1',
      'https://sive.example/integrations/qa/sessions',
      'https://sive.example/integrations/qa/session/stream?id=session-1',
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer short-lived-token');
    }
    expect(fetchMock.mock.calls[2]?.[1]?.signal).toBe(controller.signal);
  });

  it('keeps the result URL free of the original question and stack', async () => {
    const entrySource = await readFile(
      resolve(process.cwd(), 'src/theme/features/qa/entry.ts'),
      'utf8',
    );
    const resultSource = await readFile(
      resolve(process.cwd(), 'src/theme/features/qa/result.ts'),
      'utf8',
    );

    expect(entrySource).not.toContain("searchParams.set('q'");
    expect(entrySource).not.toContain("searchParams.set('stack'");
    expect(resultSource).not.toContain("params.get('q'");
    expect(resultSource).not.toContain("params.get('stack'");
  });
});

describe('X6 QA preview adapter', () => {
  it('renders only declarative JSON through Graph.fromJSON', async () => {
    const fromJSON = vi.fn();
    class Graph {
      destroy = vi.fn();
      fromJSON = fromJSON;
      constructor(readonly options: Record<string, unknown>) {}
    }
    const adapter = createX6PreviewAdapter(async () => ({ Graph }));
    const preview = adapter.parse({
      data: {
        edges: [{ source: 'a', target: { cell: 'b', port: 'input' } }],
        nodes: [{ id: 'a' }, { id: 'b' }],
      },
      library: 'x6',
      options: { grid: true },
    });

    expect(preview).toBeTruthy();
    await adapter.render({ clientWidth: 640 }, preview!);
    expect(fromJSON).toHaveBeenCalledWith(preview?.data);
  });

  it('rejects executable or malformed payloads', () => {
    const adapter = createX6PreviewAdapter(async () => ({ Graph: class {} as never }));
    expect(
      adapter.parse({
        data: { edges: [], nodes: [{ id: 'a', handler: () => undefined }] },
        library: 'x6',
        options: {},
      }),
    ).toBeNull();
    expect(
      adapter.parse({
        data: { edges: [{ source: 'a', target: {} }], nodes: [{ id: 'a' }] },
        library: 'x6',
        options: {},
      }),
    ).toBeNull();
  });
});
