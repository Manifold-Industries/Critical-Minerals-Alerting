"use client";

import { useEffect, type ReactNode } from "react";

import { useFocusTrap } from "@/lib/landing/useFocusTrap";

interface ModalShellProps {
  /** Id of the element naming the dialog, for `aria-labelledby`. */
  readonly titleId: string;
  readonly onDismiss: () => void;
  /** Width cap and padding for the panel; the two modals differ only in these. */
  readonly panelClassName: string;
  readonly children: ReactNode;
}

// Backdrop plus a focused, dismissable panel. Every modal on the landing screen
// is built from this one so they cannot drift apart on keyboard behaviour.
export default function ModalShell({
  titleId,
  onDismiss,
  panelClassName,
  children,
}: ModalShellProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(onDismiss);

  // The screen behind the backdrop must not scroll under it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`blueprint flex max-h-full w-full flex-col focus:outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
