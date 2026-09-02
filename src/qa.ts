import type { LocalizedText } from './compiler/config.js';

export const qaProducts = ['g2', 's2', 'g6', 'f2', 'x6', 'l7'] as const;

export type QaProduct = (typeof qaProducts)[number];

export const qaPreviewProducts = ['g2', 's2', 'g6'] as const;

export type QaPreviewProduct = (typeof qaPreviewProducts)[number];

export const qaServiceEndpoints = {
  development: 'http://localhost:3000',
  production: 'https://sive.antv.antgroup.com',
} as const;

export interface QaPreviewInstance {
  destroy(): void;
}

export interface QaPreviewContainer {
  readonly clientWidth: number;
}

export interface QaPreviewAdapter<Preview = unknown> {
  title: LocalizedText;
  parse(value: unknown): Preview | null;
  render(
    container: QaPreviewContainer,
    preview: Preview,
  ): Promise<QaPreviewInstance> | QaPreviewInstance;
}
