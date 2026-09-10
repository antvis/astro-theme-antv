import { mountCarousel } from './carousel';

export class AntvCarousel extends HTMLElement {
  static observedAttributes = ['disabled'];
  private dispose?: () => void;
  private observer?: MutationObserver;
  private pending = false;

  connectedCallback() {
    const track = this.querySelector('[data-antv-track]');
    if (!track) return;
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(track, { childList: true });
    this.refresh();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.dispose?.();
    this.dispose = undefined;
  }

  attributeChangedCallback() { this.refresh(); }

  private refresh() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      if (!this.isConnected) return;
      this.dispose?.();
      this.dispose = undefined;
      const track = this.querySelector<HTMLElement>('[data-antv-track]');
      const pagination = this.querySelector<HTMLElement>('[data-antv-pagination]');
      if (!track || !pagination) return;
      pagination.replaceChildren();
      pagination.hidden = true;
      const disabled = this.hasAttribute('disabled');
      track.tabIndex = disabled ? -1 : 0;
      if (!disabled) this.dispose = mountCarousel(this);
    });
  }
}
