import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import './PromptModal.css';

interface PromptModalProps {
  open: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  okLabel: string;
  cancelLabel: string;
  /** Error messages keyed by code (so callers can pass i18n strings):
   *  - 'empty': the value is empty/whitespace-only
   *  - 'invalid': custom validation message returned from `validate()` */
  emptyError?: string;
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Inline React replacement for `window.prompt`. window.prompt is
 * unreliable inside Tauri 2 / WebView2 (silently swallowed on some
 * platform builds), so we render our own input inside the shared
 * Modal component instead. Keeps keyboard semantics (Enter submits,
 * Esc cancels) consistent with the rest of the app.
 *
 * UX details:
 *  - Autofocus + select on open so the default value is highlighted
 *    and the user can immediately type to replace it.
 *  - Input is reset to `defaultValue` every time the modal opens,
 *    so re-triggering the menu doesn't carry over the previous entry.
 *  - Empty / invalid values get an inline error and the input gets a
 *    red border + danger-coloured shadow ring.
 */
export function PromptModal({
  open,
  title,
  message,
  defaultValue = '',
  placeholder,
  okLabel,
  cancelLabel,
  emptyError,
  validate,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + autofocus + select on open.
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setError(null);
      // Defer focus so the Modal's animation has rendered.
      const id = window.setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          // Highlight the default value (e.g. "untitled") so the user
          // can immediately type to overwrite without backspacing.
          el.select();
        }
      }, 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open, defaultValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(emptyError ?? 'empty');
      return;
    }
    const err = validate?.(trimmed);
    if (err) {
      setError(err);
      return;
    }
    onConfirm(trimmed);
  };

  const errorMessage = error === 'empty' ? emptyError : error;

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="prompt-modal-body">
        {message && <p className="prompt-modal-message">{message}</p>}
        <input
          ref={inputRef}
          type="text"
          className={`prompt-modal-input${error ? ' has-error' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            // Esc is handled by Modal's window listener — don't double-fire.
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          aria-invalid={error ? true : undefined}
          data-testid="prompt-input"
        />
        {errorMessage && (
          <div className="prompt-modal-error" role="alert" data-testid="prompt-error">
            {errorMessage}
          </div>
        )}
        <div className="prompt-modal-actions">
          <button type="button" onClick={onCancel} data-testid="prompt-cancel">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            className="prompt-modal-ok"
            data-testid="prompt-ok"
          >
            {okLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
