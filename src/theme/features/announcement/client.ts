import { loadAnnouncement } from './data';

export class AntvAnnouncement extends HTMLElement {
  private request?: AbortController;

  private get storageKey() {
    return `antv:announcement:dismissed:${this.dataset.site || '/'}`;
  }

  private isDismissed() {
    try {
      return localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }

  connectedCallback() {
    this.hidden = true;
    this.querySelector('[data-announcement-close]')?.addEventListener('click', this.dismiss);
    window.addEventListener('storage', this.onStorage);
    if (!this.isDismissed()) void this.load();
  }

  disconnectedCallback() {
    this.request?.abort();
    this.querySelector('[data-announcement-close]')?.removeEventListener('click', this.dismiss);
    window.removeEventListener('storage', this.onStorage);
  }

  private dismiss = () => {
    this.hidden = true;
    this.request?.abort();
    try {
      localStorage.setItem(this.storageKey, 'true');
    } catch { /* Closing still works when browser storage is unavailable. */ }
  };

  private onStorage = (event: StorageEvent) => {
    if (event.key === this.storageKey && event.newValue === 'true') {
      this.hidden = true;
      this.request?.abort();
    }
  };

  private async load() {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    const timeout = window.setTimeout(() => request.abort(), 10000);
    try {
      const message = await loadAnnouncement(this.dataset.locale === 'en' ? 'en' : 'zh', request.signal);
      if (!message || !this.isConnected || request.signal.aborted || this.isDismissed()) return;
      this.querySelector('[data-announcement-title]')!.textContent = message.title;
      const link = this.querySelector<HTMLAnchorElement>('[data-announcement-link]')!;
      link.hidden = !message.link;
      if (message.link) {
        link.textContent = `${message.link.text} →`;
        link.href = message.link.href;
      }
      this.hidden = false;
    } catch { /* An unavailable announcement must not interrupt the site. */ }
    finally {
      window.clearTimeout(timeout);
    }
  }
}
