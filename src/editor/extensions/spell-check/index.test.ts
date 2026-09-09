import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { SpellCheck, _testInjectMisspellings, _testOffsetMap } from './index';
import { DecorationSet } from '@tiptap/pm/view';

function makeEditor(content: string, opts?: { enabled?: boolean; lang?: 'en-US' | 'zh-CN' }) {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      SpellCheck.configure({
        enabled: opts?.enabled ?? false,
        lang: opts?.lang ?? 'en-US',
      }),
    ],
    content,
  });
}

function findSpellPlugin(e: Editor) {
  for (const p of e.state.plugins) {
    const k = (p.spec as { key?: { key: string } }).key?.key;
    if (k && k.startsWith('spellCheck')) return p;
  }
  return undefined;
}

describe('SpellCheck extension', () => {
  it('registers without errors', () => {
    const e = makeEditor('<p>hello world</p>');
    expect(findSpellPlugin(e)).toBeDefined();
    e.destroy();
  });

  it('exposes empty misspellings storage by default', () => {
    const e = makeEditor('<p>hi</p>');
    expect((e.storage.spellCheck as { misspellings: unknown[] }).misspellings).toEqual([]);
    e.destroy();
  });

  it('renders zero decorations when misspellings list is empty', () => {
    const e = makeEditor('<p>hello world</p>');
    const plugin = findSpellPlugin(e);
    expect(plugin).toBeDefined();
    const decoSet = (plugin!.spec as unknown as { props: { decorations(state: unknown): DecorationSet } }).props.decorations(
      e.state,
    );
    expect(decoSet.find().length).toBe(0);
    e.destroy();
  });

  it('renders .spell-error decorations when misspellings are injected', () => {
    const e = makeEditor('<p>recieve</p>');
    _testInjectMisspellings(e, [
      { word: 'recieve', from: 0, to: 7, suggestions: ['receive'] },
    ]);
    const plugin = findSpellPlugin(e);
    const decoSet = (plugin!.spec as unknown as { props: { decorations(state: unknown): DecorationSet } }).props.decorations(
      e.state,
    );
    const found = decoSet.find();
    expect(found.length).toBe(1);
    const cls = (found[0] as unknown as { type: { attrs: { class: string } } }).type.attrs.class;
    expect(cls).toBe('spell-error');
    e.destroy();
  });

  it('multi-block doc maps char offsets to PM positions inside text nodes', () => {
    // Two paragraphs: <p>foo</p><p>bar</p>. doc.textContent is "foo\nbar"
    // (char offsets 0..6). Inside the first paragraph 'foo' lives at
    // PM positions 1..4; inside the second paragraph 'bar' lives at
    // positions 6..9 (a paragraph-open token adds 1 between blocks).
    const e = makeEditor('<p>foo</p><p>bar</p>');
    const map = _testOffsetMap(e.state.doc);
    // 'foo' chars 0..2 → PM positions 1..3
    expect(map.get(0)).toBe(1);
    expect(map.get(1)).toBe(2);
    expect(map.get(2)).toBe(3);
    // 'b' of 'bar' at char offset 4 (3 chars + 1 '\n') → PM pos 6.
    expect(map.get(4)).toBe(6);
    expect(map.get(5)).toBe(7);
    expect(map.get(6)).toBe(8);
    e.destroy();
  });
});
