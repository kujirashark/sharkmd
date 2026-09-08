import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MultiCursor } from './multi-cursor';

function makeEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, MultiCursor],
    content,
  });
}

/**
 * Read the per-editor PM state field. TipTap's editor.storage.multiCursor
 * is shared across editor instances when the same MultiCursor extension
 * object is reused, which leaks state between tests; the plugin's state
 * field is per-editor and safe.
 */
function ranges(e: Editor): Array<{ from: number; to: number }> {
  for (const plugin of e.state.plugins) {
    if ((plugin.spec as { key?: { key: string } }).key?.key === 'multiCursorRanges$') {
      return (plugin.getState(e.state) as { ranges: Array<{ from: number; to: number }> }).ranges;
    }
  }
  return [];
}

describe('MultiCursor', () => {
  it('accumulates ranges on repeated selectNextOccurrence', () => {
    const e = makeEditor('<p>foo foo foo</p>');
    e.commands.setTextSelection({ from: 1, to: 4 });
    e.commands.selectNextOccurrence();
    expect(ranges(e).length).toBe(2);
    e.commands.selectNextOccurrence();
    expect(ranges(e).length).toBe(3);
    e.destroy();
  });

  it('multi-range selection is reflected in state.selection.ranges', () => {
    const e = makeEditor('<p>foo foo foo</p>');
    e.commands.setTextSelection({ from: 1, to: 4 });
    e.commands.selectNextOccurrence();
    expect(e.state.selection.ranges.length).toBe(2);
    e.destroy();
  });

  it('clearCursors collapses to a single range and empties ranges', () => {
    const e = makeEditor('<p>foo foo</p>');
    e.commands.setTextSelection({ from: 1, to: 4 });
    e.commands.selectNextOccurrence();
    expect(ranges(e).length).toBe(2);
    e.commands.clearCursors();
    expect(ranges(e).length).toBe(0);
    expect(e.state.selection.ranges.length).toBe(1);
    expect(e.state.selection.empty).toBe(true);
    e.destroy();
  });

  it('dedupes overlapping/adjacent ranges', () => {
    const e = makeEditor('<p>hello world</p>');
    e.commands.setTextSelection({ from: 1, to: 4 });
    e.commands.addCursor(3); // overlaps with [1,4)
    const r = ranges(e);
    expect(r.length).toBe(1);
    expect(r[0].from).toBe(1);
    expect(r[0].to).toBe(4);
    e.destroy();
  });

  it('respects MAX_RANGES limit', () => {
    const e = makeEditor('<p>' + 'a'.repeat(150) + '</p>');
    for (let i = 1; i <= 150; i++) {
      e.commands.addCursor(i);
    }
    expect(ranges(e).length).toBeLessThanOrEqual(100);
    e.destroy();
  });

  it('selectNextOccurrence with empty selection finds word at cursor', () => {
    const e = makeEditor('<p>hello world hello</p>');
    e.commands.setTextSelection({ from: 3, to: 3 });
    e.commands.selectNextOccurrence();
    const r = ranges(e);
    expect(r.length).toBe(1);
    expect(r[0].from).toBeGreaterThanOrEqual(1);
    e.destroy();
  });

  it('selectNextOccurrence returns false when no further match exists', () => {
    const e = makeEditor('<p>foo</p>');
    e.commands.setTextSelection({ from: 1, to: 4 });
    const result = e.commands.selectNextOccurrence();
    expect(result).toBe(false);
    e.destroy();
  });

  it('addCursorAtSelection adds the current selection', () => {
    const e = makeEditor('<p>foo foo</p>');
    e.commands.setTextSelection({ from: 1, to: 4 });
    e.commands.addCursorAtSelection();
    const r = ranges(e);
    expect(r.length).toBe(1);
    expect(r[0].from).toBe(1);
    expect(r[0].to).toBe(4);
    e.destroy();
  });
});