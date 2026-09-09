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
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownInputRules } from './extensions/markdown-input-rules';
import { MarkdownPaste } from './extensions/markdown-paste';
import { MarkdownKeymap } from './extensions/markdown-keymap';
import { MultiCursor } from './extensions/multi-cursor';
import { ColumnSelection } from './extensions/column-selection';
import { MathInline, MathDisplay } from './extensions/math-node';
import { CodeBlockWithMermaid } from './extensions/code-block-node';
import { SpellCheck, setSpellCheckEnabled } from './extensions/spell-check';
import type { SpellCheckStorage } from './extensions/spell-check';

export interface EditorProps {
  value: JSONContent;
  onChange: (json: JSONContent) => void;
  onEditorReady?: (editor: TiptapEditor) => void;
  /** Absolute path of the currently open .md file (for image paste → assets/). */
  currentFilePath?: string;
  /**
   * One-shot cursor target. Set by SearchPanel when opening a file from a
   * search result. line is 1-based; col is 1-based UTF-8 char index inside
   * the matched line (matching Rust's SearchMatch.col). After being applied
   * once, the value is cleared so subsequent re-renders don't re-jump.
   */
  initialJump?: { line: number; col: number };
  /**
   * Spell-check settings from the loaded Settings. SpellCheck is
   * always installed; the `enabled` flag controls whether the plugin
   * actually scans text (cheap when off — the Worker is never
   * constructed). lang defaults to 'en-US' when omitted.
   */
  spellcheckEnabled?: boolean;
  spellcheckLang?: 'en-US' | 'zh-CN';
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export function Editor({ value, onChange, onEditorReady, currentFilePath, initialJump, spellcheckEnabled, spellcheckLang }: EditorProps) {
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
      MarkdownPaste.configure({ currentFilePath: currentFilePath ?? '' }),
      MarkdownKeymap,
      MultiCursor,
      ColumnSelection,
      SpellCheck.configure({ enabled: !!spellcheckEnabled, lang: spellcheckLang ?? 'en-US' }),
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
    // Deep-equality guard: protects against a parent that re-creates the
    // wrapper object (React 18 strict-mode double-render, setState batching)
    // carrying the same doc. Without this, the second pass would call
    // setContent(value, false) and clobber any in-progress edit the user
    // just made (e.g. press Enter right after inserting a table).
    // Cheap for our doc sizes (< few KB).
    const current = editor.getJSON();
    if (
      current.type === value.type &&
      JSON.stringify(current.content ?? []) === JSON.stringify(value.content ?? [])
    ) {
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

  // Apply one-shot initialJump (SearchPanel → openFileByPath → Tab.initialJump).
  // Deferred to next tick so ProseMirror has finished rendering the doc
  // before we query its positions.
  useEffect(() => {
    if (!editor || !initialJump) return;
    const id = window.setTimeout(() => {
      jumpToLineCol(editor, initialJump);
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, initialJump]);

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

  // Push spell-check enabled/disabled into the plugin's storage. The
  // plugin itself stays installed (cheap when off) so toggling is
  // instant and doesn't rebuild the editor.
  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.spellCheck as SpellCheckStorage | undefined;
    if (!storage) return;
    if (storage.enabled !== !!spellcheckEnabled) {
      setSpellCheckEnabled(editor, !!spellcheckEnabled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spellcheckEnabled, editor]);

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
 * Move caret to (line, col) where line is 1-based and col is a 1-based
 * UTF-8 char index into the matched line text (matching Rust's
 * SearchMatch.col). Best-effort: if line is past EOF or col is past EOL,
 * the caret lands at the closest valid position rather than throwing.
 *
 * Algorithm:
 *   1. Split doc.textContent by '\n' to compute a flat char offset for the
 *      start of the requested line, then add col-1 for the column.
 *   2. Walk doc.descendants to convert that char offset back to a PM pos
 *      (offsets can't be used directly across block boundaries).
 */
function jumpToLineCol(editor: TiptapEditor, jump: { line: number; col: number }) {
  const { doc } = editor.state;
  const lines = doc.textContent.split('\n');
  const lineIdx = Math.max(0, Math.min(jump.line - 1, lines.length - 1));
  let charOffset = 0;
  for (let i = 0; i < lineIdx; i++) charOffset += lines[i].length + 1; // +1 for '\n'
  charOffset += Math.max(0, Math.min(jump.col - 1, lines[lineIdx].length));
  const pos = charOffsetToPos(doc, charOffset);
  if (pos == null) return;
  editor.commands.focus();
  editor.commands.setTextSelection({ from: pos, to: pos });
  const node = editor.view.domAtPos(pos).node as HTMLElement | null;
  if (node && typeof node.scrollIntoView === 'function') {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Convert a flat char offset (0-based, against doc.textContent) to a
 * ProseMirror position by walking the tree. Returns null if the offset
 * falls past the document end.
 */
function charOffsetToPos(doc: ProseMirrorNode, target: number): number | null {
  let remaining = target;
  let result: number | null = null;
  doc.descendants((node, pos) => {
    if (result != null) return false;
    const text = node.text || '';
    const len = text.length;
    if (len === 0) return true;
    if (remaining <= len) {
      result = pos + remaining;
      return false;
    }
    // Account for the implicit '\n' between block children at the doc level.
    if (node.isBlock && remaining === len + 1) {
      result = pos + len;
      remaining = 0;
      return false;
    }
    remaining -= len;
    // After each block (other than the last), subtract 1 for the '\n' we
    // added in the textContent split.
    if (node.isBlock) remaining -= 1;
    return true;
  });
  return result;
}
