/** Persisted browser-side QA session metadata. */
export interface QaHistoryEntry {
  session: string;
  stack: string;
  title: string;
  updatedAt: number;
}

interface QaHistoryInput {
  session: string;
  stack?: string;
  title?: string;
}

const QA_HISTORY_STORAGE_KEY = 'antv.qa.history:v1';
const QA_HISTORY_LIMIT = 30;
const QA_HISTORY_MAX_TIMESTAMP = 8_640_000_000_000_000;

const isHistoryEntry = (value: unknown): value is QaHistoryEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<QaHistoryEntry>;
  return (
    typeof entry.session === 'string' &&
    Boolean(entry.session.trim()) &&
    typeof entry.stack === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.updatedAt === 'number' &&
    Number.isFinite(entry.updatedAt) &&
    entry.updatedAt > 0 &&
    entry.updatedAt <= QA_HISTORY_MAX_TIMESTAMP
  );
};

export const readQaHistory = (): QaHistoryEntry[] => {
  try {
    const stored = window.localStorage.getItem(QA_HISTORY_STORAGE_KEY);
    if (!stored) return [];
    const value = JSON.parse(stored) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter(isHistoryEntry)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, QA_HISTORY_LIMIT);
  } catch {
    return [];
  }
};

export const saveQaHistory = ({
  session,
  stack = '',
  title = '',
}: QaHistoryInput): QaHistoryEntry[] => {
  const normalizedSession = session.trim();
  if (!normalizedSession) return readQaHistory();

  const history = readQaHistory();
  const existing = history.find((entry) => entry.session === normalizedSession);
  const entry: QaHistoryEntry = {
    session: normalizedSession,
    stack: stack.trim() || existing?.stack || '',
    title: title.trim() || existing?.title || normalizedSession,
    updatedAt: Date.now(),
  };
  const nextHistory = [
    entry,
    ...history.filter((item) => item.session !== normalizedSession),
  ].slice(0, QA_HISTORY_LIMIT);

  try {
    window.localStorage.setItem(QA_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  } catch {
    // History is optional and must not block the QA flow.
  }

  return nextHistory;
};
