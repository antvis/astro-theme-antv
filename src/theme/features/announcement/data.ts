export const announcementUrl = 'https://assets.antv.antgroup.com/antv/announcement.json';

type Locale = 'zh' | 'en';
export interface AnnouncementMessage {
  title: string;
  link?: { text: string; href: string };
}

function localized(value: unknown, locale: Locale): string {
  if (!value || typeof value !== 'object') return '';
  const text = value as Record<string, unknown>;
  for (const language of [locale, locale === 'zh' ? 'en' : 'zh']) {
    if (typeof text[language] === 'string' && text[language].trim()) return text[language].trim();
  }
  return '';
}

export function parseAnnouncement(data: unknown, locale: Locale): AnnouncementMessage | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  const title = localized(value.title, locale);
  if (!title) return null;
  const message: AnnouncementMessage = { title };
  if (value.link && typeof value.link === 'object') {
    const link = value.link as Record<string, unknown>;
    const text = localized(link.text, locale);
    if (text && typeof link.href === 'string') {
      try {
        const url = new URL(link.href);
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          message.link = { text, href: url.href };
        }
      } catch { /* Invalid links do not prevent the announcement text from displaying. */ }
    }
  }
  return message;
}

export async function loadAnnouncement(locale: Locale, signal: AbortSignal): Promise<AnnouncementMessage | null> {
  const response = await fetch(announcementUrl, { signal });
  if (!response.ok) throw new Error(`Announcement request failed: ${response.status}`);
  return parseAnnouncement(await response.json(), locale);
}
