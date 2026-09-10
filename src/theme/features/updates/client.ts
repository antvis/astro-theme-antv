import { loadUpdates } from './data';

export class AntvUpdates extends HTMLElement {
  private request?: AbortController;

  connectedCallback() {
    this.querySelector('[data-updates-retry]')?.addEventListener('click', this.reload);
    void this.load();
  }

  disconnectedCallback() {
    this.request?.abort();
    this.querySelector('[data-updates-retry]')?.removeEventListener('click', this.reload);
  }

  private reload = () => { void this.load(); };

  private async load() {
    this.request?.abort();
    const carousel = this.querySelector('antv-carousel')!;
    carousel.setAttribute('disabled', '');
    const request = new AbortController();
    this.request = request;
    const track = this.querySelector<HTMLElement>('[data-antv-track]')!;
    const pagination = this.querySelector<HTMLElement>('[data-antv-pagination]')!;
    const status = this.querySelector<HTMLElement>('[data-updates-status]')!;
    const retry = this.querySelector<HTMLButtonElement>('[data-updates-retry]')!;
    const skeleton = this.querySelector<HTMLTemplateElement>('[data-updates-skeleton]')!;
    const template = this.querySelector<HTMLTemplateElement>('[data-updates-card]')!;
    this.dataset.state = 'loading';
    this.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    status.textContent = this.dataset.loading!;
    track.hidden = false;
    track.tabIndex = -1;
    track.replaceChildren(skeleton.content.cloneNode(true));
    pagination.hidden = true;
    const timeout = window.setTimeout(() => request.abort(), 10000);
    try {
      const messages = await loadUpdates(this.dataset.locale === 'en' ? 'en' : 'zh', request.signal);
      if (!this.isConnected || this.request !== request) return;
      const fragment = document.createDocumentFragment();
      for (const message of messages) {
        const card = template.content.firstElementChild!.cloneNode(true) as HTMLAnchorElement;
        card.href = message.href;
        card.querySelector('strong')!.textContent = message.title;
        card.querySelector('[data-update-description]')!.textContent = message.description;
        const image = card.querySelector('img')!;
        if (message.image) {
          image.src = message.image;
          image.addEventListener('error', () => { image.hidden = true; }, { once: true });
        } else image.remove();
        fragment.append(card);
      }
      track.replaceChildren(fragment);
      track.hidden = !messages.length;
      track.tabIndex = 0;
      this.dataset.state = messages.length ? 'ready' : 'empty';
      status.textContent = messages.length ? '' : this.dataset.empty!;
      if (messages.length) carousel.removeAttribute('disabled');
    } catch {
      if (!this.isConnected || this.request !== request) return;
      this.dataset.state = 'error';
      track.hidden = true;
      status.textContent = this.dataset.error!;
      retry.hidden = false;
    } finally {
      window.clearTimeout(timeout);
      if (this.request === request) this.setAttribute('aria-busy', 'false');
    }
  }
}
