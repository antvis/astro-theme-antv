import type { EditorView } from 'codemirror';
import { createEditor } from './editor';
import { createFrameDocument } from './frame';

for (const root of document.querySelectorAll<HTMLElement>('[data-document-demo], [data-example-demo]')) {
  const preview = root.querySelector<HTMLElement>('[data-demo-preview]')!;
  const errorTarget = root.querySelector<HTMLElement>('[data-demo-error]')!;
  const sourceElement = root.querySelector<HTMLElement>('[data-demo-source]')!;
  const panel = root.querySelector<HTMLElement>('[data-demo-panel]')!;
  const editorTarget = root.querySelector<HTMLElement>('[data-demo-editor]')!;
  const toggle = root.querySelector<HTMLButtonElement>('[data-demo-toggle]');
  const copyButton = root.querySelector<HTMLButtonElement>('[data-demo-copy]')!;
  const copyLabel = copyButton.querySelector('[data-demo-copy-label]')!;
  const copyText = copyLabel.textContent!;
  const copyHintAttribute = copyButton.hasAttribute('data-tooltip') ? 'data-tooltip' : 'title';
  let originalSource = sourceElement.textContent!;
  const isExample = root.hasAttribute('data-example-demo');
  let editor: EditorView | undefined;
  let frame = root.querySelector<HTMLIFrameElement>('[data-demo-frame]') ?? undefined;
  let pendingFrame: HTMLIFrameElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  preview.hidden = false;
  root.querySelector<HTMLElement>('[data-demo-toolbar]')!.hidden = false;
  copyButton.hidden = false;
  panel.hidden = toggle ? toggle.getAttribute('aria-expanded') !== 'true' : false;

  const getSource = () => editor?.state.doc.toString() ?? originalSource;
  const resetCopy = () => {
    clearTimeout(copyTimer);
    copyLabel.textContent = copyText;
    copyButton.setAttribute(copyHintAttribute, copyText);
    delete copyButton.dataset.copyState;
  };
  const discardPending = () => {
    pendingFrame?.remove();
    pendingFrame = undefined;
  };
  const receive = (event: MessageEvent) => {
    const target = pendingFrame?.contentWindow === event.source ? pendingFrame
      : frame?.contentWindow === event.source ? frame : undefined;
    if (!target) return;
    if (event.data?.type === 'antv-demo:complete' && target === pendingFrame) {
      frame?.remove();
      frame = target;
      pendingFrame = undefined;
      frame.style.visibility = '';
      errorTarget.hidden = true;
    } else if (event.data?.type === 'antv-demo:error' && typeof event.data.error === 'string') {
      if (target === pendingFrame) discardPending();
      errorTarget.textContent = event.data.error;
      errorTarget.hidden = false;
    }
  };
  window.addEventListener('message', receive);
  const run = () => {
    observer.disconnect();
    clearTimeout(timer);
    discardPending();
    const next = pendingFrame = document.createElement('iframe');
    next.title = preview.getAttribute('aria-label')!;
    next.className = 'absolute inset-0 block size-full border-0';
    next.style.visibility = 'hidden';
    next.srcdoc = createFrameDocument(getSource(), root.dataset.demoPath!, isExample);
    preview.append(next);
  };
  root.querySelector('[data-demo-run]')!.addEventListener('click', run);
  const schedule = () => {
    // Removing the pending browsing context cancels obsolete runs immediately.
    discardPending();
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  };
  const mountEditor = () => {
    if (panel.hidden || editor) return;
    editor = createEditor(editorTarget, originalSource, editorTarget.dataset.label!, schedule, () => clearTimeout(timer));
    sourceElement.hidden = true;
  };
  toggle?.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    const label = panel.hidden ? toggle.dataset.show! : toggle.dataset.hide!;
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
    mountEditor();
  });
  root.querySelector('[data-demo-reset]')?.addEventListener('click', () => {
    editor?.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: originalSource } });
    run();
  });
  root.querySelector('[data-demo-stackblitz]')?.addEventListener('submit', () => {
    root.querySelector<HTMLInputElement>('[data-demo-export-source]')!.value = getSource();
  });
  copyButton.addEventListener('click', async () => {
    clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(getSource());
      copyLabel.textContent = copyButton.dataset.copied!;
      copyButton.dataset.copyState = 'success';
    } catch {
      copyLabel.textContent = copyButton.dataset.copyError!;
      copyButton.dataset.copyState = 'error';
    }
    copyButton.setAttribute(copyHintAttribute, copyLabel.textContent!);
    copyTimer = setTimeout(resetCopy, 2000);
  });
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      if (!frame) run();
      mountEditor();
      observer.disconnect();
    }
  }, { rootMargin: '200px' });
  observer.observe(root);

  if (!isExample) continue;
  const sidebar = document.querySelector<HTMLElement>('[data-example-sidebar]');
  if (!sidebar) continue;
  const links = new Map([...sidebar.querySelectorAll<HTMLAnchorElement>('[data-demo-link]')].map((link) => [link.href, link]));
  let request: AbortController | undefined;
  let currentUrl = location.href;

  const navigate = async (url: string, push: boolean) => {
    request?.abort();
    request = undefined;
    root.removeAttribute('aria-busy');
    if (url === currentUrl) {
      // A pending popstate may already have changed the address without updating the view.
      if (push && location.href !== url) history.pushState(null, '', url);
      return;
    }
    const controller = request = new AbortController();
    root.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Unable to load example: ${response.status}`);
      const html = await response.text();
      if (controller.signal.aborted) return;
      const page = new DOMParser().parseFromString(html, 'text/html');
      const next = page.querySelector<HTMLElement>('[data-example-demo]');
      if (!next) throw new Error('Missing example');
      clearTimeout(timer);
      resetCopy();
      discardPending();
      originalSource = next.querySelector<HTMLElement>('[data-demo-source]')!.textContent!;
      sourceElement.querySelector('code')!.textContent = originalSource;
      root.dataset.demoPath = next.dataset.demoPath;
      root.querySelector('#demo-title')!.textContent = next.querySelector('#demo-title')!.textContent;
      const nextPreview = next.querySelector<HTMLElement>('[data-demo-preview]')!;
      preview.setAttribute('aria-label', nextPreview.getAttribute('aria-label')!);
      editorTarget.dataset.label = next.querySelector<HTMLElement>('[data-demo-editor]')!.dataset.label;
      // Reset per-example editor history without replacing the persistent toolbar or panel.
      editor?.destroy();
      editor = undefined;
      mountEditor();
      const form = root.querySelector<HTMLFormElement>('[data-demo-stackblitz]')!;
      new FormData(next.querySelector<HTMLFormElement>('[data-demo-stackblitz]')!).forEach((value, name) => {
        (form.elements.namedItem(name) as HTMLInputElement).value = String(value);
      });
      errorTarget.hidden = true;
      const nextFrame = nextPreview.querySelector<HTMLIFrameElement>('[data-demo-frame]')!;
      nextFrame.style.visibility = 'hidden';
      pendingFrame = nextFrame;
      preview.append(nextFrame);
      document.title = page.title;
      const metadata = 'link[rel="canonical"], link[rel="alternate"][hreflang], meta[property^="og:"], meta[name^="twitter:"], meta[name="description"], script[type="application/ld+json"]';
      document.head.querySelectorAll(metadata).forEach((element) => element.remove());
      page.head.querySelectorAll(metadata).forEach((element) => document.head.append(element));
      const localeLink = document.querySelector<HTMLAnchorElement>('.nav-icon-action[hreflang]');
      const nextLocaleLink = page.querySelector<HTMLAnchorElement>('.nav-icon-action[hreflang]');
      if (localeLink && nextLocaleLink) localeLink.href = nextLocaleLink.href;
      sidebar.querySelector('[data-demo-link][aria-current="page"]')?.removeAttribute('aria-current');
      const selected = links.get(url)!;
      selected.setAttribute('aria-current', 'page');
      sidebar.dispatchEvent(new CustomEvent('antv:example-selected', { detail: selected }));
      const tooltip = sidebar.querySelector<HTMLElement>('[role="tooltip"]');
      if (tooltip) tooltip.hidden = true;
      if (push) history.pushState(null, '', url);
      currentUrl = url;
    } catch {
      if (!controller.signal.aborted) location.assign(url);
    } finally {
      if (request === controller) root.removeAttribute('aria-busy');
    }
  };
  sidebar.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-demo-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    event.preventDefault();
    void navigate(link.href, true);
  });
  window.addEventListener('popstate', () => {
    if (links.has(location.href)) void navigate(location.href, false);
    else location.reload();
  });
}
