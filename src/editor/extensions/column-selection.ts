import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, SelectionRange, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { EditorState as PMEditorState, Transaction } from '@tiptap/pm/state';
import { DecorationSet, Decoration } from '@tiptap/pm/view';

/**
 * Column (rectangle) selection via Alt+drag.
 *
 * TipTap has no built-in column selection, so we implement it directly
 * via a ProseMirror Plugin + Decoration. The plugin listens for
 * Alt+MouseDown to start a drag, samples the y-coordinate on MouseMove
 * to identify affected visual lines, and on each move dispatches a
 * multi-range selection that covers the same column slice in every line
 * touched by the drag. Decoration highlights each range with the
 * `.column-selection` class so the rectangle is visible.
 */
export const ColumnSelection = Extension.create({
  name: 'columnSelection',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('columnSelection'),
        props: {
          handleDOMEvents: {
            mousedown(view: EditorView, event: MouseEvent) {
              if (!event.altKey || event.button !== 0) return false;
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (!pos || typeof pos.pos !== 'number') return false;
              // Store anchor as transient plugin state. We can't use a
              // PM state field here because we need to read the
              // pointer position on every mouse move (per-event, not
              // per-transaction), so a closure variable is the simplest
              // approach.
              pluginState.dragging = {
                anchor: pos.pos,
                startClientX: event.clientX,
                startClientY: event.clientY,
              };
              // Seed the selection with the anchor point so the user
              // sees feedback immediately (even before any drag).
              applyColumnSelection(view, pos.pos, pos.pos, pos.pos);
              event.preventDefault();
              return true;
            },

            mousemove(view: EditorView, event: MouseEvent) {
              if (!pluginState.dragging) return false;
              const start = view.posAtCoords({
                left: pluginState.dragging.startClientX,
                top: pluginState.dragging.startClientY,
              });
              const end = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              if (!start || !end || typeof start.pos !== 'number' || typeof end.pos !== 'number') {
                return false;
              }
              applyColumnSelection(view, pluginState.dragging.anchor, start.pos, end.pos);
              return false;
            },

            mouseup(_view: EditorView, _event: MouseEvent) {
              pluginState.dragging = null;
              return false;
            },

            // If the cursor leaves the editor while dragging, clear state.
            mouseleave(_view: EditorView, _event: MouseEvent) {
              if (pluginState.dragging) {
                pluginState.dragging = null;
              }
              return false;
            },
          },

          decorations(state: PMEditorState): DecorationSet {
            const sel = state.selection;
            if (sel.ranges.length <= 1) return DecorationSet.empty;
            const decos = sel.ranges.map((r) =>
              Decoration.inline(r.$from.pos, r.$to.pos, { class: 'column-selection' }),
            );
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

/**
 * Module-level drag state. ProseMirror plugins are per-editor but the
 * Alt+drag gesture spans multiple DOM events that need to share
 * pointer coordinates, so we use a closure variable scoped to this
 * extension module. (If multiple editors exist with their own plugin
 * instances, the last drag wins — acceptable since the user can only
 * drag in one editor at a time.)
 */
const pluginState: { dragging: { anchor: number; startClientX: number; startClientY: number } | null } = {
  dragging: null,
};

/**
 * Apply a column-selection-style multi-range selection. Given the
 * anchor pos (where the user first pressed) and the current cursor pos,
 * sample the y-coordinate between the two and, for every visual line
 * in between, slice the column range and dispatch a multi-range
 * selection.
 *
 * Exported so unit tests can exercise the math without going through
 * the DOM event handlers (jsdom doesn't implement real layout).
 */
export function applyColumnSelection(
  view: EditorView,
  anchorPos: number,
  startPos: number,
  endPos: number,
): void {
  const ranges = computeColumnRanges(view, anchorPos, startPos, endPos);
  if (ranges.length === 0) return;
  const tr: Transaction = view.state.tr;
  const selectionRanges = ranges.map((r) => {
    const $from = view.state.doc.resolve(r.from);
    const $to = view.state.doc.resolve(r.to);
    return new SelectionRange($from, $to);
  });
  // Build a TextSelection from the primary range, then manually
  // override its `ranges` array so multi-range rendering works without
  // instantiating the abstract `Selection` directly.
  const $anchor = selectionRanges[0].$from;
  const $head = selectionRanges[selectionRanges.length - 1].$to;
  const selection = TextSelection.create(view.state.doc, $anchor.pos, $head.pos);
  Object.defineProperty(selection, 'ranges', {
    value: selectionRanges,
    enumerable: true,
  });
  tr.setSelection(selection);
  view.dispatch(tr);
}

/**
 * Compute the per-line column ranges that make up a rectangle selection.
 *
 * The rectangle is bounded by the y-coordinates of `startPos` and
 * `endPos`. For each visual line within that y-range, we determine
 * the start and end column offset (relative to the line's left edge)
 * based on the position of `anchorPos` and the moving edge, then
 * translate that back to absolute document positions.
 *
 * The result is one `[from, to]` per line; identical adjacent lines
 * (rare but possible in nested blocks) are deduplicated by position.
 */
export function computeColumnRanges(
  view: EditorView,
  anchorPos: number,
  startPos: number,
  endPos: number,
): Array<{ from: number; to: number }> {
  const state = view.state;
  if (anchorPos < 0 || anchorPos > state.doc.content.size) return [];
  if (startPos < 0 || startPos > state.doc.content.size) return [];
  if (endPos < 0 || endPos > state.doc.content.size) return [];

  const anchorCoords = view.coordsAtPos(anchorPos);
  const startCoords = view.coordsAtPos(startPos);
  const endCoords = view.coordsAtPos(endPos);
  if (!anchorCoords || !startCoords || !endCoords) return [];

  const minY = Math.min(startCoords.top, endCoords.top);
  const maxY = Math.max(startCoords.bottom, endCoords.bottom);
  // Anchor column offset (from the line's left edge) is fixed for the
  // whole drag — that's the "rectangle" property.
  const anchorCol = getColumnOffset(state, anchorPos);

  const ranges: Array<{ from: number; to: number }> = [];
  const seenLineStarts = new Set<number>();

  // Sample every 4px on the y-axis. This matches the cursor-line height
  // (most editors use ~20px line height) closely enough to never miss
  // a line without being expensive.
  for (let y = minY; y <= maxY; y += 4) {
    const probe = view.posAtCoords({
      left: view.dom.getBoundingClientRect().left + 1,
      top: y,
    });
    if (!probe || typeof probe.pos !== 'number') continue;

    // Resolve to the enclosing textblock. Skip if we're inside a nested
    // block (listItem / blockquote / etc.) — column rectangles across
    // block boundaries get visually confusing and aren't a common
    // editor pattern.
    const $pos = state.doc.resolve(probe.pos);
    if (!$pos.parent || !$pos.parent.isTextblock) continue;
    const blockDepth = $pos.depth;
    if (blockDepth > 0) continue;

    // Compute the column offset at the moving edge for this line.
    const edgeCol = getColumnOffset(state, probe.pos);
    const minCol = Math.min(anchorCol, edgeCol);
    const maxCol = Math.max(anchorCol, edgeCol);

    // Translate column offsets back to positions within this line.
    const lineStart = $pos.start();
    const lineText = $pos.parent.textContent;
    const lineLen = lineText.length;
    const from = lineStart + Math.min(minCol, lineLen);
    const to = lineStart + Math.min(maxCol, lineLen);
    if (from === to) continue;

    const key = lineStart;
    if (seenLineStarts.has(key)) continue;
    seenLineStarts.add(key);
    ranges.push({ from, to });
  }

  return ranges;
}

/**
 * The character offset of `pos` within its enclosing textblock.
 */
function getColumnOffset(state: PMEditorState, pos: number): number {
  const $pos = state.doc.resolve(pos);
  return $pos.parentOffset;
}

// Suppress unused warnings for TextSelection import — it is used via the
// selection machinery but not directly referenced in source.
void TextSelection;