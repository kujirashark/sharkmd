import { Extension } from '@tiptap/core';

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
