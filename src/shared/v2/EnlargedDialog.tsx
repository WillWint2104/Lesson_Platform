/**
 * @file EnlargedDialog.tsx — THE shared enlarged-content dialog (lesson register;
 * design-language-v2 §7c + §13 addendum).
 *
 * Enlarged views exist for READABILITY: one component owns the scrim (dim +
 * blur), the mint-strip card, the header (mono kicker + Close), the centered
 * single column, and the footer Prev/Next — used by BOTH the question focus
 * view and the notes expanded view so they cannot drift.
 *
 * A11y: role=dialog + aria-modal, focus moves in on open and returns to the
 * opener on close, Tab is trapped (both directions), Esc closes (always, even
 * while typing). Outside text inputs: ← → drive Prev/Next and other keys are
 * offered to `onShortcut` (e.g. the focus view's S-for-solution).
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X, ArrowLeft, ArrowRight } from "lucide-react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface EnlargedDialogProps {
  /** Accessible name AND the header kicker text (e.g. "Question 2 of 4"). */
  label: string;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  /** Footer navigation; a missing handler renders that button disabled. */
  onPrev?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  /** Extra single-key shortcuts (fired outside text inputs, lowercase key). */
  onShortcut?: (key: string) => void;
  children: ReactNode;
}

export function EnlargedDialog({
  label,
  onClose,
  returnFocusTo,
  onPrev,
  onNext,
  prevLabel = "Previous",
  nextLabel = "Next",
  onShortcut,
  children,
}: EnlargedDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const restore = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    cardRef.current?.focus();
    return () => {
      if (restore && typeof restore.focus === "function") restore.focus();
    };
    // The opener is captured once at open; intentionally not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    const focusables = Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === cardRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Tab") {
      trapTab(e);
      return;
    }
    // Don't hijack keys while typing in a field — caret movement + characters
    // must work normally (Esc above still closes).
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }
    if (e.key === "ArrowRight") {
      onNext?.();
    } else if (e.key === "ArrowLeft") {
      onPrev?.();
    } else {
      onShortcut?.(e.key.toLowerCase());
    }
  }

  return (
    <div
      className="focus-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="focus-card v2-panel enlarged-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={cardRef}
        onKeyDown={onKeyDown}
      >
        <div className="v2-panel__strip" aria-hidden="true" />
        <div className="focus-card__bar">
          <span className="focus-card__count v2-mono">{label}</span>
          <button type="button" className="focus-card__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" /> Close
          </button>
        </div>

        {/* Centered single readability column (~560px) — nothing left-stranded. */}
        <div className="focus-card__body enlarged-dialog__body">{children}</div>

        <div className="focus-card__nav">
          <button
            type="button"
            className="v2-btn v2-btn--ghost"
            disabled={!onPrev}
            onClick={() => onPrev?.()}
          >
            <ArrowLeft size={18} aria-hidden="true" /> {prevLabel}
          </button>
          <button
            type="button"
            className="v2-btn v2-btn--ghost"
            disabled={!onNext}
            onClick={() => onNext?.()}
          >
            {nextLabel} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
