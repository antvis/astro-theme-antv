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
  locale: string,
  cardTemplate: HTMLTemplateElement,
  linkTemplate: HTMLTemplateElement
) => {
  const links = productLinks(item, locale);
  const name = String(item.title || '').trim();
  if (!links.length || !name) return null;

  const card = cardTemplate.content.firstElementChild!.cloneNode(
    true
  ) as HTMLElement;
  const mark = card.querySelector<HTMLElement>('[data-product-mark]')!;
  const icon = mark.querySelector('img')!;
  const iconUrl = safeRemoteUrl(item.icon);
  const showFallback = () => {
    mark.textContent = name.slice(0, 3);
  };
  if (iconUrl) {
    icon.addEventListener('error', showFallback, { once: true });
    icon.src = iconUrl;
  } else {
    showFallback();
  }

  card.querySelector('strong')!.textContent = name;
  card.querySelector('[data-product-slogan]')!.textContent = String(
    item.slogan || ''
  ).trim();
  card.querySelector('p')!.textContent = String(
    item.description || item.slogan || ''
  ).trim();
  const actions = card.querySelector('[data-product-actions]')!;
  for (const link of links) {
    const anchor = linkTemplate.content.firstElementChild!.cloneNode(
      true
    ) as HTMLAnchorElement;
    anchor.href = link.href;
    anchor.textContent = link.label;
    actions.append(anchor);
  }
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

  const groupTemplate = productMenu.querySelector<HTMLTemplateElement>(
    '[data-product-group-template]'
  )!;
  const cardTemplate = productMenu.querySelector<HTMLTemplateElement>(
    '[data-product-card-template]'
  )!;
  const linkTemplate = productMenu.querySelector<HTMLTemplateElement>(
    '[data-product-link-template]'
  )!;
  const errorTemplate = productMenu.querySelector<HTMLTemplateElement>(
    '[data-product-error-template]'
  )!;
  const loading = productList
    .querySelector('[data-products-loading]')!
    .cloneNode(true);

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
      const section = groupTemplate.content.firstElementChild!.cloneNode(
        true
      ) as HTMLElement;
      section.querySelector('h2')!.textContent = label;
      const cards = section.querySelector('[data-product-cards]')!;
      products.forEach((item) => {
        const card = createProductCard(item, locale, cardTemplate, linkTemplate);
        if (card) cards.append(card);
      });
      if (cards.childElementCount) {
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
    const state = errorTemplate.content.firstElementChild!.cloneNode(
      true
    ) as HTMLElement;
    state
      .querySelector('button')!
      .addEventListener('click', () => void loadProducts(true));
    productList.replaceChildren(state);
    productList.removeAttribute('aria-busy');
  };

  const loadProducts = (retry = false): Promise<void> => {
    if (productsPromise && !retry) return productsPromise;
    if (retry) {
      productList.setAttribute('aria-busy', 'true');
      productList.replaceChildren(loading.cloneNode(true));
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
