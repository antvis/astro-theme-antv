import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadUpdates, parseUpdates, updatesUrl } from '../src/theme/features/updates/data';

const message = {
  title: { zh: '最新动态', en: 'Updates' },
  subTitle: { zh: '内容', en: 'Content' },
  img: 'https://example.com/icon.png',
  link: 'https://example.com/news',
};

afterEach(() => vi.unstubAllGlobals());

describe('shared remote updates', () => {
  it('uses remote fields and the requested locale', () => {
    expect(parseUpdates([message], 'en')).toEqual([{
      title: 'Updates', description: 'Content', image: message.img, href: message.link,
    }]);
  });

  it('falls back only when localized content is missing', () => {
    expect(parseUpdates([{ ...message, title: { zh: '中文', en: ' ' }, subTitle: null }], 'en')[0])
      .toMatchObject({ title: '中文', description: '' });
  });

  it('skips invalid entries and rejects unsafe image/link protocols', () => {
    const items = parseUpdates([null, {}, { ...message, link: 'javascript:alert(1)' },
      { ...message, img: 'data:image/svg+xml,unsafe' }], 'zh');
    expect(items).toHaveLength(1);
    expect(items[0].image).toBeUndefined();
  });

  it('distinguishes an empty feed from a malformed response', () => {
    expect(parseUpdates([], 'zh')).toEqual([]);
    expect(() => parseUpdates({}, 'zh')).toThrow();
    expect(() => parseUpdates([{}], 'zh')).toThrow();
  });

  it('passes cancellation through and fetches the shared endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [message] });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    expect(await loadUpdates('en', signal)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(updatesUrl, { signal });
  });

  it('reports HTTP errors instead of treating them as empty content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(loadUpdates('zh', new AbortController().signal)).rejects.toThrow('503');
  });
});
