import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { parseMarkdown } from '../bridge';
import { extractImageFromClipboard } from '../../assets/paste-handler';

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

export interface MarkdownPasteOptions {
  /**
   * Absolute path of the .md file being edited. Used to decide where to
   * save pasted images (`<dir>/assets/`). Seeded at extension configure time
   * so the FIRST paste on a freshly-mounted editor can find the path —
   * previously this relied on a useEffect push that arrived too late.
   */
  currentFilePath?: string;
}

export const MarkdownPaste = Extension.create<MarkdownPasteOptions>({
  name: 'markdownPaste',

  addOptions() {
    return { currentFilePath: '' };
  },

  addStorage() {
    return { currentFilePath: this.options.currentFilePath ?? '' };
  },

  addProseMirrorPlugins() {
    const storage = this.editor.storage.markdownPaste;
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste(view, event) {
            const cd = event.clipboardData;
            if (!cd) return false;
            const currentFilePath = storage.currentFilePath ?? '';

            // 1) Image branch — clipboard image / screenshot tool paste.
            //    Items API captures both file-paste and screenshot tools
            //    (e.g. PrintScreen, Snipaste, WeChat screenshots).
            if (currentFilePath && cd.items && cd.items.length) {
              for (let i = 0; i < cd.items.length; i++) {
                const it = cd.items[i];
                if (it.type?.startsWith('image/')) {
                  event.preventDefault();
                  extractImageFromClipboard(cd, currentFilePath).then((md) => {
                    if (!md) return;
                    const json = parseMarkdown(md);
                    const node = view.state.schema.nodeFromJSON(json);
                    const tr = view.state.tr
                      .replaceSelectionWith(node, false)
                      .scrollIntoView();
                    view.dispatch(tr);
                  });
                  return true;
                }
              }
            }

            // 2) Markdown text branch
            const text = cd.getData('text/plain');
            if (!text || !detectMarkdown(text)) return false;
            event.preventDefault();
            const json = parseMarkdown(text);
            const node = view.state.schema.nodeFromJSON(json);
            const tr = view.state.tr
              .replaceSelectionWith(node, false)
              .scrollIntoView();
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
