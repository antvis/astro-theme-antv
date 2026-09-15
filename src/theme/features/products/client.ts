interface ProductItem {
  category?: string;
  description?: string;
  icon?: unknown;
  lang?: string;
  links?: unknown;
  slogan?: string;
  title?: string;
}

interface ProductLink {
  href: string;
  label: string;
}

const productsUrl = 'https://assets.antv.antgroup.com/antv/products.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const safeRemoteUrl = (value: unknown) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : '';
  } catch {
    return '';
  }
};

const parseProductLinks = (value: unknown) => {
  try {
    const links = typeof value === 'string' ? JSON.parse(value) : value;
    return isRecord(links) ? links : {};
  } catch {
    return {};
  }
};

const productLinks = (item: ProductItem, locale: string): ProductLink[] => {
  const links = parseProductLinks(item.links);
  return [
    {
      href: safeRemoteUrl(isRecord(links.home) ? links.home.url : undefined),
      label: String(
        (isRecord(links.home) ? links.home.title : undefined) ||
          (locale === 'zh' ? '产品首页' : 'Product home')
      )
    },
    {
      href: safeRemoteUrl(
        isRecord(links.example) ? links.example.url : undefined
      ),
      label: String(
        (isRecord(links.example) ? links.example.title : undefined) ||
          (locale === 'zh' ? '图表示例' : 'Examples')
      )
    }
  ].filter((link) => link.href);
};

const createProductCard = (
  item: ProductItem,
  locale: string
) => {
  const links = productLinks(item, locale);
  const name = String(item.title || '').trim();
  if (!links.length || !name) return null;

  const card = document.createElement('article');
  card.className = 'product-card grid [grid-template-columns:32px_minmax(0,_1fr)] [align-items:start] gap-3 min-w-0 min-h-23 text-[var(--text)] px-0 py-[3px] [@media(width<=700px)]:min-h-0';

  const mark = document.createElement('span');
  mark.className = 'product-mark relative grid w-8 h-8 place-items-center mt-[1px] overflow-hidden rounded-none [background:transparent] text-[var(--brand-strong)] text-[10px] font-bold';
  mark.setAttribute('aria-hidden', 'true');
  const iconUrl = safeRemoteUrl(item.icon);
  if (iconUrl) {
    const icon = document.createElement('img');
  icon.className = 'absolute [inset:0] w-full h-full object-contain';
    icon.src = iconUrl;
    icon.alt = '';
    icon.loading = 'lazy';
    icon.decoding = 'async';
    icon.addEventListener(
      'error',
      () => {
        icon.remove();
        mark.textContent = name.slice(0, 3);
      },
      { once: true }
    );
    mark.append(icon);
  } else {
    mark.textContent = name.slice(0, 3);
  }

  const copy = document.createElement('div');
  copy.className = 'product-card-copy flex min-w-0 flex-col';
  const titleLine = document.createElement('div');
  titleLine.className = 'product-card-title flex min-w-0 items-baseline gap-[9px] text-[var(--text-strong)] leading-[22px]';
  const title = document.createElement('strong');
  title.className = 'flex-none text-[14px] font-semibold';
  title.textContent = name;
  const slogan = document.createElement('span');
  slogan.className = 'min-w-0 overflow-hidden text-[14px] font-semibold text-ellipsis whitespace-nowrap';
  slogan.textContent = String(item.slogan || '').trim();
  titleLine.append(title, slogan);
  const description = document.createElement('p');
  description.className = '[display:-webkit-box] min-h-5 mt-[3px] mb-0 overflow-hidden text-[var(--muted-light)] text-[12px] leading-[20px] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] mx-0';
  description.textContent = String(
    item.description || item.slogan || ''
  ).trim();
  const actions = document.createElement('div');
  actions.className = 'product-card-actions flex flex-wrap gap-4 mt-[9px]';
  links.forEach((link) => {
    const anchor = document.createElement('a');
    anchor.className = 'rounded-none [background:transparent] text-[color-mix(in_srgb,_var(--brand)_72%,_#4f7cff)] text-[12px] font-medium leading-[18px] [text-decoration:none] p-0 hover:[background:transparent] hover:text-[var(--brand-strong)] hover:[text-decoration:underline] hover:[text-underline-offset:3px] focus-visible:[background:transparent] focus-visible:text-[var(--brand-strong)] focus-visible:[text-decoration:underline] focus-visible:[text-underline-offset:3px]';
    anchor.href = link.href;
    anchor.textContent = link.label;
    actions.append(anchor);
  });
  copy.append(titleLine, description, actions);
  card.append(mark, copy);
  return card;
};

export function mountProductMenu(): void {
  const productMenu = document.querySelector<HTMLElement>(
    '[data-products-menu]'
  );
  const productList = productMenu?.querySelector<HTMLElement>(
    '[data-products-list]'
  );
  if (!productMenu || !productList) return;

  const locale = productList.dataset.locale || 'en';
  const categoryTitles: Record<string, string> = {
    basic: locale === 'zh' ? '标准版基础产品' : 'Core products',
    ai: locale === 'zh' ? 'AI 可视化方案' : 'AI Visualization Solutions',
    ecology: locale === 'zh' ? '周边生态' : 'Ecosystem'
  };
  let productsPromise: Promise<void> | undefined;
  let productCloseTimer: number | undefined;

  const renderProducts = (items: ProductItem[]) => {
    const localizedItems = items.filter((item) => item?.lang === locale);
    const fragment = document.createDocumentFragment();
    Object.entries(categoryTitles).forEach(([category, label]) => {
      const products = localizedItems.filter(
        (item) => item?.category === category
      );
      if (!products.length) return;
      const section = document.createElement('section');
      section.className = `product-group min-w-0 pt-6 pb-7 px-0 [@media(width<=900px)]:pt-5 [@media(width<=900px)]:pb-6 [&:last-child]:pb-2 product-group-${category}`;
      const heading = document.createElement('h2');
  heading.className = 'mt-0 mb-6 pt-0 pb-[13px] [border-bottom:1px_solid_var(--border-soft)] text-[var(--muted-light)] text-[14px] font-medium leading-[20px] mx-0 px-0 [@media(width<=900px)]:mb-4.5';
      heading.textContent = label;
      const cards = document.createElement('div');
  cards.className = 'grid grid-cols-4 gap-x-[clamp(28px,_4vw,_76px)] gap-y-7.5 [@media(700px<width<=900px)]:grid-cols-2 [@media(700px<width<=900px)]:gap-y-6 [@media(width<=700px)]:grid-cols-1 [@media(width<=700px)]:gap-y-5.5 [@media(900px<width<=1320px)]:gap-x-8 [@media(width<=900px)]:gap-x-7';
      products.forEach((item) => {
        const card = createProductCard(item, locale);
        if (card) cards.append(card);
      });
      if (cards.childElementCount) {
        section.append(heading, cards);
        fragment.append(section);
      }
    });
    if (!fragment.childElementCount) {
      throw new Error('No localized AntV products were returned.');
    }
    productList.replaceChildren(fragment);
    productList.removeAttribute('aria-busy');
  };

  const renderProductsError = () => {
    const state = document.createElement('div');
    state.className = 'product-error flex items-center justify-center gap-2.5 min-h-31 text-[var(--muted)] text-[12px] [&_button]:[border:1px_solid_color-mix(in_srgb,_var(--brand)_30%,_var(--border))] [&_button]:rounded-[var(--radius-small)] [&_button]:[background:var(--brand-soft)] [&_button]:text-[var(--brand-strong)] [&_button]:cursor-pointer [&_button]:font-semibold [&_button]:px-2.5 [&_button]:py-[5px] [&_button:hover]:[border-color:var(--brand)] [&_button:focus-visible]:[border-color:var(--brand)]';
    const message = document.createElement('span');
    message.textContent =
      locale === 'zh'
        ? '产品数据暂时无法加载'
        : 'Products are temporarily unavailable';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = locale === 'zh' ? '重新加载' : 'Try again';
    retry.addEventListener('click', () => void loadProducts(true));
    state.append(message, retry);
    productList.replaceChildren(state);
    productList.removeAttribute('aria-busy');
  };

  const loadProducts = (retry = false): Promise<void> => {
    if (productsPromise && !retry) return productsPromise;
    if (retry) {
      productList.setAttribute('aria-busy', 'true');
      const loading = document.createElement('div');
      loading.className = 'product-loading flex items-center justify-center gap-2.5 min-h-31 text-[var(--muted)] text-[12px] [&_>_span]:w-3.5 [&_>_span]:h-3.5 [&_>_span]:[border:2px_solid_var(--border)] [&_>_span]:[border-top-color:var(--brand)] [&_>_span]:rounded-[50%]';
      const spinner = document.createElement('span');
      spinner.setAttribute('aria-hidden', 'true');
      loading.append(
        spinner,
        locale === 'zh' ? '正在加载产品…' : 'Loading products…'
      );
      productList.replaceChildren(loading);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    productsPromise = fetch(productsUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Product request failed with ${response.status}.`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!Array.isArray(value))
          throw new TypeError('Invalid AntV product response.');
        renderProducts(value.filter(isRecord) as ProductItem[]);
      })
      .catch((error) => {
        console.error('Failed to load AntV products.', error);
        renderProductsError();
      })
      .finally(() => window.clearTimeout(timeout));
    return productsPromise;
  };

  const openProducts = () => {
    if (productCloseTimer !== undefined) window.clearTimeout(productCloseTimer);
    productMenu.setAttribute('open', '');
    void loadProducts();
  };
  const closeProducts = () => {
    if (productCloseTimer !== undefined) window.clearTimeout(productCloseTimer);
    productCloseTimer = window.setTimeout(
      () => productMenu.removeAttribute('open'),
      140
    );
  };

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    productMenu.addEventListener('pointerenter', openProducts);
    productMenu.addEventListener('pointerleave', closeProducts);
  }
  productMenu.addEventListener('focusout', (event) => {
    if (
      !(event.relatedTarget instanceof Node) ||
      !productMenu.contains(event.relatedTarget)
    ) {
      closeProducts();
    }
  });
  productMenu.addEventListener('toggle', () => {
    if (productMenu.matches(':open')) void loadProducts();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && productMenu.hasAttribute('open')) {
      if (productCloseTimer !== undefined) window.clearTimeout(productCloseTimer);
      productMenu.removeAttribute('open');
      if (productMenu.contains(document.activeElement)) productMenu.querySelector('summary')?.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !productMenu.contains(event.target)) {
      if (productCloseTimer !== undefined) window.clearTimeout(productCloseTimer);
      productMenu.removeAttribute('open');
    }
  });
}
