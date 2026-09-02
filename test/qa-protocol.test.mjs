import assert from "node:assert/strict";
import test from "node:test";
import { bindPageLifecycle } from "../dist/qa/page-lifecycle.js";
import { ServerSentEventDecoder } from "../dist/qa/sse.js";

const pageTransition = (type, persisted) => {
  const event = new Event(type);
  Object.defineProperty(event, "persisted", { value: persisted });
  return event;
};

test("decodes LF, CRLF, chunked, and final SSE events", () => {
  const decoder = new ServerSentEventDecoder();
  assert.deepEqual(decoder.push('data: {"type":"first"}\n\n'), [
    { data: '{"type":"first"}' },
  ]);
  assert.deepEqual(decoder.push('event: update\r\ndata: first\r\ndata: second\r\n'), []);
  assert.deepEqual(decoder.push('\r\n'), [
    { event: "update", data: "first\nsecond" },
  ]);
  assert.deepEqual(decoder.finish("data: final"), [{ data: "final" }]);
});

test("bounds incomplete SSE events", () => {
  const decoder = new ServerSentEventDecoder(8);
  assert.throws(() => decoder.push("data: payload"), /maximum buffered size/);
  assert.deepEqual(decoder.finish("data: ok"), [{ data: "ok" }]);
});

test("pauses BFCache pages, resumes restored pages, and disposes discarded pages", () => {
  const target = new EventTarget();
  const calls = [];
  const unbind = bindPageLifecycle(target, {
    pause: () => calls.push("pause"),
    resume: () => calls.push("resume"),
    dispose: () => calls.push("dispose"),
  });

  target.dispatchEvent(pageTransition("pagehide", true));
  target.dispatchEvent(pageTransition("pageshow", true));
  target.dispatchEvent(pageTransition("pagehide", false));
  assert.deepEqual(calls, ["pause", "resume", "dispose"]);

  unbind();
  target.dispatchEvent(pageTransition("pageshow", true));
  assert.deepEqual(calls, ["pause", "resume", "dispose"]);
});
