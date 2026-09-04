import { expect, test } from "vitest";
import { bindPageLifecycle } from "../dist/qa/page-lifecycle.js";
import { ServerSentEventDecoder } from "../dist/qa/sse.js";

const pageTransition = (type, persisted) => {
  const event = new Event(type);
  Object.defineProperty(event, "persisted", { value: persisted });
  return event;
};

test("decodes LF, CRLF, chunked, and final SSE events", () => {
  const decoder = new ServerSentEventDecoder();
  expect(decoder.push('data: {"type":"first"}\n\n')).toEqual([
    { data: '{"type":"first"}' },
  ]);
  expect(decoder.push('event: update\r\ndata: first\r\ndata: second\r\n')).toEqual([]);
  expect(decoder.push('\r\n')).toEqual([
    { event: "update", data: "first\nsecond" },
  ]);
  expect(decoder.finish("data: final")).toEqual([{ data: "final" }]);
});

test("bounds incomplete SSE events", () => {
  const decoder = new ServerSentEventDecoder(8);
  expect(() => decoder.push("data: payload")).toThrow(/maximum buffered size/);
  expect(decoder.finish("data: ok")).toEqual([{ data: "ok" }]);
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
  expect(calls).toEqual(["pause", "resume", "dispose"]);

  unbind();
  target.dispatchEvent(pageTransition("pageshow", true));
  expect(calls).toEqual(["pause", "resume", "dispose"]);
});
