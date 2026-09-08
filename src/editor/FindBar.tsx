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
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [regexError, setRegexError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setReplaceText('');
      setMatches([]);
      setRegexError('');
    }
  }, [open]);

  // Search whenever query or flags change
  useEffect(() => {
    if (!editor || !open) return;
    if (!query) {
      setMatches([]);
      setRegexError('');
      return;
    }
    let matcher: (s: string) => RegExpMatchArray[] | null;
    if (useRegex) {
      try {
        const flags = 'g' + (caseSensitive ? '' : 'i');
        const re = new RegExp(query, flags);
        matcher = (s: string) => {
          const out: RegExpMatchArray[] = [];
          let m: RegExpExecArray | null;
          // Reset lastIndex for each text node
          const local = new RegExp(re.source, re.flags);
          while ((m = local.exec(s)) !== null) {
            out.push(m as unknown as RegExpMatchArray);
            if (m.index === local.lastIndex) local.lastIndex++; // avoid zero-width infinite loop
          }
          return out;
        };
        setRegexError('');
      } catch (e) {
        setRegexError(String((e as Error).message ?? e));
        setMatches([]);
        return;
      }
    } else {
      const needle = caseSensitive ? query : query.toLowerCase();
      matcher = (s: string) => {
        const hay = caseSensitive ? s : s.toLowerCase();
        const out: { index: number; 0: string }[] = [];
        let idx = 0;
        while ((idx = hay.indexOf(needle, idx)) !== -1) {
          out.push({ index: idx, 0: needle });
          idx += needle.length;
        }
        return out as unknown as RegExpMatchArray[];
      };
    }
    const doc = editor.state.doc;
    const found: Match[] = [];
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const matches2 = matcher(node.text);
      if (!matches2) return;
      for (const m of matches2) {
        const idx = (m as unknown as { index: number }).index;
        const len = (m as unknown as { 0: string })[0]?.length ?? query.length;
        found.push({ from: pos + idx, to: pos + idx + len });
      }
    });
    setMatches(found);
    setActiveIdx(0);
  }, [query, editor, open, useRegex, caseSensitive]);

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
          placeholder={useRegex ? '正则表达式' : '查找'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="findbar-input"
          style={regexError ? { borderColor: '#d33' } : undefined}
        />
        <span className="findbar-count">
          {regexError ? '⚠ ' + regexError
            : query ? (matches.length === 0 ? '无结果' : `${activeIdx + 1} / ${matches.length}`)
            : ''}
        </span>
        <button
          onClick={() => setUseRegex((v) => !v)}
          title="正则表达式 (Alt+R)"
          className="findbar-toggle"
          data-active={useRegex}
        >.*</button>
        <button
          onClick={() => setCaseSensitive((v) => !v)}
          title="区分大小写 (Alt+C)"
          className="findbar-toggle"
          data-active={caseSensitive}
        >Aa</button>
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
