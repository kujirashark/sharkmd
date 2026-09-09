import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';
import i18n from '../i18n';

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on('initialized', () => resolve());
      if (i18n.isInitialized) resolve();
    });
  }
  await i18n.changeLanguage('en-US');
});

describe('<Modal>', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        <p>content</p>
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title + children when open', () => {
    render(
      <Modal open onClose={() => {}} title="My title">
        <p>body text</p>
      </Modal>,
    );
    expect(screen.getByText('My title')).toBeTruthy();
    expect(screen.getByText('body text')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('omits header when no title is provided', () => {
    render(
      <Modal open onClose={() => {}}>
        <p>body</p>
      </Modal>,
    );
    // The dialog still renders, but no <h2> title.
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('closes when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="t">
        <p>x</p>
      </Modal>,
    );
    const backdrop = container.querySelector('.modal-backdrop') as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when the content panel itself is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="t">
        <p>clickable inner</p>
      </Modal>,
    );
    const panel = container.querySelector('.modal-panel') as HTMLElement;
    expect(panel).toBeTruthy();
    fireEvent.click(panel);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when Esc is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="t">
        <p>x</p>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not register Esc handler when closed', () => {
    const onClose = vi.fn();
    render(
      <Modal open={false} onClose={onClose}>
        <p>x</p>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes Esc listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal open onClose={onClose} title="t">
        <p>x</p>
      </Modal>,
    );
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});