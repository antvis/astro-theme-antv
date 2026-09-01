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

interface S2Preview {
  dataConfig: Record<string, unknown> & {
    data: Record<string, unknown>[];
    fields: Record<string, unknown>;
  };
  options: Record<string, unknown>;
}

interface S2Sheet extends QaPreviewInstance {
  render(): Promise<unknown> | unknown;
}

export type S2PreviewLoader = () => Promise<{
  PivotSheet: new (
    container: QaPreviewContainer,
    dataConfig: S2Preview['dataConfig'],
    options: Record<string, unknown>,
  ) => S2Sheet;
}>;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const createS2PreviewAdapter = (
  load: S2PreviewLoader,
): QaPreviewAdapter<S2Preview> => ({
  title: {
    zh: 'S2 表格预览',
    en: 'S2 table preview',
  },
  parse(value: unknown): S2Preview | null {
    if (
      !isRecord(value) ||
      !hasLibrary(value, 's2') ||
      !isSafeJson(value)
    ) {
      return null;
    }
    if (
      !isRecord(value.dataConfig) ||
      !isRecord(value.dataConfig.fields) ||
      !Array.isArray(value.dataConfig.data) ||
      !value.dataConfig.data.every(isRecord) ||
      !isRecord(value.options)
    ) {
      return null;
    }

    const { columns, rows, values } = value.dataConfig.fields;
    if (
      (columns !== undefined && !isStringArray(columns)) ||
      (rows !== undefined && !isStringArray(rows)) ||
      !isStringArray(values) ||
      !values.length
    ) {
      return null;
    }

    return {
      dataConfig: {
        ...value.dataConfig,
        data: value.dataConfig.data,
        fields: value.dataConfig.fields,
      },
      options: sanitizeOptions(value.options),
    };
  },
  async render(container: QaPreviewContainer, preview: S2Preview) {
    const { PivotSheet } = await load();
    const sheet = new PivotSheet(container, preview.dataConfig, {
      ...preview.options,
      height: 360,
      width: Math.max(container.clientWidth, 280),
    });
    return renderPreviewInstance(sheet, () => sheet.render());
  },
});
