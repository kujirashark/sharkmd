import { Extension } from '@tiptap/core';
import type { CommandProps } from '@tiptap/core';
import { Plugin, PluginKey, SelectionRange, TextSelection } from '@tiptap/pm/state';
import type { EditorState as PMEditorState, Selection as PMSelection, Transaction } from '@tiptap/pm/state';
import type { ResolvedPos, Node as PMNode } from '@tiptap/pm/model';
import type { Mappable } from '@tiptap/pm/transform';

export interface CursorRange {
  from: number;
  to: number;
}

// Augment TipTap's command typing so `editor.commands.selectNextOccurrence()`
// (etc.) type-checks in tests and downstream consumers.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    addCursor: {
      addCursor: (pos: number) => ReturnType;
    };
    addCursorAtSelection: {
      addCursorAtSelection: () => ReturnType;
    };
    selectNextOccurrence: {
      selectNextOccurrence: () => ReturnType;
    };
    clearCursors: {
      clearCursors: () => ReturnType;
    };
  }
}

/**
 * Per-editor state field holding the accumulated cursor ranges. Using a
 * PM state field (not TipTap's extension storage) gives us a fresh copy
 * per editor — extension storage is shared across editor instances when
 * the same `Extension` object is reused, which causes ranges to leak
 * between editors in tests (and potentially across tabs in production).
 */
interface MultiCursorField {
  ranges: CursorRange[];
}

const fieldKey = new PluginKey<MultiCursorField>('multiCursorRanges');

/**
 * TextSelection subclass that supports multiple ranges. ProseMirror's
 * vanilla `TextSelection` only holds a single range; we need a custom
 * concrete class because the base `Selection` is abstract and doesn't
 * implement `eq()`. The view layer calls `state.selection.eq(...)` on
 * every state update.
 */
class MultiTextSelection extends TextSelection {
  readonly multiRanges: readonly SelectionRange[] = [];

  constructor($anchor: ResolvedPos, $head: ResolvedPos, ranges: readonly SelectionRange[]) {
    super($anchor, $head);
    Object.defineProperty(this, 'multiRanges', { value: ranges, enumerable: true });
    Object.defineProperty(this, 'ranges', { value: ranges, enumerable: true });
  }

  eq(other: PMSelection): boolean {
    if (!(other instanceof MultiTextSelection)) return false;
    if (other.multiRanges.length !== this.multiRanges.length) return false;
    for (let i = 0; i < this.multiRanges.length; i++) {
      if (
        other.multiRanges[i].$from.pos !== this.multiRanges[i].$from.pos ||
        other.multiRanges[i].$to.pos !== this.multiRanges[i].$to.pos
      ) {
        return false;
      }
    }
    return true;
  }

  map(doc: PMNode, mapping: Mappable): MultiTextSelection {
    const mapped = this.multiRanges.map((r) => {
      const $from = doc.resolve(mapping.map(r.$from.pos));
      const $to = doc.resolve(mapping.map(r.$to.pos));
      return new SelectionRange($from, $to);
    });
    const $anchor = doc.resolve(mapping.map(this.anchor));
    const $head = doc.resolve(mapping.map(this.head));
    return new MultiTextSelection($anchor, $head, mapped);
  }

  toJSON(): { type: string; ranges: Array<{ anchor: number; head: number }> } {
    return {
      type: 'multiText',
      ranges: this.multiRanges.map((r) => ({
        anchor: r.$from.pos,
        head: r.$to.pos,
      })),
    };
  }

  static fromJSON(doc: PMNode, json: { ranges: Array<{ anchor: number; head: number }> }): MultiTextSelection {
    const ranges = json.ranges.map((r) => new SelectionRange(doc.resolve(r.anchor), doc.resolve(r.head)));
    const $anchor = ranges[0].$from;
    const $head = ranges[ranges.length - 1].$to;
    return new MultiTextSelection($anchor, $head, ranges);
  }
}

// Register so JSON deserialization round-trips.
(TextSelection as unknown as { jsonID: (id: string, cls: typeof MultiTextSelection) => void }).jsonID(
  'multiText',
  MultiTextSelection,
);

const MAX_RANGES = 100;

/**
 * Real multi-cursor: accumulate matches via repeated Ctrl+D and add extra
 * cursors via Alt+Click. All ranges are held in a ProseMirror state field
 * (per-editor) and reflected in the editor's selection as a multi-range
 * TextSelection.
 *
 * Typing applies the same text to every range (ProseMirror handles
 * multi-range text replacement; we just gate on having > 1 range to let
 * the default handler run when the user has collapsed to one).
 *
 * Escape collapses to a single cursor at the primary range's $from.
 */
export const MultiCursor = Extension.create({
  name: 'multiCursor',

  addCommands() {
    return {
      addCursor:
        (pos: number) =>
        ({ editor, tr }: CommandProps) => {
          const existing = readRanges(editor.state);
          const merged = dedupeRanges(
            [...existing, { from: pos, to: pos }],
            MAX_RANGES,
          );
          setRangesField(tr, merged);
          applyRangesOnTr(tr, merged);
          return true;
        },

      addCursorAtSelection:
        () =>
        ({ editor, tr }: CommandProps) => {
          const existing = readRanges(editor.state);
          const { from, to } = editor.state.selection;
          const merged = dedupeRanges(
            [...existing, { from, to }],
            MAX_RANGES,
          );
          setRangesField(tr, merged);
          applyRangesOnTr(tr, merged);
          return true;
        },

      selectNextOccurrence:
        () =>
        ({ editor, tr }: CommandProps) => {
          const { state } = editor;
          const { selection, doc } = state;
          let needle: string;
          let searchFrom: number;
          const currentRanges = readRanges(state);
          const last = currentRanges[currentRanges.length - 1];
          if (last && last.from !== last.to) {
            try {
              needle = doc.textBetween(last.from, last.to);
            } catch {
              needle = '';
            }
            searchFrom = last.to;
          } else if (!selection.empty) {
            try {
              needle = doc.textBetween(selection.from, selection.to);
            } catch {
              needle = '';
            }
            searchFrom = selection.to;
          } else {
            const word = getCurrentWord(state);
            if (!word) return false;
            needle = word;
            searchFrom = selection.from;
          }
          if (!needle) return false;
          const foundPos = findNextOccurrence(state, searchFrom, needle);
          if (foundPos === null) return false;
          const newRange: CursorRange = { from: foundPos, to: foundPos + needle.length };
          const merged = dedupeRanges([...currentRanges, newRange], MAX_RANGES);
          setRangesField(tr, merged);
          applyRangesOnTr(tr, merged);
          return true;
        },

      clearCursors:
        () =>
        ({ editor, tr }: CommandProps) => {
          setRangesField(tr, []);
          const $from = editor.state.selection.$from;
          tr.setSelection(TextSelection.create(editor.state.doc, $from.pos, $from.pos));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<MultiCursorField>({
        key: fieldKey,
        state: {
          init: (): MultiCursorField => ({ ranges: [] }),
          apply(tr, prev): MultiCursorField {
            const meta = tr.getMeta(fieldKey) as CursorRange[] | undefined;
            if (meta !== undefined) {
              return { ranges: meta };
            }
            // Map existing ranges through any doc changes so positions
            // stay valid after edits via other commands.
            if (tr.docChanged && prev.ranges.length) {
              const mapped: CursorRange[] = [];
              for (const r of prev.ranges) {
                const from = tr.mapping.map(r.from);
                const to = tr.mapping.map(r.to);
                if (from !== to) {
                  mapped.push({ from, to });
                }
              }
              return { ranges: mapped };
            }
            return prev;
          },
        },
        props: {
          handleDOMEvents: {
            mousedown(view, event: MouseEvent) {
              if (!event.altKey || event.button !== 0) return false;
              const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (!hit || typeof hit.pos !== 'number') return false;
              const existing = readRanges(view.state);
              const merged = dedupeRanges(
                [...existing, { from: hit.pos, to: hit.pos }],
                MAX_RANGES,
              );
              const tr = view.state.tr;
              setRangesField(tr, merged);
              applyRangesOnTr(tr, merged);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            },
          },
          handleTextInput(view, _from: number, _to: number, text: string) {
            const ranges = readRanges(view.state);
            if (ranges.length <= 1) return false;
            const tr = view.state.tr;
            const sorted = [...ranges].sort((a, b) => b.from - a.from);
            for (const r of sorted) {
              tr.insertText(text, r.from, r.to);
            }
            const insertLen = text.length;
            const newRanges = sorted.map((r) => ({
              from: r.from + insertLen,
              to: r.to + insertLen,
            }));
            setRangesField(tr, newRanges);
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // WebView2 / WKWebView swallow `Mod-d` at the platform layer
      // (system "bookmark this page" accelerator) so ProseMirror never
      // sees the keydown. Use Mod-Shift-d instead — same VS Code feel,
      // doesn't collide with browser shortcuts. Also keep an Escape fallback
      // so users who instinctively type lowercase d don't get a silent
      // no-op; we surface it as a no-op in the keymap (return false below).
      'Mod-Shift-d': () => {
        const commands = this.editor.commands as unknown as {
          selectNextOccurrence: () => boolean;
          clearCursors: () => boolean;
        };
        return commands.selectNextOccurrence();
      },
      Escape: () => {
        const commands = this.editor.commands as unknown as {
          selectNextOccurrence: () => boolean;
          clearCursors: () => boolean;
        };
        return commands.clearCursors();
      },
    };
  },

  // Provide a TipTap storage slot too. We don't write to it from this
  // extension (the PM state field is the source of truth and is
  // per-editor), but exposing the shape keeps consumers consistent.
  addStorage() {
    return { ranges: [] as CursorRange[] };
  },
});

/**
 * Read the current ranges. Source of truth is the PM state field, but
 * we also surface a live non-empty selection when the field is empty
 * (e.g. just after `setTextSelection` and before the user has pressed
 * Ctrl+D). This makes the first Ctrl+D behave like "select this and the
 * next match" — matching the user's mental model from VS Code.
 *
 * An empty cursor selection (e.g. no text selected, just a caret) is
 * NOT added to the ranges — Ctrl+D with an empty cursor should detect
 * the word at the cursor and match forward from there, not add the
 * caret position itself to the range list.
 */
function readRanges(state: PMEditorState): CursorRange[] {
  const field = fieldKey.getState(state);
  const fieldRanges = field?.ranges ?? [];
  if (fieldRanges.length > 0) {
    return fieldRanges;
  }
  const sel = state.selection;
  if (sel.ranges.length > 1) {
    return sel.ranges.map((r) => ({ from: r.$from.pos, to: r.$to.pos }));
  }
  // Single-range non-empty selection acts as the seed for accumulation.
  if (!sel.empty) {
    return [{ from: sel.from, to: sel.to }];
  }
  return [];
}

/**
 * Mark the transaction so the PM state field's `apply` method picks up
 * the new ranges. This is the only way to write into a per-editor
 * PM-managed field without bypassing the framework.
 */
function setRangesField(tr: Transaction, ranges: CursorRange[]): void {
  tr.setMeta(fieldKey, ranges);
}

/**
 * Apply a set of ranges to the given transaction as a multi-range
 * selection.
 */
function applyRangesOnTr(tr: Transaction, ranges: CursorRange[]): void {
  if (ranges.length === 0) return;
  const doc = tr.doc;
  const selectionRanges = ranges.map((r) => {
    const $from = doc.resolve(r.from);
    const $to = doc.resolve(r.to);
    return new SelectionRange($from, $to);
  });
  const $anchor = selectionRanges[0].$from;
  const $head = selectionRanges[selectionRanges.length - 1].$to;
  const selection = new MultiTextSelection($anchor, $head, selectionRanges);
  tr.setSelection(selection);
}

/**
 * Dedupe and merge adjacent/overlapping ranges. Always returns sorted,
 * non-overlapping ranges, capped at `max`.
 */
function dedupeRanges(ranges: CursorRange[], max: number): CursorRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: CursorRange[] = [];
  for (const r of sorted) {
    if (r.from === r.to && merged.length > 0 && merged[merged.length - 1].to === r.from) {
      continue;
    }
    if (merged.length === 0) {
      merged.push({ from: r.from, to: r.to });
      continue;
    }
    const last = merged[merged.length - 1];
    if (r.from <= last.to) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ from: r.from, to: r.to });
    }
    if (merged.length >= max) break;
  }
  return merged;
}

/**
 * Walk the document text content once and find the next occurrence of
 * `needle` starting strictly after `searchFrom`. Returns the document
 * position of the match, or null if not found.
 */
function findNextOccurrence(state: PMEditorState, searchFrom: number, needle: string): number | null {
  if (!needle) return null;
  let found: number | null = null;
  let charPos = 0;
  state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (!node.isText || typeof node.text !== 'string') {
      return true;
    }
    const text = node.text;
    const startInText = Math.max(0, searchFrom - charPos);
    const local = text.indexOf(needle, startInText);
    if (local >= 0 && charPos + local >= searchFrom) {
      found = pos + local;
      return false;
    }
    charPos += text.length;
    return true;
  });
  return found;
}

/**
 * Get the word (Latin \w + Chinese [一-龥]) under the current cursor
 * if the selection is empty. Returns null if no word.
 */
function getCurrentWord(state: PMEditorState): string | null {
  const { $from } = state.selection;
  const text = $from.parent.textContent;
  const offset = $from.parentOffset;
  let start = offset;
  let end = offset;
  while (start > 0 && /[\w一-龥]/.test(text[start - 1])) start--;
  while (end < text.length && /[\w一-龥]/.test(text[end])) end++;
  if (start === end) return null;
  return text.slice(start, end);
}