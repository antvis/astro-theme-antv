import type {
  QaPreviewAdapter,
  QaPreviewContainer,
  QaPreviewInstance,
} from '../qa.js';
import {
  hasLibrary,
  isRecord,
  isSafeJson,
  sanitizeOptions,
} from './shared.js';

type X6Terminal = string | { cell: string; port?: string };

interface X6Preview {
  data: {
    edges: Array<Record<string, unknown> & { source: X6Terminal; target: X6Terminal }>;
    nodes: Array<Record<string, unknown> & { id: string }>;
  };
  options: Record<string, unknown>;
}

interface X6Graph extends QaPreviewInstance {
  fromJSON(data: X6Preview['data']): X6Graph;
}

export type X6PreviewLoader = () => Promise<{
  Graph: new (options: Record<string, unknown>) => X6Graph;
}>;

const isTerminal = (value: unknown): value is X6Terminal =>
  (typeof value === 'string' && Boolean(value)) ||
  (isRecord(value) &&
    typeof value.cell === 'string' &&
    Boolean(value.cell) &&
    (value.port === undefined || (typeof value.port === 'string' && Boolean(value.port))));

export const createX6PreviewAdapter = (
  load: X6PreviewLoader,
): QaPreviewAdapter<X6Preview> => ({
  title: {
    zh: 'X6 图编辑预览',
    en: 'X6 diagram preview',
  },
  parse(value: unknown): X6Preview | null {
    if (!isRecord(value) || !hasLibrary(value, 'x6') || !isSafeJson(value)) return null;
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

    if (!value.data.nodes.every((node) => typeof node.id === 'string' && Boolean(node.id))) {
      return null;
    }
    if (!value.data.edges.every((edge) => isTerminal(edge.source) && isTerminal(edge.target))) {
      return null;
    }

    return {
      data: {
        edges: value.data.edges as X6Preview['data']['edges'],
        nodes: value.data.nodes as X6Preview['data']['nodes'],
      },
      options: sanitizeOptions(value.options),
    };
  },
  async render(container: QaPreviewContainer, preview: X6Preview) {
    const { Graph } = await load();
    const graph = new Graph({
      ...preview.options,
      container,
      height: 360,
      width: Math.max(container.clientWidth, 280),
    });
    try {
      graph.fromJSON(preview.data);
      return graph;
    } catch (error) {
      try {
        graph.destroy();
      } catch {
        // Preserve the data rendering failure after attempting cleanup.
      }
      throw error;
    }
  },
});
