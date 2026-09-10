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
  currentProduct: string
) => {
  const links = productLinks(item, locale);
  const name = String(item.title || '').trim();
  if (!links.length || !name) return null;

  const card = document.createElement('article');
  card.className = 'product-card';
  const isCurrent = name.toLocaleLowerCase() === currentProduct;
  card.classList.toggle('is-current', isCurrent);
  if (isCurrent) card.dataset.currentProduct = '';

  const mark = document.createElement('span');
  mark.className = 'product-mark';
  mark.setAttribute('aria-hidden', 'true');
  const iconUrl = safeRemoteUrl(item.icon);
  if (iconUrl) {
    const icon = document.createElement('img');
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
  copy.className = 'product-card-copy';
  const titleLine = document.createElement('div');
  titleLine.className = 'product-card-title';
  const title = document.createElement('strong');
  title.textContent = name;
  const slogan = document.createElement('span');
  slogan.textContent = String(item.slogan || '').trim();
  titleLine.append(title, slogan);
  const description = document.createElement('p');
  description.textContent = String(
    item.description || item.slogan || ''
  ).trim();
  const actions = document.createElement('div');
  actions.className = 'product-card-actions';
  links.forEach((link) => {
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    actions.append(anchor);
  });
  copy.append(titleLine, description, actions);
  card.append(mark, copy);
  return card;
};

export function mountProductMenu(): void {
  const root = document.documentElement;
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
  const currentProduct = String(
    root.dataset.siteTitle || ''
  ).toLocaleLowerCase();
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
      section.className = `product-group product-group-${category}`;
      const heading = document.createElement('h2');
      heading.textContent = label;
      const cards = document.createElement('div');
      products.forEach((item) => {
        const card = createProductCard(item, locale, currentProduct);
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
    state.className = 'product-error';
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
      loading.className = 'product-loading';
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
    productMenu.addEventListener('mouseenter', openProducts);
    productMenu.addEventListener('mouseleave', closeProducts);
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
}
