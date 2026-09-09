import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { Misspell } from '../editor/extensions/spell-check/scan';
import { useT } from '../i18n/use-translation';
import './SpellPanel.css';

export interface SpellPanelProps {
  editor: Editor | null;
  misspellings: Misspell[];
  /**
   * True when the worker hasn't replied yet OR the dictionary failed to
   * load. The panel shows a hint instead of an empty list so the user
   * knows spell-check is on but no results are available yet.
   */
  dictionaryUnavailable?: boolean;
}

/**
 * Sidebar tab listing misspellings in the active document.
 *
 * Mirrors SearchPanel ergonomics:
 *   - Empty-state messages for "no document" / "no errors" / "worker
 *     unavailable".
 *   - Clicking a word selects the misspelling in the editor.
 *   - A suggestion dropdown on each row replaces the word inline via
 *     `editor.commands.insertContentAt(range, suggestion)`.
 *
 * Offset translation mirrors the SpellCheck extension's algorithm:
 * top-level blocks contribute their text length plus an implicit '\n'
 * separator between blocks.
 */
export function SpellPanel({ editor, misspellings, dictionaryUnavailable }: SpellPanelProps) {
  const t = useT();
  // Track which row's suggestion dropdown is open. -1 = none.
  const [openRow, setOpenRow] = useState<number>(-1);

  if (!editor) {
    return <div className="spell-empty">{t('spell.noDocument')}</div>;
  }
  if (dictionaryUnavailable) {
    return <div className="spell-empty">{t('spell.dictionaryUnavailable')}</div>;
  }
  if (misspellings.length === 0) {
    return <div className="spell-empty">{t('spell.noErrors')}</div>;
  }

  const jumpTo = (m: Misspell, idx: number) => {
    const from = charOffsetToPmPos(editor, m.from);
    const to = charOffsetToPmPos(editor, m.to);
    if (from == null || to == null) return;
    editor.commands.focus();
    editor.commands.setTextSelection({ from, to });
    setOpenRow(idx);
  };

  const replace = (m: Misspell, suggestion: string) => {
    const from = charOffsetToPmPos(editor, m.from);
    const to = charOffsetToPmPos(editor, m.to);
    if (from == null || to == null) return;
    editor.commands.insertContentAt({ from, to }, suggestion);
    setOpenRow(-1);
  };

  return (
    <div className="spell-panel">
      <div className="spell-header">
        {misspellings.length === 1
          ? t('spell.header_one')
          : t('spell.header_other', { count: misspellings.length })}
      </div>
      <div className="spell-list">
        {misspellings.map((m, idx) => {
          const isOpen = openRow === idx;
          return (
            <div key={`${m.from}-${m.to}`} className="spell-row">
              <button
                className="spell-word"
                onClick={() => jumpTo(m, idx)}
                title={t('spell.jump')}
                type="button"
                data-testid="spell-word"
              >
                <span className="spell-word-text">{m.word}</span>
              </button>
              {m.suggestions.length > 0 ? (
                <div className="spell-suggest-wrap">
                  <button
                    className="spell-suggest-toggle"
                    onClick={() => setOpenRow(isOpen ? -1 : idx)}
                    type="button"
                    data-testid="spell-suggest-toggle"
                  >
                    {isOpen ? '×' : t('spell.suggestions')}
                  </button>
                  {isOpen && (
                    <ul className="spell-suggest-list" data-testid="spell-suggest-list">
                      {m.suggestions.map((s) => (
                        <li key={s}>
                          <button
                            className="spell-suggest-item"
                            onClick={() => replace(m, s)}
                            type="button"
                            data-testid="spell-suggest-item"
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <span className="spell-no-suggest">{t('spell.noSuggestions')}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Convert a 0-based char offset against `doc.textContent` to a PM
 * position. Iterates top-level blocks: each contributes its text
 * length, plus an implicit '\n' between consecutive blocks.
 *
 * Public so the unit test can verify the mapping without rendering.
 */
export function charOffsetToPmPos(editor: Editor, target: number): number | null {
  const doc = editor.state.doc;
  let charOffset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const block = doc.child(i);
    const blockOpen = blockStartPos(doc, i);
    // Compute the block's text length.
    let blockTextLen = 0;
    block.descendants((n) => {
      if (n.isText && n.text) blockTextLen += n.text.length;
      return true;
    });
    if (target <= charOffset + blockTextLen) {
      // Inside this block. Walk descendants to find the relative
      // position.
      const inner = target - charOffset;
      let pos: number | null = null;
      block.descendants((n, p) => {
        if (pos != null) return false;
        if (!n.isText || !n.text) return true;
        const len = n.text.length;
        if (inner <= len) {
          pos = p + inner;
          return false;
        }
        return true;
      });
      if (pos != null) return blockOpen + 1 + pos;
      return null;
    }
    charOffset += blockTextLen;
    if (i < doc.childCount - 1) {
      if (target === charOffset) {
        // The '\n' boundary lands at this block's closing token.
        return blockOpen + block.nodeSize;
      }
      charOffset += 1;
    }
  }
  return null;
}

function blockStartPos(doc: import('@tiptap/pm/model').Node, i: number): number {
  let pos = 0;
  for (let k = 0; k < i; k++) pos += doc.child(k).nodeSize;
  return pos;
}
