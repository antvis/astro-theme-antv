import { realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";

/** Normalize a platform path to forward-slashes for slug/route keys. */
export const pathKey = (value: string) => value.split(sep).join("/");

/**
 * Assert that `target` is equal to or nested beneath `root`. Used to keep
 * resolved content references from escaping their configured roots.
 */
export const assertWithin = (root: string, target: string) => {
  const path = relative(root, target);
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(`Content reference escaped its root: ${target}`);
  }
};

/**
 * Resolve both paths through the filesystem before enforcing containment.
 * This prevents an in-root symbolic link from reading a file outside `root`.
 */
export const assertRealpathWithin = async (root: string, target: string) => {
  const [physicalRoot, physicalTarget] = await Promise.all([
    realpath(root),
    realpath(target),
  ]);
  try {
    assertWithin(physicalRoot, physicalTarget);
  } catch {
    throw new Error(`Content reference escaped its root: ${target}`);
  }
};
