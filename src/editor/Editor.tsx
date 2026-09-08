import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';
import { useEffect } from 'react';
import { MarkdownInputRules } from './extensions/markdown-input-rules';
import { MarkdownPaste } from './extensions/markdown-paste';
import { MarkdownKeymap } from './extensions/markdown-keymap';

export interface EditorProps {
  value: JSONContent;
  onChange: (json: JSONContent) => void;
  onEditorReady?: (editor: TiptapEditor) => void;
}

export function Editor({ value, onChange, onEditorReady }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: false }),
      MarkdownInputRules,
      MarkdownPaste,
      MarkdownKeymap,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  // Always sync external `value` into the editor when it changes by
  // reference. We intentionally drop the `lastApplied` guard: under
  // StrictMode the editor instance is created twice and refs can be
  // stale, which caused tab-switches to miss content updates. `onUpdate`
  // only fires on user edits (not on setContent), so there's no loop.
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(value, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Expose the editor instance to the parent (used by the toolbar).
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return <EditorContent editor={editor!} />;
}
