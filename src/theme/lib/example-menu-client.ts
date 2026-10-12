import type { ExampleMenuCategory, ExampleMenuDemo, ExampleMenuGroup } from './example-menu';

export function setupExampleMenu(sidebar: HTMLElement, reveal: (link: HTMLElement) => void) {
  const controls = sidebar.querySelector<HTMLElement>('[data-example-controls]')!;
  const search = controls.querySelector<HTMLInputElement>('input')!;
  const nav = sidebar.querySelector('nav')!;
  const root = nav.querySelector<HTMLElement>('[data-sidebar-menu]')!;
  const results = nav.querySelector<HTMLElement>('[data-example-results]')!;
  const empty = sidebar.querySelector<HTMLElement>('[data-example-empty]')!;
  const error = sidebar.querySelector<HTMLElement>('[data-example-load-error]')!;
  const expanded = new Set([...root.querySelectorAll<HTMLDetailsElement>('details[open]')]
    .map((details) => details.parentElement!.dataset.sidebarKey!));
  let menu: ExampleMenuCategory[] | undefined;
  let pending: Promise<ExampleMenuCategory[] | undefined> | undefined;
  let currentHref = location.href;
  controls.hidden = false;

  const childList = (details: HTMLDetailsElement) => [...details.children]
    .find((element) => element.hasAttribute('data-sidebar-menu')) as HTMLElement;
  const detailsFor = (list: HTMLElement, key: string) => [...list.children]
    .find((item) => (item as HTMLElement).dataset.sidebarKey === key)
    ?.querySelector<HTMLDetailsElement>('details');
  const cloneItem = (kind: string) => {
    const template = sidebar.querySelector<HTMLTemplateElement>(`[data-example-template="${kind}"]`)!;
    return template.content.querySelector('li')!.cloneNode(true) as HTMLElement;
  };
  const isCurrent = (href: string) => new URL(href, location.href).href === currentHref;
  const demoItem = (demo: ExampleMenuDemo, text?: string) => {
    const item = cloneItem(!text && demo.thumbnail ? 'thumbnail' : 'text');
    item.dataset.sidebarKey = demo.key;
    const link = item.querySelector('a')!;
    link.href = demo.href;
    if (isCurrent(demo.href)) link.setAttribute('aria-current', 'page');
    const image = link.querySelector('img');
    if (image) {
      image.src = demo.thumbnail!;
      link.setAttribute('aria-label', demo.label);
    } else {
      link.querySelector('span')!.textContent = text ?? demo.label;
      link.title = text ?? demo.label;
    }
    if (text) item.style.setProperty('--sidebar-menu-offset', '24px');
    return item;
  };
  const renderGroup = (details: HTMLDetailsElement, group: ExampleMenuGroup) => {
    childList(details).replaceChildren(...group.demos.map((demo) => demoItem(demo)));
    details.dataset.filled = 'true';
  };
  const renderCategory = (details: HTMLDetailsElement, category: ExampleMenuCategory) => {
    childList(details).replaceChildren(...category.groups.map((group) => {
      const item = cloneItem('group');
      item.dataset.sidebarKey = group.key;
      const branch = item.querySelector('details')!;
      const link = branch.querySelector('summary a')!;
      link.textContent = group.label;
      link.setAttribute('href', group.href);
      link.setAttribute('title', group.label);
      branch.open = expanded.has(group.key);
      if (branch.open) renderGroup(branch, group);
      return item;
    }));
    details.dataset.filled = 'true';
  };
  const loadMenu = (): Promise<ExampleMenuCategory[] | undefined> => {
    if (menu) return Promise.resolve(menu);
    if (pending) return pending;
    nav.setAttribute('aria-busy', 'true');
    error.hidden = true;
    pending = (async () => {
      try {
        const response = await fetch(sidebar.dataset.menuUrl!);
        if (!response.ok) throw new Error(`Menu: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid menu');
        menu = data;
        return menu;
      } catch {
        error.hidden = false;
        return undefined;
      } finally {
        nav.removeAttribute('aria-busy');
        pending = undefined;
      }
    })();
    return pending;
  };
  const renderSearch = () => {
    const query = search.value.trim().toLocaleLowerCase();
    if (!query || !menu) {
      root.hidden = false;
      results.hidden = true;
      results.replaceChildren();
      empty.hidden = true;
      return;
    }
    const matches = menu.flatMap((category) => category.groups.flatMap((group) =>
      group.demos.filter((demo) => `${category.label} ${group.label} ${demo.label} ${demo.href}`.toLocaleLowerCase().includes(query))
        .map((demo) => demoItem(demo, `${category.label} / ${group.label} / ${demo.label}`))));
    results.replaceChildren(...matches);
    root.hidden = true;
    results.hidden = false;
    empty.hidden = matches.length > 0;
  };
  const updateSearch = async () => {
    if (!menu) await loadMenu();
    renderSearch();
  };
  search.addEventListener('focus', () => { void updateSearch(); });
  search.addEventListener('input', () => { void updateSearch(); });

  // Handle native summary clicks (including Enter/Space) without replacing the
  // focused summary. Anchors still provide a real catalog destination without JS.
  root.addEventListener('click', async (event) => {
    const summary = (event.target as Element).closest<HTMLElement>('[data-sidebar-summary]');
    if (!summary || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const details = summary.parentElement as HTMLDetailsElement;
    const key = details.parentElement!.dataset.sidebarKey!;
    details.open = !details.open;
    if (!details.open) {
      expanded.delete(key);
      if (menu) {
        childList(details).replaceChildren();
        delete details.dataset.filled;
      }
      return;
    }
    expanded.add(key);
    if (details.dataset.filled || !await loadMenu() || !details.isConnected || !details.open) return;
    const category = menu!.find((item) => item.key === key);
    if (category) renderCategory(details, category);
    else {
      const group = menu!.flatMap((item) => item.groups).find((item) => item.key === key);
      if (group) renderGroup(details, group);
    }
  });
  controls.querySelector('button')!.addEventListener('click', () => {
    search.value = '';
    renderSearch();
    expanded.clear();
    root.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => { details.open = false; });
    if (menu) for (const item of root.children) {
      const details = item.querySelector('details')!;
      childList(details).replaceChildren();
      delete details.dataset.filled;
    }
  });
  sidebar.addEventListener('antv:example-selected', (event) => {
    currentHref = (event as CustomEvent<string>).detail;
    const focusResult = results.contains(document.activeElement);
    search.value = '';
    renderSearch();
    root.querySelectorAll('[aria-current="page"]').forEach((link) => link.removeAttribute('aria-current'));
    const category = menu?.find((item) => item.groups.some((group) => group.demos.some((demo) => isCurrent(demo.href))));
    if (category) {
      const group = category.groups.find((item) => item.demos.some((demo) => isCurrent(demo.href)))!;
      expanded.add(category.key);
      expanded.add(group.key);
      const categoryDetails = detailsFor(root, category.key)!;
      categoryDetails.open = true;
      if (!categoryDetails.dataset.filled) renderCategory(categoryDetails, category);
      const groupDetails = detailsFor(childList(categoryDetails), group.key)!;
      groupDetails.open = true;
      renderGroup(groupDetails, group);
    }
    const selected = [...root.querySelectorAll<HTMLAnchorElement>('[data-demo-link]')].find((link) => isCurrent(link.href));
    if (selected) {
      selected.setAttribute('aria-current', 'page');
      for (let branch = selected.closest('details'); branch; branch = branch.parentElement!.closest('details')) branch.open = true;
      if (focusResult) selected.focus();
      requestAnimationFrame(() => reveal(selected));
    }
  });
}
