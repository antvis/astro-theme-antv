import { sep } from "node:path";

/** Normalize a platform path to forward-slashes for slug/route keys. */
export const pathKey = (value: string) => value.split(sep).join("/");

/**
 * Assert that `target` is equal to or nested beneath `root`. Used to keep
 * resolved content references from escaping their configured roots.
 */
export const assertWithin = (root: string, target: string) => {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(normalizedRoot)) {
    throw new Error(`Content reference escaped its root: ${target}`);
  }
};
