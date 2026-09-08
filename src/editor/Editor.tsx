import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownInputRules } from './extensions/markdown-input-rules';
import { MarkdownPaste } from './extensions/markdown-paste';
import { MarkdownKeymap } from './extensions/markdown-keymap';
import { MathInline, MathDisplay } from './extensions/math-node';
import { CodeBlockWithMermaid } from './extensions/code-block-node';

export interface EditorProps {
  value: JSONContent;
  onChange: (json: JSONContent) => void;
  onEditorReady?: (editor: TiptapEditor) => void;
  /** Absolute path of the currently open .md file (for image paste → assets/). */
  currentFilePath?: string;
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export function Editor({ value, onChange, onEditorReady, currentFilePath }: EditorProps) {
  const { t } = useTranslation();
  // Always initialize with an empty doc; sync real content via useEffect.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false, autolink: false }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      MathInline,
      MathDisplay,
      CodeBlockWithMermaid,
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
    // Deep-equality guard against React 18 strict-mode double-render where
    // a new wrapper object carries the same doc — without this, the second
    // pass would call setContent(value, false) and clobber any in-progress
    // edit the user made after the first onUpdate fired (e.g. press Enter
    // right after inserting a table).
    if (editorEqual(editor.getJSON(), value)) {
      lastEmittedRef.current = value;
      lastAppliedRef.current = value;
      return;
    }
    lastAppliedRef.current = value;
    editor.commands.setContent(value, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Expose the editor instance to the parent (used by the toolbar).
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Push the current file path into the MarkdownPaste plugin's storage so
  // image-paste can decide where to save. Storage updates don't trigger a
  // editor rebuild.
  useEffect(() => {
    if (!editor) return;
    if ((editor.storage.markdownPaste as { currentFilePath?: string }).currentFilePath !== (currentFilePath ?? '')) {
      (editor.storage.markdownPaste as { currentFilePath: string }).currentFilePath = currentFilePath ?? '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilePath, editor]);

  // Mirror the i18n placeholder onto the ProseMirror root as a data
  // attribute, which themes.css reads back via `attr(...)` to populate the
  // `::before` pseudo-element on an empty paragraph.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const text = t('editor.placeholder');
    if (dom.getAttribute('data-i18n-placeholder') !== text) {
      dom.setAttribute('data-i18n-placeholder', text);
    }
  }, [editor, t]);

  if (!editor) {
    return <div style={{ padding: 24, color: 'var(--muted)' }}>{t('editor.loading')}</div>;
  }
  return <EditorContent editor={editor} />;
}

/**
 * Deep-equal for TipTap JSONContent trees. Compares node types, attrs (shallow),
 * and content recursively. Used to short-circuit the controlled-mode setContent
 * loop when the parent passes back a structurally-identical doc (e.g. after
 * React 18 strict-mode double-render of the same onChange payload).
 */
function editorEqual(a: JSONContent | null | undefined, b: JSONContent | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  const aAttrs = (a.attrs ?? {}) as Record<string, unknown>;
  const bAttrs = (b.attrs ?? {}) as Record<string, unknown>;
  const aAttrKeys = Object.keys(aAttrs);
  const bAttrKeys = Object.keys(bAttrs);
  if (aAttrKeys.length !== bAttrKeys.length) return false;
  for (const k of aAttrKeys) {
    if (aAttrs[k] !== bAttrs[k]) return false;
  }
  const aMarks = a.marks ?? [];
  const bMarks = b.marks ?? [];
  if (aMarks.length !== bMarks.length) return false;
  for (let i = 0; i < aMarks.length; i++) {
    if (aMarks[i].type !== bMarks[i].type) return false;
    const am = (aMarks[i].attrs ?? {}) as Record<string, unknown>;
    const bm = (bMarks[i].attrs ?? {}) as Record<string, unknown>;
    const amk = Object.keys(am);
    const bmk = Object.keys(bm);
    if (amk.length !== bmk.length) return false;
    for (const k of amk) if (am[k] !== bm[k]) return false;
  }
  const aText = a.text ?? '';
  const bText = b.text ?? '';
  if (aText !== bText) return false;
  const aContent = a.content ?? [];
  const bContent = b.content ?? [];
  if (aContent.length !== bContent.length) return false;
  for (let i = 0; i < aContent.length; i++) {
    if (!editorEqual(aContent[i], bContent[i])) return false;
  }
  return true;
}
