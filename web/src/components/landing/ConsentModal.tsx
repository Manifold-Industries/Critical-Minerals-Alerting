"use client";

import {
  CONSENT_AGREE,
  CONSENT_BODY,
  CONSENT_CANCEL,
  CONSENT_DEMO_NOTE,
  CONSENT_EYEBROW,
  CONSENT_TERMS,
  CONSENT_TITLE,
} from "@/lib/landing/content";
import ModalShell from "./ModalShell";

const TITLE_ID = "consent-modal-title";

interface ConsentModalProps {
  readonly onAgree: () => void;
  readonly onCancel: () => void;
}

// The notice a reader must accept before a credential is requested. The terms
// scroll inside the panel so the two actions stay reachable on a short screen.
export default function ConsentModal({
  onAgree,
  onCancel,
}: ConsentModalProps) {
  return (
    <ModalShell
      titleId={TITLE_ID}
      onDismiss={onCancel}
      panelClassName="max-w-[640px] gap-3 p-[clamp(20px,3vw,32px)]"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {CONSENT_EYEBROW}
      </p>
      <h2
        id={TITLE_ID}
        className="font-mono text-[26px] font-semibold uppercase leading-tight tracking-[0.02em] text-foreground"
      >
        {CONSENT_TITLE}
      </h2>

      <p className="border border-accent/40 bg-accent-tint px-3 py-2 text-[13px] leading-[1.45] text-accent">
        {CONSENT_DEMO_NOTE}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto text-[13px] leading-[1.5] text-text-secondary">
        <p>{CONSENT_BODY}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {CONSENT_TERMS.map((term) => (
            <li key={term} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[7px] h-px w-2.5 shrink-0 bg-accent" />
              <span>{term}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="border border-surface-2 px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary transition-colors duration-150 hover:border-text-tertiary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {CONSENT_CANCEL}
        </button>
        <button
          type="button"
          onClick={onAgree}
          className="bg-accent px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-surface-0 transition-colors duration-150 hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {CONSENT_AGREE}
        </button>
      </div>
    </ModalShell>
  );
}
