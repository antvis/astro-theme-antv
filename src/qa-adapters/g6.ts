import type {
  QaPreviewAdapter,
  QaPreviewContainer,
  QaPreviewInstance,
} from '../qa.js';
import {
  hasLibrary,
  isRecord,
  isSafeJson,
  renderPreviewInstance,
  sanitizeOptions,
} from './shared.js';

interface G6Preview {
  data: {
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
    [key: string]: unknown;
  };
  options: Record<string, unknown>;
}

interface G6Graph extends QaPreviewInstance {
  render(): Promise<unknown> | unknown;
}

export type G6PreviewLoader = () => Promise<{
  Graph: new (options: Record<string, unknown>) => G6Graph;
}>;

export const createG6PreviewAdapter = (
  load: G6PreviewLoader,
): QaPreviewAdapter<G6Preview> => ({
  title: {
    zh: 'G6 图可视化预览',
    en: 'G6 graph preview',
  },
  parse(value: unknown): G6Preview | null {
    if (
      !isRecord(value) ||
      !hasLibrary(value, 'g6') ||
      !isSafeJson(value)
    ) {
      return null;
    }
    if (
      !isRecord(value.data) ||
      !Array.isArray(value.data.nodes) ||
      !value.data.nodes.length ||
      !Array.isArray(value.data.edges) ||
      !value.data.nodes.every(isRecord) ||
      !value.data.edges.every(isRecord) ||
      !isRecord(value.options)
    ) {
      return null;
    }

    const validNodes = value.data.nodes.every(
      (node) => typeof node.id === 'string' && Boolean(node.id),
    );
    const validEdges = value.data.edges.every(
      (edge) =>
        typeof edge.source === 'string' && typeof edge.target === 'string',
    );
    if (!validNodes || !validEdges) return null;

    return {
      data: {
        ...value.data,
        nodes: value.data.nodes,
        edges: value.data.edges,
      },
      options: sanitizeOptions(value.options),
    };
  },
  async render(container: QaPreviewContainer, preview: G6Preview) {
    const { Graph } = await load();
    const graph = new Graph({
      ...preview.options,
      container,
      data: preview.data,
      height: 360,
      width: Math.max(container.clientWidth, 280),
    });
    return renderPreviewInstance(graph, () => graph.render());
  },
});
