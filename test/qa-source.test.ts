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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('QA authenticated reads', () => {
  it('uses the Sive cookie for detail, history, and SSE', async () => {
    const serviceBaseUrl = 'https://sive.example';
    vi.stubGlobal('window', {
      clearTimeout,
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
      expect(init?.credentials).toBe('include');
      expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    }
    expect(fetchMock.mock.calls[2]?.[1]?.signal).toBe(controller.signal);
  });

  it('retries with the Sive cookie after popup authentication', async () => {
    const serviceBaseUrl = 'https://sive.example';
    const popup = { closed: false, focus: vi.fn() };
    let handleMessage: ((event: MessageEvent<unknown>) => void) | undefined;
    const open = vi.fn(() => popup);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(
        (type: string, listener: (event: MessageEvent<unknown>) => void) => {
          if (type === 'message') handleMessage = listener;
        },
      ),
      clearInterval: vi.fn(),
      clearTimeout,
      location: { origin: 'https://g2.antgroup.com' },
      open,
      outerHeight: 800,
      outerWidth: 1200,
      removeEventListener: vi.fn(),
      screenX: 0,
      screenY: 0,
      setInterval: vi.fn(() => 1),
      setTimeout,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    const detail = requestQaSessionDetail({
      errors,
      serviceBaseUrl,
      sessionId: 'session-1',
    });
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
    handleMessage?.({
      data: { type: 'sive.qa.auth.ready' },
      origin: serviceBaseUrl,
      source: popup,
    } as unknown as MessageEvent<unknown>);

    await expect(detail).resolves.toBeInstanceOf(Response);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe('include');
      expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    }
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
