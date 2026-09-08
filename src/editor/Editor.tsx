import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { MarkdownInputRules } from './extensions/markdown-input-rules';
import { MarkdownPaste } from './extensions/markdown-paste';
import { MarkdownKeymap } from './extensions/markdown-keymap';

export interface EditorProps {
  value: JSONContent;
  onChange: (json: JSONContent) => void;
  onEditorReady?: (editor: TiptapEditor) => void;
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export function Editor({ value, onChange, onEditorReady }: EditorProps) {
  // Always initialize with an empty doc; sync real content via useEffect.
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: false }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      MarkdownInputRules,
      MarkdownPaste,
      MarkdownKeymap,
    ],
    content: EMPTY_DOC,
    onUpdate: ({ editor }) => {
      // Record the value the editor JUST emitted so useEffect knows to
      // skip it (otherwise we'd setContent the same doc back, which resets
      // the cursor and discards in-progress edits like an Enter split).
      const json = editor.getJSON();
      lastEmittedRef.current = json;
      onChange(json);
    },
  });

  // Tracks the value the editor emitted via onUpdate. If the incoming
  // `value` prop matches this, it's our own emission — don't setContent
  // again, or we'd destroy the user's cursor and any in-progress split.
  const lastEmittedRef = useRef<JSONContent | null>(null);
  // Tracks the value we last applied via setContent (for external changes).
  const lastAppliedRef = useRef<JSONContent | null>(null);

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return; // our own update, skip
    if (value === lastAppliedRef.current) return; // already applied
    lastAppliedRef.current = value;
    editor.commands.setContent(value, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Expose the editor instance to the parent (used by the toolbar).
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) {
    return <div style={{ padding: 24, color: 'var(--muted)' }}>编辑器加载中…</div>;
  }
  return <EditorContent editor={editor} />;
}
