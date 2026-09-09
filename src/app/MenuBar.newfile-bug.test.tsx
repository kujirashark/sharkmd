import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { MenuBar } from './MenuBar';

// Mock the Tauri client so saveFile resolves without touching IPC.
vi.mock('../tauri/client', () => ({
  tauri: {
    saveFile: vi.fn().mockResolvedValue({ mtimeMs: 0 }),
  },
}));

const baseProps = (overrides: Partial<Parameters<typeof MenuBar>[0]> = {}) => ({
  editor: null,
  onChooseDir: vi.fn(),
  onOpenFile: vi.fn(),
  activeId: null,
  showSidebar: true,
  showOutline: true,
  onToggleSidebar: vi.fn(),
  onToggleOutline: vi.fn(),
  onOpenFind: vi.fn(),
  spellcheckEnabled: false,
  onToggleSpell: vi.fn(),
  onCheckUpdate: vi.fn(),
  ...overrides,
});

/** Find a menu trigger button by its menu id (data attribute would be
 *  ideal, but MenuBar uses button text — instead we read the i18n key
 *  literal which `useTranslation` falls back to when no provider is
 *  mounted in tests). */
function clickMenuTrigger(container: HTMLElement, idx: number) {
  // First .menu-trigger is File, then Edit, Paragraph, Format, View, Theme, Language, Help.
  const triggers = container.querySelectorAll<HTMLButtonElement>('.menu-trigger');
  fireEvent.click(triggers[idx]);
}

describe('<MenuBar> File → New', () => {
  it('opens PromptModal even when editor is null (no open tab)', () => {
    const { container } = render(
      <StrictMode>
        <MenuBar {...baseProps({ editor: null })} />
      </StrictMode>,
    );

    // Open the "File" dropdown (index 0).
    clickMenuTrigger(container, 0);

    // Click the "New file" item — its id is `file-new` so we locate by
    // the (i18n-key literal) text the dropdown renders when no provider
    // is mounted.
    const items = container.querySelectorAll<HTMLButtonElement>('.menu-dropdown-item');
    // First dropdown item in the File menu is file-new.
    fireEvent.click(items[0]);

    // PromptModal must now be in the DOM with its testid input.
    const input = document.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
    expect(input).toBeTruthy();
    expect(input!.value).toBe('untitled.md');
  });

  it('clicking OK calls onOpenFile (the create-file callback chain)', async () => {
    const onOpenFile = vi.fn();
    const { container } = render(
      <StrictMode>
        <MenuBar {...baseProps({ editor: null, onOpenFile })} />
      </StrictMode>,
    );

    clickMenuTrigger(container, 0);
    const items = container.querySelectorAll<HTMLButtonElement>('.menu-dropdown-item');
    fireEvent.click(items[0]);

    const input = document.querySelector<HTMLInputElement>('[data-testid="prompt-input"]')!;
    fireEvent.change(input, { target: { value: 'new.md' } });
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="prompt-ok"]')!);
    });
    expect(onOpenFile).toHaveBeenCalled();
  });
});
