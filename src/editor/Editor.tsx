import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
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
  // Initializing with `content: value` from useEditor is unreliable under
  // StrictMode (double-mount) and React 18 batching — the editor can be
  // created with the previous render's value, leaving the new content
  // stranded. We do NOT use useEditor for content; we set it ourselves.
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: false }),
      MarkdownInputRules,
      MarkdownPaste,
      MarkdownKeymap,
    ],
    content: EMPTY_DOC,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  // Track last applied content (by reference). Only call setContent when
  // the parent value actually changes — avoids resetting the cursor on
  // every keystroke (the parent would otherwise see the new value
  // re-rendered with the same reference and we'd loop).
  const lastValueRef = useRef<JSONContent | null>(null);

  useEffect(() => {
    if (!editor) return;
    if (value === lastValueRef.current) return;
    // Don't clobber edits the user just made. If the doc currently has
    // the same shape as `value` (e.g. set by onUpdate), skip.
    const current = editor.getJSON();
    if (JSON.stringify(current) === JSON.stringify(value)) {
      lastValueRef.current = value;
      return;
    }
    lastValueRef.current = value;
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
