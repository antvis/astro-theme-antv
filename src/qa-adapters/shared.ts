import type { QaPreviewInstance } from '../qa';

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
const blockedOptionKeys = new Set([
  'autoFit',
  'canvas',
  'container',
  'createCanvas',
  'data',
  'height',
  'lib',
  'plugins',
  'renderer',
  'width',
]);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isSafeJson = (value: unknown, depth = 0): boolean => {
  if (depth > 12) return false;
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value))
    return true;
  if (Array.isArray(value))
    return value.every((item) => isSafeJson(item, depth + 1));
  if (!isRecord(value)) return false;

  return Object.entries(value).every(
    ([key, item]) => !blockedKeys.has(key) && isSafeJson(item, depth + 1),
  );
};

export const hasLibrary = (
  value: Record<string, unknown>,
  library: string,
) =>
  typeof value.library === 'string' &&
  value.library.trim().toLowerCase() === library;

export const sanitizeOptions = (options: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(options).filter(([key]) => !blockedOptionKeys.has(key)),
  );

export async function renderPreviewInstance<Instance extends QaPreviewInstance>(
  instance: Instance,
  render: () => Promise<unknown> | unknown,
): Promise<Instance> {
  try {
    await render();
    return instance;
  } catch (error) {
    try {
      instance.destroy();
    } catch {
      // Preserve the render failure while still attempting resource cleanup.
    }
    throw error;
  }
}
