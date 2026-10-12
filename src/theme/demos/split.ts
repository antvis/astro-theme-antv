import Split from 'split.js';

/** Enhance the existing gallery panes without replacing their iframe or editor. */
export function createDemoSplit(root: HTMLElement, onResizeEnd: () => void) {
  const canvas = root.querySelector<HTMLElement>('[data-demo-canvas]')!;
  const panel = root.querySelector<HTMLElement>('[data-demo-panel]')!;
  const divider = root.querySelector<HTMLElement>('[data-demo-divider]')!;
  const desktop = matchMedia('(width > 1080px)');
  const gutterSize = 1;
  const minSize = 280;
  let sizes = [60, 40];
  let split: Split.Instance | undefined;

  const minimumPercent = () => Math.min(50, (minSize + gutterSize / 2) / root.clientWidth * 100);
  const updateAria = () => {
    const minimum = minimumPercent();
    divider.setAttribute('aria-valuemin', String(Math.floor(minimum)));
    divider.setAttribute('aria-valuemax', String(Math.ceil(100 - minimum)));
    divider.setAttribute('aria-valuenow', String(Math.round(sizes[0]!)));
  };
  const endDrag = (next: number[]) => {
    sizes = next;
    delete root.dataset.resizing;
    updateAria();
    onResizeEnd();
  };
  const stopDrag = () => {
    // Split.js has no cancel API and destroy() does not release an active drag.
    if (root.hasAttribute('data-resizing')) window.dispatchEvent(new MouseEvent('mouseup'));
  };
  const destroy = () => {
    if (!split) return;
    stopDrag();
    sizes = split.getSizes();
    // Keep the server-rendered divider for the next desktop layout.
    split.destroy(false, true);
    split = undefined;
    divider.hidden = true;
    delete root.dataset.resizing;
  };
  const syncLayout = () => {
    if (!desktop.matches) {
      destroy();
      onResizeEnd();
      return;
    }
    if (split) return;
    divider.hidden = false;
    split = Split([canvas, panel], {
      sizes,
      minSize,
      gutterSize,
      snapOffset: 0,
      expandToMin: true,
      gutter: () => divider,
      // Theme utilities are important; a flex basis leaves fallback widths intact.
      elementStyle: (_dimension, size, gutter) => ({ flexBasis: `calc(${size}% - ${gutter}px)` }),
      onDragStart: () => { root.dataset.resizing = ''; },
      onDrag: (next) => { sizes = next; updateAria(); },
      onDragEnd: endDrag,
    });
    sizes = split.getSizes();
    updateAria();
    onResizeEnd();
  };
  const setSize = (percent: number) => {
    if (!split) return;
    const minimum = minimumPercent();
    const size = Math.max(minimum, Math.min(100 - minimum, percent));
    sizes = [size, 100 - size];
    split.setSizes(sizes);
    updateAria();
    onResizeEnd();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!split || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const step = (event.shiftKey ? 50 : 10) / root.clientWidth * 100;
    setSize(event.key === 'Home' ? 0 : event.key === 'End' ? 100
      : sizes[0]! + (event.key === 'ArrowRight' ? step : -step));
  };
  // Split.js clamps drags, but percentages also need clamping when the host shrinks.
  const observer = new ResizeObserver(() => {
    if (split) setSize(sizes[0]!);
  });
  desktop.addEventListener('change', syncLayout);
  divider.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', stopDrag);
  observer.observe(root);
  syncLayout();

  return () => {
    observer.disconnect();
    desktop.removeEventListener('change', syncLayout);
    divider.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', stopDrag);
    destroy();
  };
}
