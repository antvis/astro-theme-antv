import { requestQaSession, saveQaHistory, toQaProduct } from '../../../qa-browser.js';

export function mountQaEntries(): void {
  document.querySelectorAll('[data-antv-qa-entry]').forEach((entry) => {
    if (!(entry instanceof HTMLFormElement) || entry.dataset.qaReady === 'true') return;
    entry.dataset.qaReady = 'true';

    const prompt = entry.querySelector('[data-qa-prompt]');
    const action = entry.querySelector('.antv-qa-action');
    const stack = entry.querySelector('[data-qa-stack]');
    const errorTarget = entry.querySelector('[data-qa-error]');
    if (
      !(prompt instanceof HTMLTextAreaElement) ||
      !(action instanceof HTMLButtonElement) ||
      !(errorTarget instanceof HTMLElement)
    ) return;

    const syncAction = () => {
      action.disabled = !prompt.value.trim();
    };

    entry.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('button, [data-qa-stack]')) return;
      prompt.focus({ preventScroll: true });
    });
    prompt.addEventListener('input', syncAction);
    prompt.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      if (prompt.value.trim()) entry.requestSubmit();
    });
    syncAction();

    if (stack instanceof HTMLElement) {
      const trigger = stack.querySelector('[data-stack-trigger]');
      const menu = stack.querySelector('[data-stack-menu]');
      const input = stack.querySelector('[data-stack-input]');
      const label = stack.querySelector('[data-stack-label]');
      const displayIcon = stack.querySelector('[data-stack-icon]');
      const options = menu
        ? [...menu.querySelectorAll('[data-stack-value]')].filter(
            (option): option is HTMLButtonElement => option instanceof HTMLButtonElement,
          )
        : [];

      if (
        trigger instanceof HTMLButtonElement &&
        menu instanceof HTMLElement &&
        input instanceof HTMLInputElement &&
        label instanceof HTMLElement &&
        displayIcon instanceof HTMLElement &&
        options.length
      ) {
        const supportsPopover = typeof menu.showPopover === 'function';
        const isMenuOpen = () => (supportsPopover ? menu.matches(':popover-open') : !menu.hidden);
        const selectedIndex = () =>
          Math.max(0, options.findIndex((option) => option.getAttribute('aria-selected') === 'true'));
        const positionMenu = () => {
          const rect = trigger.getBoundingClientRect();
          const width = Math.min(310, window.innerWidth - 48);
          const left = Math.min(Math.max(24, rect.left), window.innerWidth - width - 24);
          let top = rect.bottom + 12;
          if (top + menu.offsetHeight > window.innerHeight - 24) {
            top = Math.max(24, rect.top - menu.offsetHeight - 12);
          }
          menu.style.width = `${width}px`;
          menu.style.left = `${left}px`;
          menu.style.top = `${top}px`;
        };
        const closeMenu = (restoreFocus = false) => {
          if (supportsPopover && menu.matches(':popover-open')) menu.hidePopover();
          menu.hidden = true;
          trigger.setAttribute('aria-expanded', 'false');
          if (restoreFocus) trigger.focus();
        };
        const openMenu = (focusIndex?: number) => {
          menu.hidden = false;
          menu.style.visibility = 'hidden';
          if (supportsPopover && !menu.matches(':popover-open')) menu.showPopover();
          positionMenu();
          menu.style.removeProperty('visibility');
          trigger.setAttribute('aria-expanded', 'true');
          if (typeof focusIndex === 'number') {
            window.requestAnimationFrame(() => options[focusIndex]?.focus());
          }
        };
        const selectOption = (option: HTMLButtonElement) => {
          const value = option.dataset.stackValue;
          const optionLabel = option.dataset.stackLabelValue;
          const icon = option.querySelector('.antv-qa-stack-option-icon');
          if (!value || !optionLabel || !(icon instanceof HTMLElement)) return;
          input.value = value;
          label.textContent = optionLabel;
          displayIcon.innerHTML = icon.innerHTML;
          options.forEach((item) => item.setAttribute('aria-selected', String(item === option)));
          closeMenu(true);
        };

        trigger.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));
        trigger.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && isMenuOpen()) {
            event.preventDefault();
            closeMenu();
            return;
          }
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          openMenu(event.key === 'ArrowDown' ? selectedIndex() : options.length - 1);
        });
        options.forEach((option) => option.addEventListener('click', () => selectOption(option)));
        menu.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu(true);
            return;
          }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const current = Math.max(0, options.indexOf(document.activeElement as HTMLButtonElement));
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? options.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
          options[next]?.focus();
        });
        stack.addEventListener('focusout', () => {
          window.setTimeout(() => {
            if (!stack.contains(document.activeElement)) closeMenu();
          });
        });
        document.addEventListener('pointerdown', (event) => {
          if (event.target instanceof Node && !stack.contains(event.target)) closeMenu();
        });
      }
    }

    entry.addEventListener('submit', async (event) => {
      event.preventDefault();
      const query = prompt.value.trim();
      if (!query) {
        prompt.focus();
        return;
      }

      const serviceBaseUrl = entry.dataset.qaServiceBase;
      const resultUrl = entry.dataset.resultUrl;
      const stackInput = entry.querySelector('[data-stack-input]');
      const stackValue = stackInput instanceof HTMLInputElement ? stackInput.value.trim() : '';
      const selectedStack = entry.querySelector(
        `[data-stack-value="${CSS.escape(stackValue)}"]`,
      );
      const stackLabel =
        selectedStack instanceof HTMLButtonElement
          ? selectedStack.dataset.stackLabelValue ?? stackValue.toUpperCase()
          : stackValue.toUpperCase();
      const product = toQaProduct(stackValue);
      if (!serviceBaseUrl || !resultUrl || !product) return;

      action.disabled = true;
      action.setAttribute('aria-busy', 'true');
      errorTarget.hidden = true;

      try {
        const session = await requestQaSession({
          context: {
            locale: document.documentElement.lang.startsWith('en') ? 'en-US' : 'zh-CN',
            product,
          },
          errors: {
            blocked: entry.dataset.popupBlocked ?? '',
            closed: entry.dataset.popupClosed ?? '',
            request: entry.dataset.requestError ?? '',
            timeout: entry.dataset.popupTimeout ?? '',
          },
          message: query,
          serviceBaseUrl,
        });
        const target = new URL(resultUrl, window.location.origin);
        target.searchParams.set('q', query);
        target.searchParams.set('stack', stackLabel);
        target.searchParams.set('session', session);
        saveQaHistory({ session, stack: stackLabel, title: query });
        window.location.assign(target);
      } catch (error) {
        errorTarget.textContent = error instanceof Error ? error.message : String(error);
        errorTarget.hidden = false;
        action.disabled = false;
        action.removeAttribute('aria-busy');
      }
    });
  });
}

