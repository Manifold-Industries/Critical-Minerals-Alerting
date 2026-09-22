"use client";

import {
  AUTH_BODY,
  AUTH_CANCEL,
  AUTH_EYEBROW,
} from "@/lib/landing/content";
import ModalShell from "./ModalShell";

const TITLE_ID = "authenticating-modal-title";

interface AuthenticatingModalProps {
  readonly onCancel: () => void;
}

// Shown while the credential exchange is in flight. It reports progress and
// offers one way out; it is not a prompt, so there is nothing to confirm.
export default function AuthenticatingModal({
  onCancel,
}: AuthenticatingModalProps) {
  return (
    <ModalShell
      titleId={TITLE_ID}
      onDismiss={onCancel}
      panelClassName="max-w-[440px] gap-3 p-8"
    >
      <p
        id={TITLE_ID}
        className="flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent"
      >
        <span aria-hidden="true" className="live-square" />
        {AUTH_EYEBROW}
      </p>
      <p aria-live="polite" className="text-sm leading-[1.5] text-text-secondary">
        {AUTH_BODY}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="self-start font-mono text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary transition-colors duration-150 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {AUTH_CANCEL}
      </button>
    </ModalShell>
  );
}
