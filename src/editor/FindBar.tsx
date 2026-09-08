import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';

export interface FindBarProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

interface Match { from: number; to: number }

export function FindBar({ editor, open, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setReplaceText('');
      setMatches([]);
    }
  }, [open]);

  // Search whenever query changes
  useEffect(() => {
    if (!editor || !open) return;
    if (!query) {
      setMatches([]);
      return;
    }
    const doc = editor.state.doc;
    const found: Match[] = [];
    const lower = query.toLowerCase();
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const text = node.text;
      const ltext = text.toLowerCase();
      let idx = 0;
      while ((idx = ltext.indexOf(lower, idx)) !== -1) {
        found.push({ from: pos + idx, to: pos + idx + query.length });
        idx += query.length;
      }
    });
    setMatches(found);
    setActiveIdx(0);
  }, [query, editor, open]);

  // Scroll active match into view
  useEffect(() => {
    if (!editor || matches.length === 0) return;
    const m = matches[activeIdx];
    if (!m) return;
    editor.commands.setTextSelection({ from: m.from, to: m.to });
    const dom = editor.view.domAtPos(m.from).node as HTMLElement;
    dom?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx, matches, editor]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && e.shiftKey) {
        setActiveIdx((i) => (i - 1 + matches.length) % Math.max(1, matches.length));
      } else if (e.key === 'Enter') {
        setActiveIdx((i) => (i + 1) % Math.max(1, matches.length));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, matches.length, onClose]);

  if (!open) return null;

  const replace = () => {
    if (!editor || matches.length === 0) return;
    const m = matches[activeIdx];
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replaceText).run();
  };

  const replaceAll = () => {
    if (!editor || matches.length === 0) return;
    // Walk from end to start so positions don't shift
    const sorted = [...matches].sort((a, b) => b.from - a.from);
    const tr = editor.state.tr;
    for (const m of sorted) tr.insertText(replaceText, m.from, m.to);
    editor.view.dispatch(tr);
  };

  return (
    <div className="findbar">
      <div className="findbar-row">
        <input
          ref={inputRef}
          type="text"
          placeholder="查找"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="findbar-input"
        />
        <span className="findbar-count">
          {query ? (matches.length === 0 ? '无结果' : `${activeIdx + 1} / ${matches.length}`) : ''}
        </span>
        <button onClick={() => setActiveIdx((i) => (i - 1 + matches.length) % Math.max(1, matches.length))} disabled={!matches.length} title="上一个 (Shift+Enter)">↑</button>
        <button onClick={() => setActiveIdx((i) => (i + 1) % matches.length)} disabled={!matches.length} title="下一个 (Enter)">↓</button>
        <button onClick={() => setShowReplace((v) => !v)} title="切换替换">{showReplace ? '⌃' : '⌄'}</button>
        <button onClick={onClose} title="关闭 (Esc)" className="findbar-close">×</button>
      </div>
      {showReplace && (
        <div className="findbar-row">
          <input
            type="text"
            placeholder="替换为"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            className="findbar-input"
          />
          <button onClick={replace} disabled={!matches.length} className="findbar-replace-btn">替换</button>
          <button onClick={replaceAll} disabled={!matches.length} className="findbar-replace-btn">全部</button>
        </div>
      )}
    </div>
  );
}
