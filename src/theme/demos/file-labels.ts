/** Use the shortest path suffix that distinguishes the currently visible files. */
export function demoFileLabels(names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => {
    const parts = name.split('/');
    let depth = 1;
    let label = parts.slice(-depth).join('/');
    while (depth < parts.length && names.some((other) =>
      other !== name && (other === label || other.endsWith(`/${label}`)),
    )) {
      label = parts.slice(-++depth).join('/');
    }
    return [name, label];
  }));
}
