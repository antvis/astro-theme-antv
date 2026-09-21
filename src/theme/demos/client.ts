import type { EditorView } from 'codemirror';

for (const root of document.querySelectorAll<HTMLElement>('[data-document-demo]')) {
  const preview = root.querySelector<HTMLElement>('[data-demo-preview]')!;
  const errorTarget = root.querySelector<HTMLElement>('[data-demo-error]')!;
  const sourceElement = root.querySelector<HTMLElement>('[data-demo-source]')!;
  const panel = root.querySelector<HTMLElement>('[data-demo-panel]')!;
  const editorTarget = root.querySelector<HTMLElement>('[data-demo-editor]')!;
  const toggle = root.querySelector<HTMLButtonElement>('[data-demo-toggle]')!;
  const copyButton = root.querySelector<HTMLButtonElement>('[data-demo-copy]')!;
  const copyLabel = copyButton.querySelector('[data-demo-copy-label]')!;
  const copyText = copyLabel.textContent!;
  let source = sourceElement.textContent!;
  let editor: EditorView | undefined;
  let frame: HTMLIFrameElement | undefined;
  let pendingFrame: HTMLIFrameElement | undefined;
  let mounting = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  preview.hidden = false;
  root.querySelector<HTMLElement>('[data-demo-toolbar]')!.hidden = false;
  copyButton.hidden = false;
  panel.hidden = toggle.getAttribute('aria-expanded') !== 'true';

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
  const run = async () => {
    observer.disconnect();
    clearTimeout(timer);
    discardPending();
    const next = pendingFrame = document.createElement('iframe');
    next.title = preview.getAttribute('aria-label')!;
    next.className = 'absolute inset-0 block size-full border-0';
    next.style.visibility = 'hidden';
    try {
      const { createFrameDocument } = await import('./frame');
      if (pendingFrame !== next) return;
      next.srcdoc = createFrameDocument(source, root.dataset.demoPath!);
      preview.append(next);
    } catch (error) {
      if (pendingFrame !== next) return;
      discardPending();
      errorTarget.textContent = error instanceof Error ? error.message : String(error);
      errorTarget.hidden = false;
    }
  };
  root.querySelector('[data-demo-run]')!.addEventListener('click', run);
  const schedule = (value: string) => {
    source = value;
    // Removing the pending browsing context cancels obsolete runs immediately.
    discardPending();
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  };
  const mountEditor = async () => {
    if (panel.hidden || editor || mounting) return;
    mounting = true;
    try {
      const { createEditor } = await import('./editor');
      editor = createEditor(editorTarget, source, editorTarget.dataset.label!, schedule, () => clearTimeout(timer));
      sourceElement.hidden = true;
    } catch (error) { console.error('Unable to load demo editor', error); }
    finally { mounting = false; }
  };
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    const label = panel.hidden ? toggle.dataset.show! : toggle.dataset.hide!;
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
    void mountEditor();
  });
  copyButton.addEventListener('click', async () => {
    clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText(source);
      copyLabel.textContent = copyButton.dataset.copied!;
      copyButton.dataset.copyState = 'success';
    } catch {
      copyLabel.textContent = copyButton.dataset.copyError!;
      copyButton.dataset.copyState = 'error';
    }
    copyButton.title = copyLabel.textContent!;
    copyTimer = setTimeout(() => {
      copyLabel.textContent = copyText;
      copyButton.title = copyText;
      delete copyButton.dataset.copyState;
    }, 2000);
  });
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      run();
      void mountEditor();
    }
  }, { rootMargin: '200px' });
  observer.observe(root);
}
