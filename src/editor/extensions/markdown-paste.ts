import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { parseMarkdown } from '../bridge';

/**
 * Heuristic check for whether a plain-text payload looks like Markdown.
 * Returns true when the text contains structural markers (headings, list
 * bullets, ordered list items, blockquotes, fenced code, bold spans, or
 * link syntax). Conservative on purpose: false positives would cause
 * ProseMirror to reformat arbitrary pasted text as rich content.
 */
export function detectMarkdown(text: string): boolean {
  if (!text) return false;
  return /(^|\n)(#{1,6} |[-*+] |\d+\. |> |```)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/.test(text);
}

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste(view, event) {
            const text = event.clipboardData?.getData('text/plain');
            if (!text || !detectMarkdown(text)) return false;
            const json = parseMarkdown(text);
            const node = view.state.schema.nodeFromJSON(json);
            const tr = view.state.tr.replaceSelectionWith(node, false).scrollIntoView();
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
