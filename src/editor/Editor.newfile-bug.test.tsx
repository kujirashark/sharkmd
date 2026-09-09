import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { Editor } from './Editor';
import type { Editor as TiptapEditor } from '@tiptap/core';

/**
 * Regression: after v0.4 added SpellCheck extension, the user reported
 * "File → New" did nothing. The handler gates on `if (!editor) return;`
 * so the symptom is editor being null in AppLayout state.
 *
 * Two failure modes to cover:
 *   1. Editor mounts but onEditorReady is never called (throws inside
 *      TipTap during extension init).
 *   2. Editor mounts but the rendered <EditorContent /> never appears.
 */
describe('<Editor> mount with SpellCheck (v0.4)', () => {
  it('onEditorReady fires within the timeout', async () => {
    const initial = { type: 'doc', content: [{ type: 'paragraph' }] };
    let captured: TiptapEditor | null = null;
    render(
      <StrictMode>
        <Editor
          value={initial}
          onChange={() => {}}
          onEditorReady={(e) => (captured = e)}
        />
      </StrictMode>,
    );
    // Wait one tick for useEffect to fire onEditorReady.
    await new Promise((r) => setTimeout(r, 50));
    expect(captured).toBeTruthy();
  });

  it('renders ProseMirror root even with spellcheck enabled=false', async () => {
    const initial = { type: 'doc', content: [{ type: 'paragraph' }] };
    const { container } = render(
      <StrictMode>
        <Editor
          value={initial}
          onChange={() => {}}
        />
      </StrictMode>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('.ProseMirror')).toBeTruthy();
  });

  it('mounts with spellcheck enabled=true (would create a worker)', async () => {
    const initial = { type: 'doc', content: [{ type: 'paragraph' }] };
    let captured: TiptapEditor | null = null;
    render(
      <StrictMode>
        <Editor
          value={initial}
          onChange={() => {}}
          onEditorReady={(e) => (captured = e)}
          spellcheckEnabled
          spellcheckLang="en-US"
        />
      </StrictMode>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(captured).toBeTruthy();
  });
});
