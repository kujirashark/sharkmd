import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptModal } from './PromptModal';

describe('<PromptModal>', () => {
  it('renders input + OK/Cancel and pre-fills with defaultValue', () => {
    render(
      <PromptModal
        open
        title="New file"
        defaultValue="untitled.md"
        okLabel="Create"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByTestId('prompt-input') as HTMLInputElement;
    expect(input.value).toBe('untitled.md');
    expect(screen.getByTestId('prompt-ok')).toHaveTextContent('Create');
    expect(screen.getByTestId('prompt-cancel')).toHaveTextContent('Cancel');
  });

  it('Enter submits with the trimmed value', () => {
    const onConfirm = vi.fn();
    render(
      <PromptModal
        open
        title="New file"
        defaultValue="foo"
        okLabel="Create"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('prompt-input'), { target: { value: '  bar.md  ' } });
    fireEvent.keyDown(screen.getByTestId('prompt-input'), { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('bar.md');
  });

  it('Esc cancels', () => {
    const onCancel = vi.fn();
    render(
      <PromptModal
        open
        title="New file"
        okLabel="Create"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('prompt-input'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('rejects empty input on OK', () => {
    const onConfirm = vi.fn();
    render(
      <PromptModal
        open
        title="New file"
        okLabel="Create"
        cancelLabel="Cancel"
        emptyError="Filename cannot be empty"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByTestId('prompt-input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('prompt-ok'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('prompt-error').textContent).toBe('Filename cannot be empty');
  });

  it('shows custom validation error and blocks submit', () => {
    const onConfirm = vi.fn();
    const validate = (v: string) => (v.includes(' ') ? 'no spaces allowed' : null);
    render(
      <PromptModal
        open
        title="New file"
        okLabel="Create"
        cancelLabel="Cancel"
        validate={validate}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('prompt-input'), { target: { value: 'a b' } });
    fireEvent.click(screen.getByTestId('prompt-ok'));
    expect(screen.getByText('no spaces allowed')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking OK with valid input fires onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <PromptModal
        open
        title="New file"
        okLabel="Create"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('prompt-input'), { target: { value: 'new.md' } });
    fireEvent.click(screen.getByTestId('prompt-ok'));
    expect(onConfirm).toHaveBeenCalledWith('new.md');
  });

  it('autofocuses the input on open', async () => {
    render(
      <PromptModal
        open
        title="New file"
        defaultValue="untitled.md"
        okLabel="Create"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    // setTimeout 0 in useEffect — flush microtasks.
    await new Promise((r) => setTimeout(r, 10));
    const input = screen.getByTestId('prompt-input');
    // jsdom doesn't simulate `input.select()` reliably (selectionStart/End
    // remain null), so we only verify focus here.
    expect(document.activeElement).toBe(input);
  });

  it('shows error with red border + danger role when validate fails', () => {
    render(
      <PromptModal
        open
        title="New file"
        okLabel="Create"
        cancelLabel="Cancel"
        validate={(v) => (v.includes(' ') ? 'no spaces' : null)}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('prompt-input'), { target: { value: 'a b' } });
    fireEvent.click(screen.getByTestId('prompt-ok'));
    const input = screen.getByTestId('prompt-input') as HTMLInputElement;
    expect(input.className).toContain('has-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errEl = screen.getByTestId('prompt-error');
    expect(errEl.textContent).toBe('no spaces');
    expect(errEl.getAttribute('role')).toBe('alert');
  });

  it('uses caller-provided emptyError message', () => {
    render(
      <PromptModal
        open
        title="New file"
        okLabel="Create"
        cancelLabel="Cancel"
        emptyError="Filename cannot be empty"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('prompt-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('prompt-ok'));
    expect(screen.getByTestId('prompt-error').textContent).toBe('Filename cannot be empty');
  });
});
