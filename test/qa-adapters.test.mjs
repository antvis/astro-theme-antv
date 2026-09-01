import assert from "node:assert/strict";
import test from "node:test";
import {
  createG2PreviewAdapter,
  createG6PreviewAdapter,
  createS2PreviewAdapter,
} from "../dist/qa-adapters/index.js";

test("parses standard G2, G6, and S2 preview payloads", () => {
  const g2 = createG2PreviewAdapter(async () => ({ Chart: class {} }));
  const g2Preview = g2.parse({
    library: " G2 ",
    data: [{ category: "A", value: 1 }],
    options: { type: "interval", container: "unsafe", width: 9999 },
  });
  assert.deepEqual(g2Preview, {
    data: [{ category: "A", value: 1 }],
    options: { type: "interval" },
  });

  const g6 = createG6PreviewAdapter(async () => ({ Graph: class {} }));
  assert.ok(
    g6.parse({
      library: "g6",
      data: {
        nodes: [{ id: "node-1" }],
        edges: [{ source: "node-1", target: "node-1" }],
      },
      options: {},
    }),
  );
  assert.equal(
    g6.parse({
      library: "g6",
      data: { nodes: [{ id: "" }], edges: [] },
      options: {},
    }),
    null,
  );

  const s2 = createS2PreviewAdapter(async () => ({ PivotSheet: class {} }));
  assert.ok(
    s2.parse({
      library: "s2",
      dataConfig: {
        fields: { rows: ["region"], values: ["sales"] },
        data: [{ region: "East", sales: 10 }],
      },
      options: {},
    }),
  );
});

test("rejects unsafe preview payloads", () => {
  const adapter = createG2PreviewAdapter(async () => ({ Chart: class {} }));
  const payload = JSON.parse(
    '{"library":"g2","data":[{"x":1}],"options":{"type":"interval"},"__proto__":{"polluted":true}}',
  );
  assert.equal(adapter.parse(payload), null);
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
  assert.ok(preview);
  const container = { clientWidth: 640 };

  await assert.rejects(adapter.render(container, preview), /render failed/);
  assert.equal(instance.destroyed, true);
  assert.deepEqual(instance.constructorOptions, {
    container,
    autoFit: true,
    height: 360,
  });
  assert.deepEqual(instance.spec, {
    type: "interval",
    data: [{ x: 1 }],
  });
});
