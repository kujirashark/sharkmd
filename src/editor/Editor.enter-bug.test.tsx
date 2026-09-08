import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { Editor } from './Editor';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';

/**
 * Reproduce user-reported Enter bugs:
 *  - bug A: Enter doesn't split the paragraph (MarkdownInputRules was
 *    throwing "find is not a function" — fixed by rewriting to use
 *    TipTap's InputRule).
 *  - bug B: Enter splits but the split gets clobbered by a stale
 *    setContent replay (React 18 batching / StrictMode + controlled
 *    mode race).
 *
 * Tests dispatch a real DOM keydown event against the rendered
 * .ProseMirror element AND wrap in StrictMode to mimic production.
 * They also use a controlled parent so the value prop is swapped on
 * onChange, exercising the race between PM's transaction and React's
 * commit.
 */

function dispatchEnter(editor: TiptapEditor) {
  const dom = editor.view.dom as HTMLElement;
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

function waitMicro(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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

describe('<Editor> Enter in controlled + StrictMode', () => {
  it('Enter via real keydown splits the paragraph (no StrictMode)', async () => {
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
    await act(async () => {
      await waitMicro();
    });
    const doc = captured!.getJSON();
    expect(doc.content!.length).toBe(2);
  });

  it('Enter via real keydown splits the paragraph under StrictMode (production config)', async () => {
    const initial: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    };
    let captured: TiptapEditor | null = null;
    render(
      <StrictMode>
        <ControlledEditorWithCapture initial={initial} onReady={(e) => (captured = e)} />
      </StrictMode>,
    );
    expect(captured).toBeTruthy();
    act(() => {
      captured!.commands.focus('end');
    });
    act(() => {
      dispatchEnter(captured!);
    });
    await act(async () => {
      await waitMicro();
      await waitMicro();
    });
    const doc = captured!.getJSON();
    expect(doc.content!.length).toBe(2);
  });

  it('Type then Enter preserves typed text in second paragraph', async () => {
    const initial: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
    let captured: TiptapEditor | null = null;
    render(
      <StrictMode>
        <ControlledEditorWithCapture initial={initial} onReady={(e) => (captured = e)} />
      </StrictMode>,
    );
    expect(captured).toBeTruthy();
    act(() => {
      captured!.commands.focus();
    });
    act(() => {
      captured!.commands.insertContent('abc');
    });
    await act(async () => {
      await waitMicro();
    });
    act(() => {
      captured!.commands.focus('end');
      dispatchEnter(captured!);
    });
    await act(async () => {
      await waitMicro();
      await waitMicro();
    });
    const doc = captured!.getJSON();
    expect(doc.content!.length).toBe(2);
    expect((doc.content![0] as any).content?.[0]?.text).toBe('abc');
  });

  // The reported regression: user creates a new file, the Editor mounts
  // with EMPTY_DOC, the parent then passes the actual content via the
  // value prop, useEffect setContent runs, then the user immediately
  // presses Enter.
  it('Switch value prop to non-empty doc, then Enter, must not clobber', async () => {
    let setValueRef: ((v: JSONContent) => void) | null = null;
    let captured: TiptapEditor | null = null;
    function Wrapper() {
      const [value, setValue] = useState<JSONContent>({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });
      setValueRef = setValue;
      return <Editor value={value} onChange={() => {}} onEditorReady={(e) => (captured = e)} />;
    }
    render(
      <StrictMode>
        <Wrapper />
      </StrictMode>,
    );
    expect(captured).toBeTruthy();
    await act(async () => {
      setValueRef!({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
        ],
      });
      await waitMicro();
      await waitMicro();
    });
    act(() => {
      captured!.commands.focus('end');
      dispatchEnter(captured!);
    });
    await act(async () => {
      await waitMicro();
      await waitMicro();
    });
    const doc = captured!.getJSON();
    expect(doc.content!.length).toBe(2);
    expect((doc.content![0] as any).content?.[0]?.text).toBe('Hello world');
  });

  // Type character-by-character then Enter, mimicking real keystrokes.
  it('Sequential typing + Enter under StrictMode preserves state', async () => {
    let captured: TiptapEditor | null = null;
    render(
      <StrictMode>
        <ControlledEditorWithCapture
          initial={{ type: 'doc', content: [{ type: 'paragraph' }] }}
          onReady={(e) => (captured = e)}
        />
      </StrictMode>,
    );
    expect(captured).toBeTruthy();
    act(() => {
      captured!.commands.focus();
    });
    for (const ch of ['a', 'b', 'c']) {
      act(() => {
        captured!.commands.insertContent(ch);
      });
      await act(async () => {
        await waitMicro();
      });
    }
    act(() => {
      captured!.commands.focus('end');
      dispatchEnter(captured!);
    });
    await act(async () => {
      await waitMicro();
      await waitMicro();
    });
    const doc = captured!.getJSON();
    expect(doc.content!.length).toBe(2);
    expect((doc.content![0] as any).content?.[0]?.text).toBe('abc');
  });
});
