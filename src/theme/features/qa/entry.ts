const PENDING_PROMPT_KEY = "sive:qa:pending-prompt";

export function mountQaEntries(): void {
  document.querySelectorAll("[data-antv-qa-entry]").forEach((entry) => {
    if (!(entry instanceof HTMLFormElement) || entry.dataset.qaReady === "true")
      return;
    entry.dataset.qaReady = "true";

    const prompt = entry.querySelector("[data-qa-prompt]");
    const action = entry.querySelector(".antv-qa-action");
    if (
      !(prompt instanceof HTMLTextAreaElement) ||
      !(action instanceof HTMLButtonElement)
    )
      return;

    const syncAction = () => {
      action.disabled = !prompt.value.trim();
    };

    entry.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button"))
        return;
      prompt.focus({ preventScroll: true });
    });
    prompt.addEventListener("input", syncAction);
    prompt.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      if (prompt.value.trim()) entry.requestSubmit();
    });
    syncAction();

    entry.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = prompt.value.trim();
      const resultUrl = entry.dataset.resultUrl;
      if (!text || !resultUrl) return;

      sessionStorage.setItem(PENDING_PROMPT_KEY, text);
      window.location.assign(new URL(resultUrl, window.location.origin));
    });
  });
}
