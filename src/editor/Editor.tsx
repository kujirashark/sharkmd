import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { JSONContent } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { MarkdownInputRules } from './extensions/markdown-input-rules';
import { MarkdownPaste } from './extensions/markdown-paste';
import { MarkdownKeymap } from './extensions/markdown-keymap';

export interface EditorProps {
  value: JSONContent;
  onChange: (json: JSONContent) => void;
}

export function Editor({ value, onChange }: EditorProps) {
  const lastApplied = useRef<JSONContent | null>(null);
  const editor = useEditor({
    extensions: [StarterKit, MarkdownInputRules, MarkdownPaste, MarkdownKeymap],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  useEffect(() => {
    if (editor && value !== lastApplied.current) {
      lastApplied.current = value;
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return <EditorContent editor={editor!} />;
}
