import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Editor } from './Editor';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';

describe('<Editor>', () => {
  it('mounts with initial content and reports changes', () => {
    const initial: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
    const onChange = vi.fn();
    const { container } = render(<Editor value={initial} onChange={onChange} />);
    expect(container.querySelector('.ProseMirror')).toBeTruthy();
  });

  // Regression: v0.2 Task #92 — clicking the toolbar "⊞ 表格" used to wipe
  // the document because the controlled-mode setContent replay overwrote the
  // just-inserted table. Now insertTable must leave existing content intact.
  it('insertTable preserves preceding paragraphs', () => {
    const initial: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'A paragraph before the table.' }] },
      ],
    };
    let captured: TiptapEditor | null = null;
    render(
      <Editor value={initial} onChange={() => {}} onEditorReady={(e) => (captured = e)} />,
    );
    expect(captured).toBeTruthy();
    act(() => {
      captured!.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    });
    const doc = captured!.getJSON();
    // Title + paragraph + table → at least 3 top-level blocks.
    expect(doc.content!.length).toBeGreaterThanOrEqual(3);
    expect(doc.content!.some((n: any) => n.type === 'heading')).toBe(true);
    expect(doc.content!.some((n: any) => n.type === 'paragraph')).toBe(true);
    expect(doc.content!.some((n: any) => n.type === 'table')).toBe(true);
  });

  // Regression: v0.2 Task #93 — Enter key stopped splitting paragraphs after
  // the math NodeView was added (its root <div> lacked contentEditable={false},
  // breaking the editor's contentEditable inheritance chain). Pressing Enter
  // now must produce a fresh paragraph below.
  it('Enter splits the current paragraph into two', () => {
    const initial: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    };
    let captured: TiptapEditor | null = null;
    render(
      <Editor value={initial} onChange={() => {}} onEditorReady={(e) => (captured = e)} />,
    );
    expect(captured).toBeTruthy();
    // Move cursor to end and split.
    act(() => {
      captured!.commands.focus('end');
      captured!.commands.splitBlock();
    });
    const doc = captured!.getJSON();
    expect(doc.content!.length).toBe(2);
    expect((doc.content![0] as any).content?.[0]?.text).toBe('Hello world');
    // Second block is a fresh empty paragraph.
    expect(doc.content![1].type).toBe('paragraph');
  });
});
