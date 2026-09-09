import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import i18n from '../i18n';
import { SpellPanel, charOffsetToPmPos } from './SpellPanel';
import { SpellCheck, _testInjectMisspellings } from '../editor/extensions/spell-check';

beforeEach(async () => {
  // Wait for the singleton i18n (initialised in src/i18n/index.ts) to
  // finish loading so useTranslation() returns real strings instead of
  // raw keys.
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on('initialized', () => resolve());
      if (i18n.isInitialized) resolve();
    });
  }
  await i18n.changeLanguage('en-US');
});

function makeEditor(content: string) {
  return new Editor({
    extensions: [StarterKit.configure({ codeBlock: false }), SpellCheck],
    content,
  });
}

describe('SpellPanel', () => {
  it('renders no-document hint when editor is null', () => {
    render(<SpellPanel editor={null} misspellings={[]} />);
    expect(screen.getByText(/open a file/i)).toBeDefined();
  });

  it('renders dictionary-unavailable hint when flag set', () => {
    const e = makeEditor('<p>hello</p>');
    render(<SpellPanel editor={e} misspellings={[]} dictionaryUnavailable />);
    expect(screen.getByText(/dictionary failed to load/i)).toBeDefined();
    e.destroy();
  });

  it('renders no-errors message when misspellings is empty', () => {
    const e = makeEditor('<p>hello</p>');
    render(<SpellPanel editor={e} misspellings={[]} />);
    expect(screen.getByText(/no spelling issues/i)).toBeDefined();
    e.destroy();
  });

  it('lists misspellings and shows suggestions on click', () => {
    const e = makeEditor('<p>recieve</p>');
    _testInjectMisspellings(e, [
      { word: 'recieve', from: 0, to: 7, suggestions: ['receive', 'recite'] },
    ]);
    render(
      <SpellPanel
        editor={e}
        misspellings={[
          { word: 'recieve', from: 0, to: 7, suggestions: ['receive', 'recite'] },
        ]}
      />,
    );
    const wordBtn = screen.getByTestId('spell-word');
    expect(wordBtn.textContent).toContain('recieve');
    fireEvent.click(wordBtn);
    const items = screen.getAllByTestId('spell-suggest-item');
    expect(items.map((el) => el.textContent)).toEqual(['receive', 'recite']);
    e.destroy();
  });

  it('replace() callback calls insertContentAt with the suggestion', () => {
    const e = makeEditor('<p>recieve</p>');
    _testInjectMisspellings(e, [
      { word: 'recieve', from: 0, to: 7, suggestions: ['receive'] },
    ]);
    const spy = vi.fn();
    // The TipTap command API is generated each access; spy on the
    // single underlying dispatch path instead.
    const originalDispatch = e.view.dispatch.bind(e.view);
    e.view.dispatch = (tr) => {
      spy(tr);
      originalDispatch(tr);
    };
    render(
      <SpellPanel
        editor={e}
        misspellings={[
          { word: 'recieve', from: 0, to: 7, suggestions: ['receive'] },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('spell-word'));
    fireEvent.click(screen.getByTestId('spell-suggest-item'));
    expect(spy).toHaveBeenCalled();
    e.destroy();
  });
});

describe('charOffsetToPmPos', () => {
  it('maps single-block offsets to PM positions', () => {
    const e = makeEditor('<p>recieve</p>');
    // 'recieve' lives at PM positions 1..7
    expect(charOffsetToPmPos(e, 0)).toBe(1);
    expect(charOffsetToPmPos(e, 7)).toBe(8);
    e.destroy();
  });

  it('maps multi-block offsets with implicit \\n separator', () => {
    const e = makeEditor('<p>foo</p><p>bar</p>');
    // 'foo' chars 0..2 → positions 1..3; 'bar' chars 4..6 → positions 6..8
    expect(charOffsetToPmPos(e, 0)).toBe(1);
    expect(charOffsetToPmPos(e, 4)).toBe(6);
    e.destroy();
  });
});
