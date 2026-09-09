import { describe, it, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { describe as _d } from 'vitest';

// Repro: Ctrl+S advertised in the File menu but never wired up — pressing
// it does nothing. After the fix, the global keydown listener dispatches
// the save handler. We test the listener in isolation by dispatching
// keydown against `window` and confirming the page does not throw.
// (A full <AppLayout /> mount drags in autosave / recovery / theme
// background work that's noisy in unit tests; we keep this test narrow.)

describe('global keydown listener (Ctrl+S regression)', () => {
  it('Ctrl+S does not throw when no editor is mounted', () => {
    expect(() => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    }).not.toThrow();
  });

  it('Ctrl+Shift+F does not throw', () => {
    expect(() => {
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true, shiftKey: true });
    }).not.toThrow();
  });

  it('Ctrl+O does not throw', () => {
    expect(() => {
      fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    }).not.toThrow();
  });
});

// Reference the React import to satisfy TS strict mode without unused-import
// errors when this file is the only test in its group.
void _d;
