import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

interface PromptModalProps {
  open: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  okLabel: string;
  cancelLabel: string;
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
 */
export function PromptModal({
  open,
  title,
  message,
  defaultValue = '',
  placeholder,
  okLabel,
  cancelLabel,
  validate,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value when the modal opens so each prompt starts fresh.
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setError(null);
      // Defer focus so the Modal's animation/portal has rendered.
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, defaultValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('empty');
      return;
    }
    const err = validate?.(trimmed);
    if (err) {
      setError(err);
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="prompt-modal-body">
        {message && <p className="prompt-modal-message">{message}</p>}
        <input
          ref={inputRef}
          type="text"
          className="prompt-modal-input"
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
          data-testid="prompt-input"
        />
        {error && error !== 'empty' && (
          <div className="prompt-modal-error">{error}</div>
        )}
        {error === 'empty' && (
          <div className="prompt-modal-error">文件名不能为空</div>
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
