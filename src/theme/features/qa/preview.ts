import { qaPreviewAdapters } from 'virtual:antv-site-qa-preview-adapters';
import type {
  QaPreviewAdapter,
  QaPreviewInstance,
} from '../../../qa.js';
import { isSafeJson } from '../../../qa-adapters/shared.js';

type PreviewCopy = {
  error: string;
  loading: string;
  rerender: string;
  title: string;
  view: string;
};

type ParsedPreview = {
  adapter: QaPreviewAdapter;
  value: unknown;
};

const instances = new Map<HTMLElement, QaPreviewInstance>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parsePreview = (value: unknown): ParsedPreview | null => {
  if (
    !isRecord(value) ||
    typeof value.library !== 'string' ||
    !isSafeJson(value)
  ) {
    return null;
  }
  const adapter = qaPreviewAdapters.get(value.library.trim().toLowerCase());
  if (!adapter) return null;

  try {
    const parsed = adapter.parse(value);
    return parsed === null ? null : { adapter, value: parsed };
  } catch {
    return null;
  }
};

const destroyCard = (card: HTMLElement) => {
  instances.get(card)?.destroy();
  instances.delete(card);
};

const previewTitle = (preview: ParsedPreview | null, fallback: string) => {
  if (!preview) return fallback;
  return document.documentElement.lang === 'en'
    ? preview.adapter.title.en
    : preview.adapter.title.zh;
};

const createPreviewCard = (
  preview: ParsedPreview | null,
  copy: PreviewCopy,
  autoRender: boolean,
) => {
  const card = document.createElement('section');
  card.className = 'antv-code-preview';

  const header = document.createElement('div');
  header.className = 'antv-code-preview-header';
  const title = document.createElement('strong');
  title.textContent = previewTitle(preview, copy.title);
  header.append(title);

  const error = document.createElement('p');
  error.className = 'antv-code-preview-error';
  error.textContent = copy.error;
  error.hidden = true;

  if (!preview) {
    card.classList.add('antv-code-preview-invalid');
    error.hidden = false;
    card.append(header, error);
    return card;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = copy.view;
  header.append(button);

  const stage = document.createElement('div');
  stage.className = 'antv-code-preview-stage';
  stage.hidden = true;

  let layer = document.createElement('div');
  layer.className = 'antv-code-preview-layer';
  layer.hidden = true;

  let canvas = document.createElement('div');
  canvas.className = 'antv-code-preview-canvas';
  canvas.hidden = true;
  layer.append(canvas);
  stage.append(layer);

  button.addEventListener('click', async () => {
    const previousLayer = instances.has(card) ? layer : null;
    const previousInstance = instances.get(card);
    const renderLayer = previousLayer
      ? document.createElement('div')
      : layer;
    const renderTarget = previousLayer ? document.createElement('div') : canvas;

    if (previousLayer) {
      renderLayer.className = 'antv-code-preview-layer';
      renderLayer.dataset.state = 'staging';
      renderTarget.className = 'antv-code-preview-canvas';
      renderLayer.append(renderTarget);
      stage.append(renderLayer);
    } else {
      stage.hidden = false;
      layer.hidden = false;
      canvas.hidden = false;
    }

    error.hidden = true;
    button.disabled = true;
    button.textContent = copy.loading;

    try {
      const instance = await preview.adapter.render(renderTarget, preview.value);
      if (previousLayer) {
        delete renderLayer.dataset.state;
        layer = renderLayer;
        canvas = renderTarget;
        instances.set(card, instance);
        try {
          previousInstance?.destroy();
        } catch (destroyError) {
          console.error('AntV preview cleanup failed', destroyError);
        }
        previousLayer.remove();
      } else {
        instances.set(card, instance);
      }
      button.textContent = copy.rerender;
    } catch (renderError) {
      console.error('AntV preview render failed', renderError);
      if (previousLayer) {
        renderLayer.remove();
      } else {
        renderTarget.replaceChildren();
        stage.hidden = true;
        layer.hidden = true;
        canvas.hidden = true;
      }
      error.hidden = false;
      button.textContent = previousLayer ? copy.rerender : copy.view;
    } finally {
      button.disabled = false;
    }
  });

  card.append(header, stage, error);
  if (autoRender) queueMicrotask(() => button.click());
  return card;
};

export const renderQaPreviews = (
  target: HTMLElement,
  previews: unknown[],
  copy: PreviewCopy,
  autoRender = false,
) => {
  const signature = JSON.stringify({ autoRender, previews });
  if (target.dataset.previews === signature) return;

  destroyQaPreviews(target);
  target.dataset.previews = signature;
  if (!previews.length) return;

  const container = document.createElement('div');
  container.className = 'antv-visualization-previews';
  previews.forEach((preview) => {
    container.append(createPreviewCard(parsePreview(preview), copy, autoRender));
  });
  target.append(container);
};

export const destroyQaPreviews = (target: ParentNode) => {
  target
    .querySelectorAll<HTMLElement>('.antv-code-preview')
    .forEach(destroyCard);
  target
    .querySelectorAll<HTMLElement>('.antv-visualization-previews')
    .forEach((node) => node.remove());
  if (target instanceof HTMLElement) delete target.dataset.previews;
};
