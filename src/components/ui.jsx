import { useEffect, useId, useRef } from "react";
import { formatMoney, formatMoneyShort } from "../lib/money.js";

export function Logo({ size = 34 }) {
  // Decorative: the adjacent wordmark text carries the name, so the mark
  // stays out of the accessibility tree instead of doubling it.
  return (
    <svg
      className="wordmark-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#0b0d10" />
      <rect x="12" y="34" width="10" height="18" rx="2" fill="#ff5c00" />
      <rect x="27" y="24" width="10" height="28" rx="2" fill="#f7f5f0" />
      <rect x="42" y="14" width="10" height="38" rx="2" fill="#ff5c00" />
    </svg>
  );
}

export function Money({ minor, currency, short = false, signed = false, className }) {
  const text = short
    ? formatMoneyShort(minor, currency)
    : formatMoney(minor, currency);
  return <span className={className}>{signed && minor > 0 ? `+${text}` : text}</span>;
}

export function CatDot({ color, label }) {
  return (
    <span
      className="cat-dot"
      style={{ backgroundColor: color || "var(--text-3)" }}
      aria-hidden="true"
      title={label}
    />
  );
}

export function Bar({ ratio, color, over = false, label }) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div
      className="bar-track"
      role="img"
      aria-label={label || `${Math.round(pct)}%`}
    >
      <div
        className={over ? "bar-fill is-over" : "bar-fill"}
        style={{
          transform: `scaleX(${pct / 100})`,
          backgroundColor: over ? undefined : color,
        }}
      />
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <h3 className="empty-state-title">{title}</h3>
      {children}
      {action}
    </div>
  );
}

/**
 * Accessible modal built on the native <dialog> element: Escape closes,
 * focus is trapped by the browser's top-layer behaviour, and the first
 * field is focused on open.
 */
export function Modal({ open, title, onClose, labelledBy, children }) {
  const ref = useRef(null);
  const autoId = useId();
  // Unique per instance: several dialogs share the DOM (closed ones stay
  // rendered), so a fixed id would duplicate.
  const titleId = labelledBy || autoId;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const focusTarget = dialog.querySelector("[data-autofocus]");
      if (focusTarget) focusTarget.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open ]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        // Let the native cancel (Escape) close the dialog; onClose fires.
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-inner">
        <h2 className="dialog-title" id={titleId}>
          {title}
        </h2>
        <button
          type="button"
          className="icon-button dialog-close"
          onClick={onClose}
          aria-label="Close dialog"
          title="Close dialog"
        >
          <span aria-hidden="true">×</span>
        </button>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel, danger = false }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mt-12 muted">{body}</p>
      <div className="dialog-actions mt-20">
        <button type="button" className="button" onClick={onCancel}>
          Keep it
        </button>
        <button
          type="button"
          className={danger ? "button button-danger" : "button button-primary"}
          onClick={onConfirm}
          data-autofocus
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
