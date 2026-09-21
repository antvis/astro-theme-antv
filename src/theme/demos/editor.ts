import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";

export function createEditor(
  parent: HTMLElement,
  source: string,
  label: string,
  onChange: () => void,
  onCompositionStart: () => void
) {
  let composing = false;
  return new EditorView({
    parent,
    doc: source,
    extensions: [
      basicSetup,
      javascript({ typescript: true }),
      EditorView.contentAttributes.of({ "aria-label": label }),
      EditorView.theme({
        "&": { fontSize: "13px" },
        ".cm-scroller": { fontFamily: "monospace", maxHeight: "520px" },
        ".cm-content": { minHeight: "180px" },
        "&.cm-focused": { outline: "none" },
        ".cm-gutters": { backgroundColor: "#fff", border: "none" },
        ".cm-activeLineGutter": { backgroundColor: "#fff" },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !composing) {
          onChange();
        }
      }),
      EditorView.domEventHandlers({
        compositionstart: () => {
          composing = true;
          onCompositionStart();
        },
        compositionend: () => {
          composing = false;
          onChange();
        },
      }),
    ],
  });
}
