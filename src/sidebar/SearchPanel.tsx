import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../i18n/use-translation';
import { tauri, type SearchMatch } from '../tauri/client';
import './SearchPanel.css';

export interface SearchPanelHandle {
  focus: () => void;
}

interface Props {
  rootPath: string;
  onOpen: (path: string, jumpTo?: { line: number; col: number }) => void;
}

/**
 * Cross-file search panel (sidebar tab).
 *
 * - 300ms debounce on `query` / flags.
 * - Groups results by file (Obsidian-style).
 * - Highlights matched substring inside `lineText` using char-index
 *   (Rust reports `col` as a 1-based UTF-8 char index, not byte offset).
 * - `useImperativeHandle` exposes `focus` so AppLayout's Ctrl+Shift+F
 *   shortcut can land the caret in the input after switching tabs.
 */
export const SearchPanel = forwardRef<SearchPanelHandle, Props>(({ rootPath, onOpen }, ref) => {
  const t = useT();
  const [query, setQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  // Debounced search. Cancels any in-flight timer when query/flags/root change.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const matches = await tauri.searchInFiles({
          root: rootPath,
          pattern: trimmed,
          useRegex,
          caseSensitive,
        });
        setResults(matches);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, useRegex, caseSensitive, rootPath]);

  // Group by absolute file path so duplicate relPaths in different dirs still group right.
  const grouped = useMemo(() => {
    const m = new Map<string, SearchMatch[]>();
    for (const r of results) {
      const arr = m.get(r.file);
      if (arr) arr.push(r);
      else m.set(r.file, [r]);
    }
    return Array.from(m.entries());
  }, [results]);

  return (
    <div className="search-panel">
      <div className="search-row">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="search-input"
        />
        <button
          className="search-toggle"
          data-active={useRegex}
          title={t('search.regexToggle')}
          onClick={() => setUseRegex((v) => !v)}
          type="button"
        >.*</button>
        <button
          className="search-toggle"
          data-active={caseSensitive}
          title={t('search.caseToggle')}
          onClick={() => setCaseSensitive((v) => !v)}
          type="button"
        >Aa</button>
      </div>

      {loading && <div className="search-status">{t('search.searching')}</div>}
      {error && <div className="search-error">{t('search.error', { msg: error })}</div>}
      {!loading && !error && query && results.length === 0 && (
        <div className="search-empty">{t('search.noResults')}</div>
      )}
      {!query && (
        <div className="search-hint">{t('search.hint')}</div>
      )}

      <div className="search-results">
        {grouped.map(([file, matches]) => {
          const fileName = file.split(/[\\/]/).pop() || file;
          const rel = matches[0]?.relPath ?? file;
          return (
            <div key={file} className="search-file-group">
              <div className="search-file-header" title={rel}>
                <span className="search-file-name">{fileName}</span>
                <span className="search-file-count">{matches.length}</span>
              </div>
              {matches.map((m, i) => (
                <button
                  key={`${file}:${m.line}:${i}`}
                  className="search-result"
                  onClick={() => onOpen(m.file, { line: m.line, col: m.col })}
                  data-testid="search-result"
                  type="button"
                >
                  <span className="search-result-line">{m.line}</span>
                  <span className="search-result-text">
                    {highlightMatch(m.lineText, m.col - 1, m.matchText.length)}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

SearchPanel.displayName = 'SearchPanel';

/**
 * Wraps [colStart, colStart + matchLen) of `text` with <mark>.
 * `colStart` is 0-based char index — converted to bytes only inside
 * React via the Array.from(text) char array.
 */
function highlightMatch(text: string, colStart: number, matchLen: number): ReactNode {
  const chars = Array.from(text);
  const before = chars.slice(0, colStart).join('');
  const matched = chars.slice(colStart, colStart + matchLen).join('');
  const after = chars.slice(colStart + matchLen).join('');
  return (
    <>
      {before}
      <mark>{matched}</mark>
      {after}
    </>
  );
}
