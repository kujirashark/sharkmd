import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useTabsStore } from '../tabs/store';
import { useT } from '../i18n/use-translation';

export interface StatusBarProps {
  editor: Editor | null;
}

export function StatusBar({ editor }: StatusBarProps) {
  const t = useT();
  const activeId = useTabsStore((s) => s.activeId);
  const tabs = useTabsStore((s) => s.tabs);
  const active = tabs.find((t) => t.id === activeId);

  // Live editor stats
  const [stats, setStats] = useState({ chars: 0, words: 0, paragraphs: 0, ln: 1, col: 1, blockKind: '' });
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const text = editor.getText();
      const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
      const paragraphs = editor.state.doc.childCount;
      // Real line/col: count \n before cursor in the doc
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(0, from, '\n', '\n');
      const lines = textBefore.split('\n');
      const ln = lines.length;
      const col = (lines[lines.length - 1] ?? '').length + 1;
      // Identify current block kind
      const $from = editor.state.doc.resolve(from);
      const blockKind = $from.parent.type.name;
      setStats({ chars: text.length, words, paragraphs, ln, col, blockKind });
    };
    update();
    editor.on('update', update);
    editor.on('selectionUpdate', update);
    return () => {
      editor.off('update', update);
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  if (!active) {
    return <div className="statusbar empty">{t('status.noFile')}</div>;
  }

  // Map TipTap block kind → i18n key suffix
  const kindMap: Record<string, string> = {
    heading: t('status.posKindH'),
    paragraph: t('status.posKindP'),
    codeBlock: t('status.posKindC'),
    blockquote: t('status.posKindQ'),
  };
  const kind = kindMap[stats.blockKind] ?? '';

  return (
    <div className="statusbar">
      <span className="status-left">
        {active.dirty ? t('status.unsaved') : t('status.autoSaved')}
        <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
        <span style={{ color: 'var(--muted)' }}>{active.path}</span>
      </span>
      <span className="status-center">
        {editor ? t('status.wordsChars', { words: stats.words, chars: stats.chars }) : '—'}
      </span>
      <span className="status-right">
        {editor ? t('status.pos', { kind, ln: stats.ln, col: stats.col }) : ''}
        <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
        <span style={{ color: 'var(--muted)' }}>UTF-8</span>
      </span>
    </div>
  );
}
