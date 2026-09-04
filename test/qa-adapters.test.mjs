import { expect, test } from "vitest";
import {
  createG2PreviewAdapter,
  createG6PreviewAdapter,
  createS2PreviewAdapter,
  createX6PreviewAdapter,
} from "../dist/qa-adapters/index.js";

test("parses standard G2, G6, and S2 preview payloads", () => {
  const g2 = createG2PreviewAdapter(async () => ({ Chart: class {} }));
  const g2Preview = g2.parse({
    library: " G2 ",
    data: [{ category: "A", value: 1 }],
    options: { type: "interval", container: "unsafe", width: 9999 },
  });
  expect(g2Preview).toEqual({
    data: [{ category: "A", value: 1 }],
    options: { type: "interval" },
  });

  const g6 = createG6PreviewAdapter(async () => ({ Graph: class {} }));
  expect(
    g6.parse({
      library: "g6",
      data: {
        nodes: [{ id: "node-1" }],
        edges: [{ source: "node-1", target: "node-1" }],
      },
      options: {},
    }),
  ).toBeTruthy();
  expect(
    g6.parse({
      library: "g6",
      data: { nodes: [{ id: "" }], edges: [] },
      options: {},
    }),
  ).toBeNull();

  const s2 = createS2PreviewAdapter(async () => ({ PivotSheet: class {} }));
  expect(
    s2.parse({
      library: "s2",
      dataConfig: {
        fields: { rows: ["region"], values: ["sales"] },
        data: [{ region: "East", sales: 10 }],
      },
      options: {},
    }),
  ).toBeTruthy();
});

test("parses and renders declarative X6 JSON", async () => {
  let instance;
  class Graph {
    constructor(options) {
      this.options = options;
      this.destroyed = false;
      instance = this;
    }

    fromJSON(data) {
      this.data = data;
      return this;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  const adapter = createX6PreviewAdapter(async () => ({ Graph }));
  const preview = adapter.parse({
    library: "x6",
    data: {
      nodes: [{ id: "node-a", shape: "rect" }, { id: "node-b" }],
      edges: [{ source: "node-a", target: { cell: "node-b", port: "in" } }],
    },
    options: { grid: true, container: "unsafe", width: 9999 },
  });
  expect(preview).toBeTruthy();

  const container = { clientWidth: 640 };
  await expect(adapter.render(container, preview)).resolves.toBe(instance);
  expect(instance.options).toEqual({ grid: true, container, height: 360, width: 640 });
  expect(instance.data).toEqual(preview.data);
});

test("rejects unsafe preview payloads", () => {
  const adapter = createG2PreviewAdapter(async () => ({ Chart: class {} }));
  const payload = JSON.parse(
    '{"library":"g2","data":[{"x":1}],"options":{"type":"interval"},"__proto__":{"polluted":true}}',
  );
  expect(adapter.parse(payload)).toBeNull();
});

test("owns render sizing and cleans up instances after render failures", async () => {
  let instance;
  class FailingChart {
    constructor(options) {
      this.constructorOptions = options;
      this.destroyed = false;
      instance = this;
    }

    options(value) {
      this.spec = value;
    }

    async render() {
      throw new Error("render failed");
    }

    destroy() {
      this.destroyed = true;
    }
  }

  const adapter = createG2PreviewAdapter(async () => ({ Chart: FailingChart }));
  const preview = adapter.parse({
    library: "g2",
    data: [{ x: 1 }],
    options: { type: "interval", height: 9999 },
  });
  expect(preview).toBeTruthy();
  const container = { clientWidth: 640 };

  await expect(adapter.render(container, preview)).rejects.toThrow(/render failed/);
  expect(instance.destroyed).toBe(true);
  expect(instance.constructorOptions).toEqual({
    container,
    autoFit: true,
    height: 360,
  });
  expect(instance.spec).toEqual({
    type: "interval",
    data: [{ x: 1 }],
  });
});
