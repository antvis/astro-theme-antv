export const updatesUrl = 'https://assets.antv.antgroup.com/antv/banner-messages.json';

export type Locale = 'zh' | 'en';
export interface UpdateMessage {
  title: string;
  description: string;
  image?: string;
  href: string;
}

function localized(value: unknown, locale: Locale): string {
  if (!value || typeof value !== 'object') return '';
  const text = value as Record<string, unknown>;
  for (const language of [locale, locale === 'zh' ? 'en' : 'zh']) {
    if (typeof text[language] === 'string' && text[language].trim()) return text[language].trim();
  }
  return '';
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* Invalid remote fields are not rendered as URLs. */ }
  return undefined;
}

export function parseUpdates(data: unknown, locale: Locale): UpdateMessage[] {
  if (!Array.isArray(data)) throw new Error('Invalid updates response');
  const messages: UpdateMessage[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const title = localized(item.title, locale);
    const href = httpUrl(item.link);
    if (!title || !href) continue;
    messages.push({ title, href, description: localized(item.subTitle, locale), image: httpUrl(item.img) });
  }
  if (data.length && !messages.length) throw new Error('No valid updates in response');
  return messages;
}

export async function loadUpdates(locale: Locale, signal: AbortSignal): Promise<UpdateMessage[]> {
  const response = await fetch(updatesUrl, { signal });
  if (!response.ok) throw new Error(`Updates request failed: ${response.status}`);
  return parseUpdates(await response.json(), locale);
}
