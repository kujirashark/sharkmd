import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useTabsStore } from '../tabs/store';

export interface StatusBarProps {
  editor: Editor | null;
}

export function StatusBar({ editor }: StatusBarProps) {
  const activeId = useTabsStore((s) => s.activeId);
  const tabs = useTabsStore((s) => s.tabs);
  const active = tabs.find((t) => t.id === activeId);

  // Live editor stats
  const [stats, setStats] = useState({ chars: 0, words: 0, paragraphs: 0, cursorLine: 0, cursorCol: 0 });
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const text = editor.getText();
      const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
      const paragraphs = editor.state.doc.childCount;
      // Cursor position (1-based, line, col within block)
      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      const cursorLine = $from.parent.attrs?.level || 0;
      // Approximate col by counting text length within the parent
      const parentText = $from.parent.textContent;
      const cursorCol = parentText.length;
      setStats({
        chars: text.length,
        words,
        paragraphs,
        cursorLine: cursorLine || 0,
        cursorCol,
      });
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
    return <div className="statusbar empty">无打开文件</div>;
  }

  return (
    <div className="statusbar">
      <span className="status-left">
        {active.dirty ? '● 未保存' : '✓ 已自动保存'}
        <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
        <span style={{ color: 'var(--muted)' }}>{active.path}</span>
      </span>
      <span className="status-center">
        {editor ? `${stats.words} 词 · ${stats.chars} 字符` : '—'}
      </span>
      <span className="status-right">
        {editor && stats.cursorLine > 0 ? `H${stats.cursorLine}` : ''}
        {editor ? `  Ln ${Math.max(1, stats.cursorCol)}` : ''}
        <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
        <span style={{ color: 'var(--muted)' }}>UTF-8</span>
      </span>
    </div>
  );
}
