import type {
  QaPreviewAdapter,
  QaPreviewContainer,
  QaPreviewInstance,
} from '../qa';
import {
  hasLibrary,
  isRecord,
  isSafeJson,
  renderPreviewInstance,
  sanitizeOptions,
} from './shared';

interface G2Preview {
  data: Record<string, unknown>[];
  options: Record<string, unknown>;
}

interface G2Chart extends QaPreviewInstance {
  options(spec: Record<string, unknown>): void;
  render(): Promise<unknown> | unknown;
}

export type G2PreviewLoader = () => Promise<{
  Chart: new (options: Record<string, unknown>) => G2Chart;
}>;

export const createG2PreviewAdapter = (
  load: G2PreviewLoader,
): QaPreviewAdapter<G2Preview> => ({
  title: {
    zh: 'G2 可视化预览',
    en: 'G2 visualization preview',
  },
  parse(value: unknown): G2Preview | null {
    if (
      !isRecord(value) ||
      !hasLibrary(value, 'g2') ||
      !isSafeJson(value)
    ) {
      return null;
    }
    if (
      !Array.isArray(value.data) ||
      !value.data.length ||
      !value.data.every(isRecord) ||
      !isRecord(value.options)
    ) {
      return null;
    }

    const options = sanitizeOptions(value.options);
    if (typeof options.type !== 'string' && !Array.isArray(options.children))
      return null;
    return { data: value.data, options };
  },
  async render(container: QaPreviewContainer, preview: G2Preview) {
    const { Chart } = await load();
    const chart = new Chart({
      container,
      autoFit: true,
      height: 360,
    });
    chart.options({ ...preview.options, data: preview.data });
    return renderPreviewInstance(chart, () => chart.render());
  },
});
