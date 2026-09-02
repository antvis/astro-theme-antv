export interface PageLifecycleCallbacks {
  dispose(): void;
  pause(): void;
  resume(): void;
}

type PageLifecycleTarget = Pick<
  Window,
  'addEventListener' | 'removeEventListener'
>;

const wasPersisted = (event: Event) =>
  'persisted' in event && (event as PageTransitionEvent).persisted;

/**
 * Keeps long-lived browser work compatible with the back-forward cache.
 * Persisted pages pause and later resume; discarded pages are disposed.
 */
export function bindPageLifecycle(
  target: PageLifecycleTarget,
  callbacks: PageLifecycleCallbacks,
): () => void {
  const handlePageHide = (event: Event) => {
    if (wasPersisted(event)) callbacks.pause();
    else callbacks.dispose();
  };
  const handlePageShow = (event: Event) => {
    if (wasPersisted(event)) callbacks.resume();
  };
  target.addEventListener('pagehide', handlePageHide);
  target.addEventListener('pageshow', handlePageShow);
  return () => {
    target.removeEventListener('pagehide', handlePageHide);
    target.removeEventListener('pageshow', handlePageShow);
  };
}
