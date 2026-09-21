import { transform } from 'sucrase';
import { imports } from 'virtual:antv-demo-dependencies';

export function createFrameDocument(source: string, path: string, fitToFrame = false) {
  // JSON stays inside its script element even when example strings contain </script>.
  const input = JSON.stringify({ source, path }).replaceAll('<', '\\u003c');
  const importMap = JSON.stringify({ imports }).replaceAll('<', '\\u003c');
  const base = new URL(
    `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`,
    location.origin
  ).href;
  return `<!doctype html><html><head><meta charset="UTF-8">
    <base href="${base}">
    <script type="importmap">${importMap}</script>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body, #container { width: 100%; height: 100%; margin: 0; }
      body { background: #fff; font-family: sans-serif; }
      #container canvas, #container svg { display: block; }
      ${fitToFrame ? "html, body, #container { overflow: hidden; }" : ""}
    </style></head><body><div id="container"></div>
    <script type="application/json" data-demo-input>${input}</script>
    <script type="module" src="${import.meta.url}"></script></body></html>`;
}

// This module is loaded once by the parent to create srcdoc, then in each iframe to run it.
const input = document.querySelector<HTMLScriptElement>(
  'script[data-demo-input]'
);
if (input) {
  const { source, path } = JSON.parse(input.textContent!);
  const showError = (error: unknown) =>
    parent.postMessage(
      { type: 'antv-demo:error', error: error instanceof Error ? error.message : String(error) },
      '*'
    );
  addEventListener('error', (event) => showError(event.error || event.message));
  addEventListener('unhandledrejection', (event) => showError(event.reason));
  try {
    const { code } = transform(source, {
      transforms: ['typescript'],
      filePath: path,
    });
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `${code}\n;globalThis.parent.postMessage({ type: 'antv-demo:complete' }, '*');`;
    script.onerror = () => showError('Unable to load demo module.');
    document.body.append(script);
  } catch (error) {
    showError(error);
  }
}
