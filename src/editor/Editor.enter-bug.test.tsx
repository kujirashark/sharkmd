import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { Editor } from './Editor';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';

/**
 * Reproduce the user-reported bug: pressing Enter in the controlled
 * <Editor> doesn't split the paragraph.
 *
 * The single-command regression test in Editor.test.tsx uses
 * `captured.commands.splitBlock()` directly which bypasses the React
 * controlled-mode path entirely. We must dispatch a real DOM keydown
 * event against the rendered .ProseMirror element AND make the
 * component act like a real consumer (parent owns `value`, swaps it on
 * onChange). Only then do we exercise the race between PM's transaction
 * and React's re-render of the controlled value.
 */
function dispatchEnter(editor: TiptapEditor) {
  const dom = editor.view.dom as HTMLElement;
  // PM's editable root is .ProseMirror; dispatch a real keyboard event on it.
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });
  dom.dispatchEvent(event);
}

describe('<Editor> Enter in controlled mode', () => {
  it('Enter via real keydown splits the paragraph', async () => {
    const initial: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    };
    let captured: TiptapEditor | null = null;
    render(
      <Editor
        value={initial}
        onChange={() => {}}
        onEditorReady={(e) => (captured = e)}
      />,
    );
    expect(captured).toBeTruthy();
    act(() => {
      captured!.commands.focus('end');
    });
    act(() => {
      dispatchEnter(captured!);
    });
    const doc = captured!.getJSON();
    expect(doc.content!.length).toBe(2);
  });

  it('Enter via real keydown in controlled mode (parent re-renders)', () => {
    const initial: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    };
    let captured: TiptapEditor | null = null;
    render(
      <ControlledEditorWithCapture initial={initial} onReady={(e) => (captured = e)} />,
    );
    expect(captured).toBeTruthy();
    act(() => {
      captured!.commands.focus('end');
    });
    act(() => {
      dispatchEnter(captured!);
    });
    const doc = captured!.getJSON();
    // After controlled-mode Enter, the doc should have 2 paragraphs.
    expect(doc.content!.length).toBe(2);
  });
});

function ControlledEditorWithCapture({
  initial,
  onReady,
}: {
  initial: JSONContent;
  onReady: (e: TiptapEditor) => void;
}) {
  const [value, setValue] = useState<JSONContent>(initial);
  return (
    <div>
      <Editor value={value} onChange={setValue} onEditorReady={onReady} />
      <pre data-testid="doc">{JSON.stringify(value)}</pre>
    </div>
  );
}
