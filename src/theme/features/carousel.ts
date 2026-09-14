import '../styles/carousel.css';

export function mountCarousel(carousel: HTMLElement): () => void {
  const track = carousel.querySelector('[data-antv-track]');
  const pagination = carousel.querySelector('[data-antv-pagination]');
  if (!(track instanceof HTMLElement) || !(pagination instanceof HTMLElement)) return () => {};
  const cards = [...track.children].filter((card): card is HTMLElement => card instanceof HTMLElement);
  if (!cards.length) return () => {};

  const listeners = new AbortController();
  const eventOptions = { signal: listeners.signal };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pageLabel = carousel.getAttribute('data-page-label') || 'View group {page}';
  let activePage = 0;
  let autoTimer: number | undefined;
  let scrollTimer: number | undefined;
  let userPaused = false;
  let isHovered = carousel.matches(':hover');
  let isFocused = carousel.matches(':focus-within');
  let isVisible = !('IntersectionObserver' in window);
  let destinations = [0];

  const canScroll = () => destinations.length > 1;
  const clearAuto = () => {
    if (autoTimer) window.clearInterval(autoTimer);
    autoTimer = undefined;
  };
  const updatePagination = () => {
    pagination.querySelectorAll('button').forEach((button, index) => {
      const active = index === activePage;
      button.disabled = !canScroll();
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  };
  const goTo = (page: number, behavior: ScrollBehavior = 'smooth') => {
    if (!canScroll()) return;
    activePage = Math.max(0, Math.min(page, destinations.length - 1));
    track.scrollTo({
      left: destinations[activePage],
      behavior: reducedMotion.matches ? 'auto' : behavior,
    });
    updatePagination();
  };
  const startAuto = () => {
    clearAuto();
    if (reducedMotion.matches || userPaused || isHovered || isFocused || !isVisible || !canScroll() || document.hidden) return;
    autoTimer = window.setInterval(() => goTo((activePage + 1) % destinations.length), 5200);
  };
  const renderPagination = () => {
    const count = canScroll() ? destinations.length : 0;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'antv-carousel-dot';
      button.setAttribute('aria-label', pageLabel.replace('{page}', String(index + 1)));
      button.addEventListener('click', () => {
        if (!canScroll()) return;
        userPaused = true;
        clearAuto();
        goTo(index);
      });
      fragment.append(button);
    }
    pagination.replaceChildren(fragment);
    pagination.hidden = count <= 1;
    updatePagination();
  };
  const syncPagination = () => {
    activePage = destinations.reduce((nearest, position, index) =>
      Math.abs(position - track.scrollLeft) < Math.abs(destinations[nearest] - track.scrollLeft) ? index : nearest, 0);
    updatePagination();
  };
  const rebuild = () => {
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const origin = cards[0].offsetLeft;
    destinations = [0];
    if (maxScroll > 1) {
      cards.forEach((card) => {
        const position = Math.min(Math.max(0, card.offsetLeft - origin), maxScroll);
        if (position - destinations[destinations.length - 1] > 1) destinations.push(position);
      });
    }
    renderPagination();
    syncPagination();
    startAuto();
  };

  track.addEventListener('scroll', () => {
    if (scrollTimer) window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(syncPagination, 80);
  }, { passive: true, ...eventOptions });
  carousel.addEventListener('pointerenter', () => { isHovered = true; clearAuto(); }, eventOptions);
  carousel.addEventListener('pointerleave', () => { isHovered = false; startAuto(); }, eventOptions);
  carousel.addEventListener('focusin', () => { isFocused = true; clearAuto(); }, eventOptions);
  carousel.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && carousel.contains(event.relatedTarget)) return;
    isFocused = false;
    startAuto();
  }, eventOptions);
  carousel.addEventListener('touchstart', () => {
    userPaused = true;
    clearAuto();
  }, { passive: true, ...eventOptions });
  reducedMotion.addEventListener('change', startAuto, eventOptions);
  const resizeObserver = new ResizeObserver(rebuild);
  resizeObserver.observe(track);
  document.addEventListener('visibilitychange', startAuto, eventOptions);

  let carouselObserver: IntersectionObserver | undefined;
  if ('IntersectionObserver' in window) {
    carouselObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) startAuto();
      else clearAuto();
    }, { threshold: 0.2 });
    carouselObserver.observe(carousel);
  }
  rebuild();
  return () => {
    listeners.abort();
    clearAuto();
    window.clearTimeout(scrollTimer);
    resizeObserver.disconnect();
    carouselObserver?.disconnect();
  };
}
