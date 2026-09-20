import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";

export function createEditor(
  parent: HTMLElement,
  source: string,
  label: string,
  onChange: (source: string) => void,
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
        "&.cm-focused": { outline: "2px solid var(--brand)" },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !composing) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.domEventHandlers({
        compositionstart: () => {
          composing = true;
          onCompositionStart();
        },
        compositionend: (_event, view) => {
          composing = false;
          onChange(view.state.doc.toString());
        },
      }),
    ],
  });
}
