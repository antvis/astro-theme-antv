const PENDING_PROMPT_KEY = "sive:qa:pending-prompt";

export class AntvQaEntry extends HTMLElement {
  private listeners?: AbortController;

  connectedCallback() {
    this.listeners?.abort();
    const entry = this.querySelector<HTMLFormElement>("[data-antv-qa-entry]");
    const prompt = this.querySelector<HTMLTextAreaElement>("[data-qa-prompt]");
    const action = this.querySelector<HTMLButtonElement>(".antv-qa-action");
    const error = this.querySelector<HTMLElement>("[data-qa-error]");
    if (!entry || !prompt || !action || !error) return;

    this.listeners = new AbortController();
    const options = { signal: this.listeners.signal };
    const suggestions = this.querySelectorAll<HTMLButtonElement>("[data-qa-suggestion]");
    let submitting = false;

    const syncAction = () => {
      action.disabled = submitting || !prompt.value.trim();
      suggestions.forEach((button) => { button.disabled = submitting; });
    };
    const clearError = () => {
      error.hidden = true;
      error.textContent = "";
    };
    const reset = () => {
      submitting = false;
      entry.removeAttribute("aria-busy");
      syncAction();
    };

    this.querySelector(".antv-qa-composer")?.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button, textarea")) return;
      prompt.focus({ preventScroll: true });
    }, options);
    prompt.addEventListener("input", () => { clearError(); syncAction(); }, options);
    prompt.addEventListener("keydown", (event) => {
      // Some IMEs report the confirmation key as Enter before composition ends.
      if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!submitting && prompt.value.trim()) entry.requestSubmit();
    }, options);

    entry.addEventListener("submit", (event) => {
      event.preventDefault();
      if (submitting) return;
      const suggestion = event.submitter instanceof HTMLButtonElement
        ? event.submitter.dataset.qaSuggestion
        : undefined;
      const text = (suggestion ?? prompt.value).trim();
      const resultUrl = entry.dataset.resultUrl;
      if (!text || text.length > prompt.maxLength || !resultUrl) return;

      prompt.value = text;
      clearError();
      try {
        sessionStorage.setItem(PENDING_PROMPT_KEY, text);
        submitting = true;
        entry.setAttribute("aria-busy", "true");
        syncAction();
        window.location.assign(new URL(resultUrl, window.location.origin));
      } catch {
        reset();
        error.textContent = entry.dataset.storageError ?? "Unable to save your question.";
        error.hidden = false;
        prompt.focus({ preventScroll: true });
      }
    }, options);

    // Restore controls when returning from Result through the back/forward cache.
    window.addEventListener("pageshow", reset, options);
    reset();
  }

  disconnectedCallback() {
    this.listeners?.abort();
  }
}
