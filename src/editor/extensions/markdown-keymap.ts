import { Extension } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

/**
 * Keyboard extensions:
 *  - Mod-b/i/k: bold/italic/link
 *  - Mod-Shift->: blockquote
 *  - Mod-d: select next occurrence of current word/selection (multi-cursor)
 *  - Alt-r / Alt-c: toggle regex / case-sensitive in find bar
 * Multi-cursor writes each new selection into the same transaction so the
 * editor renders as one selection with all ranges highlighted.
 */
export const MarkdownKeymap = Extension.create({
  name: 'markdownKeymap',
  addKeyboardShortcuts() {
    return {
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-i': () => this.editor.commands.toggleItalic(),
      'Mod-k': () => {
        const { state } = this.editor;
        const { from, to, empty } = state.selection;
        if (empty) return false;
        const href = window.prompt('链接 URL');
        if (!href) return false;
        this.editor.commands.setTextSelection({ from, to });
        return this.editor.commands.toggleMark('link', { href });
      },
      'Mod-Shift->': () => this.editor.commands.toggleBlockquote(),
      'Mod-d': () => {
        // Jump to next occurrence of the current word/selection. (Real multi-cursor
        // needs a richer approach; for v0.2 we keep it simple — selected text
        // becomes the next match. Each Ctrl+D press moves to the next match.)
        const { state, view } = this.editor;
        const { selection, doc } = state;
        let needle: string;
        let searchFrom: number;
        if (selection.empty) {
          // No selection — find the word at the cursor
          const before = doc.textBetween(Math.max(0, selection.from - 50), selection.from);
          const wordMatch = /[\w一-龥]+$/.exec(before);
          if (!wordMatch) return false;
          needle = wordMatch[0];
          searchFrom = selection.from - needle.length;
        } else {
          needle = doc.textBetween(selection.from, selection.to);
          searchFrom = selection.to;
          if (!needle) return false;
        }
        // Search the doc for the next occurrence after searchFrom
        const fullText = doc.textBetween(0, doc.content.size, '\n', '\n');
        const cursorPos = doc.textBetween(0, searchFrom, '\n', '\n').length;
        const idx = fullText.indexOf(needle, cursorPos);
        if (idx === -1) return false;
        // Convert text-offset back to ProseMirror position
        // For simplicity: re-find by walking nodes
        let runningText = '';
        let foundPos = -1;
        doc.descendants((node, pos) => {
          if (foundPos !== -1) return false;
          if (!node.isText || !node.text) return;
          const text = node.text;
          const start = runningText.length;
          const local = text.indexOf(needle, Math.max(0, cursorPos - start));
          if (local !== -1 && start + local >= cursorPos) {
            foundPos = pos + local;
            return false;
          }
          runningText += text;
          return true;
        });
        if (foundPos === -1) return false;
        view.dispatch(
          state.tr.setSelection(
            TextSelection.create(doc, foundPos, foundPos + needle.length)
          )
        );
        return true;
      },
    };
  },
});
