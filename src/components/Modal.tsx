import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Generic centered modal used for one-shot dialogs (e.g. UpdaterPanel).
 *
 * Behavior:
 *  - Renders nothing when `open` is false.
 *  - Clicking the backdrop closes the modal.
 *  - Clicks inside the panel do NOT bubble to the backdrop (the panel
 *    stops propagation in its own onClick).
 *  - Pressing Escape closes the modal.
 *  - The Escape listener is bound only while the modal is open and is
 *    cleaned up on unmount or when `open` flips back to false.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="modal-title">{title}</h2>}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}