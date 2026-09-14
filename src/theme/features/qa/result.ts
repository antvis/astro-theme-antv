type SiveQaInstance = { destroy(): void };

declare global {
  interface Window {
    SiveQA?: {
      mount(selector: string): SiveQaInstance;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(src: string): Promise<void> {
  if (window.SiveQA) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Sive QA SDK"));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export function mountQaResult(): void {
  const root = document.querySelector("[data-sive-qa-sdk]");
  const error = document.querySelector("[data-qa-sdk-error]");
  const sdkUrl = root instanceof HTMLElement ? root.dataset.siveQaSdk : "";

  if (!sdkUrl) {
    if (error instanceof HTMLElement) error.hidden = false;
    return;
  }

  void loadSdk(sdkUrl)
    .then(() => {
      if (!window.SiveQA?.mount) {
        throw new Error("Sive QA SDK did not expose a mount function");
      }
      window.SiveQA.mount("#sive-qa-root");
    })
    .catch(() => {
      if (error instanceof HTMLElement) error.hidden = false;
    });
}
