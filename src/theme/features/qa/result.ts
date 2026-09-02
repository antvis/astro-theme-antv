import checkIcon from '@tabler/icons/outline/check.svg?raw';
import copyIcon from '@tabler/icons/outline/copy.svg?raw';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { highlightCodeBlocks } from './code-highlight';
import {
  readQaHistory,
  requestQaSession,
  saveQaHistory,
  type QaHistoryEntry,
} from '../../../qa-browser.js';
import { bindPageLifecycle } from '../../../qa/page-lifecycle.js';
import { ServerSentEventDecoder } from '../../../qa/sse.js';
import { destroyQaPreviews, renderQaPreviews } from './preview';

type SharedMessage =
  | { content: string; id: string; role: 'user' }
  | {
      content: string;
      errorMessage: string | null;
      id: string;
      previews: unknown[];
      role: 'assistant';
      status: 'streaming' | 'finished' | 'aborted' | 'error';
    };

export function mountQaResult(): void {
  const root = document.querySelector('[data-antv-result]');
  if (!(root instanceof HTMLElement)) return;

  const params = new URLSearchParams(window.location.search);
  let sessionId = params.get('session')?.trim() ?? '';
  let initialQuery = params.get('q')?.trim() ?? '';
  let stack = params.get('stack')?.trim() ?? '';
  const serviceBaseUrl = root.dataset.qaServiceBase ?? '';
  const statusTarget = root.querySelector('[data-result-status]');
  const messagesTarget = root.querySelector('[data-result-messages]');
  const loadingTarget = root.querySelector('[data-result-loading]');
  const errorTarget = root.querySelector('[data-result-error]');
  const errorDescriptionTarget = root.querySelector('[data-result-error-description]');
  const composer = root.querySelector('[data-result-composer]');
  const followupInput = root.querySelector('[data-followup-input]');
  const followupSubmit = root.querySelector('[data-followup-submit]');
  const followupError = root.querySelector('[data-followup-error]');
  const historyTarget = root.querySelector('[data-history]');
  const historyList = root.querySelector('[data-history-list]');
  const historyToggle = root.querySelector('[data-history-toggle]');
  const newConversationTrigger = root.querySelector('[data-new-conversation-trigger]');
  const newConversationTarget = root.querySelector('[data-new-conversation]');
  const messageNodes = new Map<string, HTMLElement>();
  let pollTimer = 0;
  let streamRenderTimer = 0;
  let streamRenderFrame = 0;
  let streamController: AbortController | null = null;
  let streamConnecting = false;
  let streamRenderContent = '';
  let stopped = false;
  let requestPending = false;
  let generationActive = true;
  let consecutiveFailures = 0;
  let forceFollow = false;
  let sessionRevision = 0;
  let sessionSwitchPending = false;

  const copy = {
    aborted: root.dataset.textAborted ?? '',
    assistantRole: root.dataset.textAssistantRole ?? '',
    codeCopied: root.dataset.textCodeCopied ?? '',
    codeCopy: root.dataset.textCodeCopy ?? '',
    codeCopyError: root.dataset.textCodeCopyError ?? '',
    empty: root.dataset.textEmpty ?? '',
    errorStatus: root.dataset.textErrorStatus ?? '',
    finished: root.dataset.textFinished ?? '',
    followupError: root.dataset.textFollowupError ?? '',
    historyCollapse: root.dataset.textHistoryCollapse ?? '',
    historyEmpty: root.dataset.textHistoryEmpty ?? '',
    historyExpand: root.dataset.textHistoryExpand ?? '',
    loadError: root.dataset.textLoadError ?? '',
    loading: root.dataset.textLoading ?? '',
    missing: root.dataset.textMissing ?? '',
    popupBlocked: root.dataset.textPopupBlocked ?? '',
    popupClosed: root.dataset.textPopupClosed ?? '',
    popupTimeout: root.dataset.textPopupTimeout ?? '',
    retrying: root.dataset.textRetrying ?? '',
    streaming: root.dataset.textStreaming ?? '',
    submitting: root.dataset.textSubmitting ?? '',
    userRole: root.dataset.textUserRole ?? '',
  };
  const previewCopy = {
    error: root.dataset.textPreviewError ?? '',
    loading: root.dataset.textPreviewLoading ?? '',
    rerender: root.dataset.textPreviewRerender ?? '',
    title: root.dataset.textPreviewTitle ?? '',
    view: root.dataset.textPreviewView ?? '',
  };

  const historyDateFormatter = new Intl.DateTimeFormat(
    document.documentElement.lang === 'en' ? 'en' : 'zh-CN',
    { day: 'numeric', month: 'short' },
  );

  const renderHistory = (history: QaHistoryEntry[] = readQaHistory()) => {
    if (!(historyList instanceof HTMLElement)) return;
    historyList.replaceChildren();

    if (!history.length) {
      const empty = document.createElement('p');
      empty.className = 'antv-history-empty';
      empty.textContent = copy.historyEmpty;
      historyList.append(empty);
      return;
    }

    history.forEach((entry) => {
      const link = document.createElement('a');
      link.className = 'antv-history-item';
      const target = new URL(window.location.href);
      target.search = '';
      target.searchParams.set('q', entry.title);
      if (entry.stack) target.searchParams.set('stack', entry.stack);
      target.searchParams.set('session', entry.session);
      link.href = `${target.pathname}${target.search}`;
      if (entry.session === sessionId) link.setAttribute('aria-current', 'page');

      const title = document.createElement('span');
      title.className = 'antv-history-item-title';
      const stackPrefix = entry.stack ? `[${entry.stack}] ` : '';
      title.textContent = entry.title.startsWith(stackPrefix)
        ? entry.title.slice(stackPrefix.length) || entry.title
        : entry.title;

      const updatedAt = document.createElement('time');
      updatedAt.className = 'antv-history-item-date';
      updatedAt.dateTime = new Date(entry.updatedAt).toISOString();
      updatedAt.textContent = historyDateFormatter.format(entry.updatedAt);

      link.append(title, updatedAt);
      historyList.append(link);
    });
  };

  if (
    historyTarget instanceof HTMLElement &&
    historyToggle instanceof HTMLButtonElement
  ) {
    historyToggle.addEventListener('click', () => {
      const isOpen = historyTarget.dataset.open === 'true';
      historyTarget.dataset.open = String(!isOpen);
      historyToggle.setAttribute('aria-expanded', String(!isOpen));
      historyToggle.textContent = isOpen ? copy.historyExpand : copy.historyCollapse;
    });
  }

  renderHistory(
    sessionId
      ? saveQaHistory({ session: sessionId, stack, title: initialQuery })
      : readQaHistory(),
  );

  const setStatus = (value: string) => {
    if (!(statusTarget instanceof HTMLElement)) return;
    statusTarget.textContent = value;
    statusTarget.hidden = false;
  };

  const setComposerState = () => {
    const disabled = generationActive || requestPending || !sessionId;
    const hasInput =
      followupInput instanceof HTMLTextAreaElement && Boolean(followupInput.value.trim());
    if (followupInput instanceof HTMLTextAreaElement) followupInput.disabled = disabled;
    if (followupSubmit instanceof HTMLButtonElement) {
      followupSubmit.disabled = disabled || !hasInput;
      followupSubmit.toggleAttribute('aria-busy', requestPending);
    }
  };

  const showPageError = (description: string) => {
    stopped = true;
    window.clearTimeout(pollTimer);
    window.clearTimeout(streamRenderTimer);
    window.cancelAnimationFrame(streamRenderFrame);
    streamController?.abort();
    if (loadingTarget instanceof HTMLElement) loadingTarget.hidden = true;
    if (messagesTarget instanceof HTMLElement) messagesTarget.hidden = true;
    if (newConversationTarget instanceof HTMLElement) newConversationTarget.hidden = true;
    if (composer instanceof HTMLFormElement) composer.hidden = true;
    if (statusTarget instanceof HTMLElement) statusTarget.hidden = true;
    if (errorDescriptionTarget instanceof HTMLElement) errorDescriptionTarget.textContent = description;
    if (errorTarget instanceof HTMLElement) errorTarget.hidden = false;
  };

  const parseMarkdown = (content: string) => {
    const rendered = marked.parse(content, { breaks: true, gfm: true });
    return DOMPurify.sanitize(typeof rendered === 'string' ? rendered : content);
  };

  const renderMarkdown = (target: HTMLElement, content: string) => {
    destroyQaPreviews(target);
    target.innerHTML = parseMarkdown(content);
  };

  const enhanceCodeBlocks = (target: HTMLElement) => {
    highlightCodeBlocks(target);
    target.querySelectorAll('pre > code').forEach((code) => {
      const pre = code.parentElement;
      if (!(pre instanceof HTMLPreElement) || pre.dataset.copyEnhanced === 'true') return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'antv-code-copy';
      button.setAttribute('aria-label', copy.codeCopy);

      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = copyIcon;
      const label = document.createElement('span');
      label.textContent = copy.codeCopy;
      button.append(icon, label);

      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent ?? '');
          icon.innerHTML = checkIcon;
          label.textContent = copy.codeCopied;
          button.setAttribute('aria-label', copy.codeCopied);
          button.dataset.state = 'copied';
        } catch {
          label.textContent = copy.codeCopyError;
          button.setAttribute('aria-label', copy.codeCopyError);
          button.dataset.state = 'error';
        }

        window.setTimeout(() => {
          if (!button.isConnected) return;
          icon.innerHTML = copyIcon;
          label.textContent = copy.codeCopy;
          button.setAttribute('aria-label', copy.codeCopy);
          delete button.dataset.state;
        }, 1800);
      });

      pre.dataset.copyEnhanced = 'true';
      pre.append(button);
    });
  };

  const renderStreamingMarkdown = (target: HTMLElement, content: string) => {
    const template = document.createElement('template');
    template.innerHTML = parseMarkdown(content);
    const currentNodes = Array.from(target.childNodes);
    const nextNodes = Array.from(template.content.childNodes);
    let stableNodeCount = 0;

    while (
      stableNodeCount < currentNodes.length &&
      stableNodeCount < nextNodes.length &&
      currentNodes[stableNodeCount].isEqualNode(nextNodes[stableNodeCount])
    ) {
      stableNodeCount += 1;
    }

    while (target.childNodes.length > stableNodeCount) target.lastChild?.remove();
    target.append(...nextNodes.slice(stableNodeCount));
  };

  const isNearMessagesEnd = () =>
    messagesTarget instanceof HTMLElement &&
    messagesTarget.scrollTop + messagesTarget.clientHeight >= messagesTarget.scrollHeight - 96;

  const followMessages = (shouldFollow: boolean) => {
    if (!shouldFollow || !(messagesTarget instanceof HTMLElement)) return;
    requestAnimationFrame(() => {
      messagesTarget.scrollTop = messagesTarget.scrollHeight;
      forceFollow = false;
    });
  };

  const createMessageNode = (message: SharedMessage) => {
    if (!(messagesTarget instanceof HTMLElement)) return null;

    const article = document.createElement('article');
    article.className = `antv-chat-message antv-chat-message-${message.role}`;
    article.dataset.messageId = message.id;

    const role = document.createElement('div');
    role.className = 'antv-chat-role';
    role.textContent = message.role === 'user' ? copy.userRole : copy.assistantRole;

    const body = document.createElement('div');
    body.className = 'antv-chat-body';

    article.append(role, body);
    messagesTarget.append(article);
    messageNodes.set(message.id, article);
    return article;
  };

  const renderMessages = (messages: SharedMessage[], status: string) => {
    if (!(messagesTarget instanceof HTMLElement)) return;
    if (sessionSwitchPending) {
      destroyQaPreviews(messagesTarget);
      messageNodes.clear();
      if (loadingTarget instanceof HTMLElement) {
        loadingTarget.hidden = true;
        messagesTarget.replaceChildren(loadingTarget);
      } else {
        messagesTarget.replaceChildren();
      }
      sessionSwitchPending = false;
    }
    const shouldFollow = forceFollow || isNearMessagesEnd();
    let changed = false;

    messages.forEach((message, index) => {
      const article = messageNodes.get(message.id) ?? createMessageNode(message);
      const body = article?.querySelector('.antv-chat-body');
      if (!(article instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

      const isLast = index === messages.length - 1;
      const isWaiting =
        message.role === 'assistant' && isLast && status === 'streaming' && !message.content;
      const content =
        message.role === 'assistant' && !message.content
          ? isWaiting
            ? copy.loading
            : message.errorMessage || copy.empty
          : message.content;
      if (body.dataset.content !== content) {
        if (message.role === 'assistant') renderMarkdown(body, content);
        else body.textContent = content;
        body.dataset.content = content;
        changed = true;
      }
      if (message.role === 'assistant' && message.status === 'finished') {
        enhanceCodeBlocks(body);
        renderQaPreviews(
          body,
          message.previews ?? [],
          previewCopy,
          isLast,
        );
      } else if (message.role === 'assistant') {
        destroyQaPreviews(body);
      }
      article.classList.toggle(
        'antv-chat-message-streaming',
        message.role === 'assistant' && isLast && status === 'streaming',
      );
      article.classList.toggle('antv-chat-message-waiting', isWaiting);
      article.classList.toggle(
        'antv-chat-message-error',
        message.role === 'assistant' && message.status === 'error',
      );
    });

    if (loadingTarget instanceof HTMLElement) loadingTarget.hidden = messages.length > 0;
    if (changed) followMessages(shouldFollow);
  };

  const renderStreamingContent = (content: string) => {
    if (!(messagesTarget instanceof HTMLElement)) return;
    const articles = messagesTarget.querySelectorAll('.antv-chat-message-assistant');
    const article = articles.item(articles.length - 1);
    const body = article?.querySelector('.antv-chat-body');
    if (!(article instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

    const shouldFollow = forceFollow || isNearMessagesEnd();
    renderStreamingMarkdown(body, content);
    body.dataset.content = content;
    article.classList.remove('antv-chat-message-waiting');
    followMessages(shouldFollow);
  };

  const queueStreamRender = (content: string) => {
    streamRenderContent = content;
    if (streamRenderTimer || streamRenderFrame) return;
    streamRenderTimer = window.setTimeout(() => {
      streamRenderTimer = 0;
      streamRenderFrame = requestAnimationFrame(() => {
        streamRenderFrame = 0;
        renderStreamingContent(streamRenderContent);
      });
    }, 48);
  };

  const connectSharedStream = async (initialContent: string) => {
    if (stopped || streamConnecting) return;

    const revision = sessionRevision;
    const streamSessionId = sessionId;
    const controller = new AbortController();
    streamConnecting = true;
    streamRenderContent = initialContent;
    streamController = controller;

    try {
      const response = await fetch(
        `${serviceBaseUrl}/integrations/qa/session/stream?id=${encodeURIComponent(streamSessionId)}`,
        {
          credentials: 'omit',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        },
      );
      if (revision !== sessionRevision) return;
      if (response.status === 204) {
        streamConnecting = false;
        if (streamController === controller) streamController = null;
        schedulePoll();
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error('Stream unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const eventDecoder = new ServerSentEventDecoder();
      let content = initialContent;

      const processEvents = (events: ReturnType<ServerSentEventDecoder['push']>) => {
        if (revision !== sessionRevision) return;
        for (const event of events) {
          const payload = JSON.parse(event.data) as {
            delta?: unknown;
            message?: unknown;
            type?: unknown;
          };
          if (payload.type === 'text-delta' && typeof payload.delta === 'string') {
            content += payload.delta;
            queueStreamRender(content);
          } else if (payload.type === 'error') {
            throw new Error(
              typeof payload.message === 'string' ? payload.message : copy.followupError,
            );
          }
        }
      };

      while (!stopped && revision === sessionRevision) {
        const chunk = await reader.read();
        if (chunk.done) {
          processEvents(eventDecoder.finish(decoder.decode()));
          break;
        }
        processEvents(
          eventDecoder.push(decoder.decode(chunk.value, { stream: true })),
        );
      }

      if (revision !== sessionRevision) return;
      streamConnecting = false;
      if (streamController === controller) streamController = null;
      window.clearTimeout(streamRenderTimer);
      window.cancelAnimationFrame(streamRenderFrame);
      streamRenderTimer = 0;
      streamRenderFrame = 0;
      renderStreamingContent(streamRenderContent);
      if (!stopped && revision === sessionRevision) void loadResult();
    } catch (error) {
      if (revision !== sessionRevision) return;
      streamConnecting = false;
      if (streamController === controller) streamController = null;
      if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
      setStatus(copy.retrying);
      schedulePoll(900);
    }
  };

  const schedulePoll = (delay = 250) => {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(() => void loadResult(), delay);
  };

  const loadResult = async () => {
    if (stopped) return;

    const revision = sessionRevision;
    const requestedSessionId = sessionId;
    try {
      const response = await fetch(
        `${serviceBaseUrl}/integrations/qa/session?id=${encodeURIComponent(requestedSessionId)}`,
        {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        },
      );
      if (revision !== sessionRevision) return;
      if (!response.ok) {
        showPageError(response.status === 404 ? copy.missing : copy.loadError);
        return;
      }

      const payload = await response.json();
      if (revision !== sessionRevision) return;
      const result = payload?.data;
      if (!result || !Array.isArray(result.messages) || typeof result.status !== 'string') {
        throw new Error('Invalid response');
      }

      consecutiveFailures = 0;
      const messages = result.messages as SharedMessage[];
      renderMessages(messages, result.status);
      generationActive = result.status === 'pending' || result.status === 'streaming';
      setStatus(
        result.status === 'finished'
          ? copy.finished
          : result.status === 'aborted'
            ? copy.aborted
            : result.status === 'error'
              ? result.errorMessage || copy.errorStatus
              : result.status === 'streaming'
                ? copy.streaming
                : copy.loading,
      );
      setComposerState();

      if (generationActive) {
        const latestAssistant = messages.findLast((message) => message.role === 'assistant');
        if (result.status === 'streaming' && latestAssistant?.role === 'assistant') {
          void connectSharedStream(latestAssistant.content);
        } else {
          schedulePoll();
        }
      }
    } catch {
      if (revision !== sessionRevision) return;
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) {
        showPageError(copy.loadError);
        return;
      }
      setStatus(copy.retrying);
      schedulePoll(900);
    }
  };

  const activateSession = (
    next: { session: string; stack: string; title: string },
    pushHistory: boolean,
  ) => {
    const nextSessionId = next.session.trim();
    if (!nextSessionId || nextSessionId === sessionId) return;

    sessionRevision += 1;
    sessionId = nextSessionId;
    initialQuery = next.title.trim();
    stack = next.stack.trim();

    if (pushHistory) {
      const target = new URL(window.location.href);
      target.search = '';
      if (initialQuery) target.searchParams.set('q', initialQuery);
      if (stack) target.searchParams.set('stack', stack);
      target.searchParams.set('session', sessionId);
      window.history.pushState(null, '', `${target.pathname}${target.search}`);
    }

    window.clearTimeout(pollTimer);
    window.clearTimeout(streamRenderTimer);
    window.cancelAnimationFrame(streamRenderFrame);
    pollTimer = 0;
    streamRenderTimer = 0;
    streamRenderFrame = 0;
    streamController?.abort();
    streamController = null;
    streamConnecting = false;
    streamRenderContent = '';
    stopped = false;
    requestPending = false;
    generationActive = true;
    consecutiveFailures = 0;
    forceFollow = true;
    sessionSwitchPending = true;
    messageNodes.clear();

    if (messagesTarget instanceof HTMLElement) {
      messagesTarget.hidden = false;
    }
    if (newConversationTarget instanceof HTMLElement) newConversationTarget.hidden = true;
    if (errorTarget instanceof HTMLElement) errorTarget.hidden = true;
    if (composer instanceof HTMLFormElement) composer.hidden = false;
    if (followupInput instanceof HTMLTextAreaElement) {
      followupInput.value = '';
      followupInput.style.height = 'auto';
    }
    if (followupError instanceof HTMLElement) followupError.hidden = true;

    renderHistory(readQaHistory());
    setStatus(copy.loading);
    setComposerState();
    void loadResult();
  };

  const showNewConversation = (pushHistory: boolean) => {
    sessionRevision += 1;
    sessionId = '';
    initialQuery = '';
    stack = '';

    if (pushHistory && window.location.search) {
      window.history.pushState(null, '', window.location.pathname);
    }

    stopped = true;
    window.clearTimeout(pollTimer);
    window.clearTimeout(streamRenderTimer);
    window.cancelAnimationFrame(streamRenderFrame);
    pollTimer = 0;
    streamRenderTimer = 0;
    streamRenderFrame = 0;
    streamController?.abort();
    streamController = null;
    streamConnecting = false;
    streamRenderContent = '';
    requestPending = false;
    generationActive = false;
    consecutiveFailures = 0;
    forceFollow = false;
    sessionSwitchPending = false;

    if (messagesTarget instanceof HTMLElement) {
      destroyQaPreviews(messagesTarget);
      messageNodes.clear();
      if (loadingTarget instanceof HTMLElement) {
        loadingTarget.hidden = false;
        messagesTarget.replaceChildren(loadingTarget);
      } else {
        messagesTarget.replaceChildren();
      }
      messagesTarget.hidden = true;
    }
    if (newConversationTarget instanceof HTMLElement) newConversationTarget.hidden = false;
    if (errorTarget instanceof HTMLElement) errorTarget.hidden = true;
    if (composer instanceof HTMLFormElement) composer.hidden = true;
    if (statusTarget instanceof HTMLElement) statusTarget.hidden = true;
    if (followupInput instanceof HTMLTextAreaElement) {
      followupInput.value = '';
      followupInput.style.height = 'auto';
    }
    if (followupError instanceof HTMLElement) followupError.hidden = true;

    renderHistory(readQaHistory());
    requestAnimationFrame(() => {
      const prompt = newConversationTarget?.querySelector('[data-qa-prompt]');
      if (prompt instanceof HTMLTextAreaElement) prompt.focus({ preventScroll: true });
    });
  };

  const handleHistoryClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const target = event.target;
    const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a') : null;
    if (!(link instanceof HTMLAnchorElement) || !link.classList.contains('antv-history-item')) {
      return;
    }

    event.preventDefault();
    const url = new URL(link.href);
    activateSession(
      {
        session: url.searchParams.get('session')?.trim() ?? '',
        stack: url.searchParams.get('stack')?.trim() ?? '',
        title: url.searchParams.get('q')?.trim() ?? '',
      },
      true,
    );
  };

  const handlePopState = () => {
    const nextParams = new URLSearchParams(window.location.search);
    const nextSessionId = nextParams.get('session')?.trim() ?? '';
    if (!nextSessionId) {
      if (!serviceBaseUrl) showPageError(copy.loadError);
      else showNewConversation(false);
      return;
    }
    activateSession(
      {
        session: nextSessionId,
        stack: nextParams.get('stack')?.trim() ?? '',
        title: nextParams.get('q')?.trim() ?? '',
      },
      false,
    );
  };

  if (historyList instanceof HTMLElement) {
    historyList.addEventListener('click', handleHistoryClick);
  }
  const handleNewConversation = () => showNewConversation(true);
  if (newConversationTrigger instanceof HTMLButtonElement) {
    newConversationTrigger.addEventListener('click', handleNewConversation);
  }
  window.addEventListener('popstate', handlePopState);

  const pausePage = () => {
    stopped = true;
    window.clearTimeout(pollTimer);
    window.clearTimeout(streamRenderTimer);
    window.cancelAnimationFrame(streamRenderFrame);
    pollTimer = 0;
    streamRenderTimer = 0;
    streamRenderFrame = 0;
    streamController?.abort();
    streamController = null;
    streamConnecting = false;
    destroyQaPreviews(root);
  };
  const resumePage = () => {
    if (!sessionId || !serviceBaseUrl) return;
    stopped = false;
    consecutiveFailures = 0;
    setStatus(copy.loading);
    setComposerState();
    void loadResult();
  };
  const disposePage = () => {
    pausePage();
    if (historyList instanceof HTMLElement) {
      historyList.removeEventListener('click', handleHistoryClick);
    }
    if (newConversationTrigger instanceof HTMLButtonElement) {
      newConversationTrigger.removeEventListener('click', handleNewConversation);
    }
    window.removeEventListener('popstate', handlePopState);
  };
  bindPageLifecycle(window, {
    dispose: disposePage,
    pause: pausePage,
    resume: resumePage,
  });

  if (
    composer instanceof HTMLFormElement &&
    followupInput instanceof HTMLTextAreaElement &&
    followupSubmit instanceof HTMLButtonElement &&
    followupError instanceof HTMLElement
  ) {
    followupInput.addEventListener('input', () => {
      followupInput.style.height = 'auto';
      followupInput.style.height = `${Math.min(followupInput.scrollHeight, 160)}px`;
      followupSubmit.disabled = generationActive || requestPending || !followupInput.value.trim();
      followupError.hidden = true;
    });
    followupInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      composer.requestSubmit();
    });
    composer.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = followupInput.value.trim();
      if (!message || generationActive || requestPending) return;
      const submittedRevision = sessionRevision;
      const submittedSessionId = sessionId;
      const submittedTitle = initialQuery;
      const submittedStack = stack;

      requestPending = true;
      setStatus(copy.submitting);
      setComposerState();
      followupError.hidden = true;

      try {
        await requestQaSession({
          errors: {
            blocked: copy.popupBlocked,
            closed: copy.popupClosed,
            request: copy.followupError,
            timeout: copy.popupTimeout,
          },
          message,
          serviceBaseUrl,
          sessionId: submittedSessionId,
        });
        const history = saveQaHistory({
          session: submittedSessionId,
          stack: submittedStack,
          title: submittedTitle,
        });
        renderHistory(history);
        if (submittedRevision !== sessionRevision) return;
        followupInput.value = '';
        followupInput.style.height = 'auto';
        generationActive = true;
        requestPending = false;
        forceFollow = true;
        setStatus(copy.loading);
        setComposerState();
        void loadResult();
      } catch (error) {
        if (submittedRevision !== sessionRevision) return;
        requestPending = false;
        setComposerState();
        followupError.textContent = error instanceof Error ? error.message : copy.followupError;
        followupError.hidden = false;
      }
    });
  }

  if (!serviceBaseUrl) {
    showPageError(copy.loadError);
    return;
  }

  if (!sessionId) {
    showNewConversation(false);
    return;
  }

  setComposerState();
  void loadResult();
}
