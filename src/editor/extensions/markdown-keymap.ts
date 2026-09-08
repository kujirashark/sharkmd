import { Extension } from '@tiptap/core';

/**
 * Keyboard extensions:
 *  - Mod-b/i/k: bold/italic/link
 *  - Mod-Shift->: blockquote
 *  - Alt-r / Alt-c: toggle regex / case-sensitive in find bar
 *
 * Note: Ctrl+D (multi-cursor accumulation) lives in the MultiCursor
 * extension. Alt+Click (extra cursor) lives in MultiCursor too. Esc
 * (collapse cursors) lives in MultiCursor too.
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
    };
  },
});
