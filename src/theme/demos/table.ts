/** Render the small data previews used by the documentation examples. */
export async function table(
  input: Record<string, unknown>[] | { url: string },
  container: HTMLElement
) {
  const data = Array.isArray(input)
    ? input
    : await fetch(input.url).then((response) => {
        if (!response.ok)
          throw new Error(`Data request failed: ${response.status}`);
        return response.json() as Promise<Record<string, unknown>[]>;
      });
  container.style.overflow = 'auto';
  container.style.maxHeight = '360px';
  const element = document.createElement('table');
  element.style.cssText =
    'border-collapse:collapse;width:100%;font-size:13px;text-align:left';
  const columns = Object.keys(data[0] ?? {});
  const header = element.createTHead().insertRow();
  for (const column of columns) {
    const th = document.createElement('th');
    th.textContent = column;
    th.style.cssText =
      'padding:8px;border-bottom:1px solid #ddd;background:#f7f8fa';
    header.append(th);
  }
  const body = element.createTBody();
  for (const item of data) {
    const row = body.insertRow();
    for (const column of columns) {
      const cell = row.insertCell();
      cell.textContent = String(item[column] ?? '');
      cell.style.cssText =
        'padding:8px;border-bottom:1px solid #eee;white-space:nowrap';
    }
  }
  container.append(element);
}
