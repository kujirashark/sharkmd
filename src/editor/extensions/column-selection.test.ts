import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ColumnSelection } from './column-selection';

function makeEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, ColumnSelection],
    content,
  });
}

function findColumnPlugin(e: Editor) {
  for (const p of e.state.plugins) {
    const k = (p.spec as { key?: { key: string } }).key?.key;
    if (k && (k === 'columnSelection' || k.startsWith('columnSelection$'))) {
      return p;
    }
  }
  return undefined;
}

describe('ColumnSelection', () => {
  it('extension registers without errors', () => {
    const e = makeEditor('<p>line1</p><p>line2</p><p>line3</p>');
    expect(findColumnPlugin(e)).toBeDefined();
    e.destroy();
  });

  it('keeps the single-range selection when nothing drags', () => {
    // We can't simulate real layout in jsdom (posAtCoords uses
    // elementFromPoint which jsdom doesn't implement). The pure-function
    // coverage of the rectangle math is implicit: the extension is
    // exercised end-to-end through Playwright in Phase 2 E2E. Here we
    // just verify the plugin doesn't crash the editor and that the
    // default selection state is single-range.
    const e = makeEditor('<p>line1</p><p>line2</p><p>line3</p>');
    expect(e.state.selection.ranges.length).toBe(1);
    expect(e.state.selection.empty).toBe(true);
    e.destroy();
  });

  it('exposes handleDOMEvents for mousedown/mousemove/mouseup', () => {
    const e = makeEditor('<p>hello</p>');
    const plugin = findColumnPlugin(e);
    expect(plugin).toBeDefined();
    if (!plugin) return;
    const candidates: unknown[] = [
      (plugin.spec as { props?: { handleDOMEvents?: Record<string, unknown> } }).props?.handleDOMEvents,
      (plugin as unknown as { props?: { handleDOMEvents?: Record<string, unknown> } }).props?.handleDOMEvents,
    ];
    const handlers = candidates.find(
      (c): c is Record<string, unknown> => !!c && typeof (c as Record<string, unknown>).mousedown === 'function',
    );
    expect(handlers).toBeDefined();
    expect(typeof handlers?.mousemove).toBe('function');
    expect(typeof handlers?.mouseup).toBe('function');
    e.destroy();
  });
});