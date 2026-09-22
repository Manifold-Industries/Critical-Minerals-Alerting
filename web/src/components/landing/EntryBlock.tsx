import { IconArrowRight } from "@tabler/icons-react";
import Image from "next/image";

import {
  EMBLEM_SIZE,
  EMBLEM_SRC,
  ENTER_HELPER,
  ENTER_LABEL,
  ORG_EYEBROW,
  SYSTEM_NAME,
  SYSTEM_SUBLINE,
} from "@/lib/landing/content";

interface EntryBlockProps {
  readonly onEnter: () => void;
}

// The masthead: seal, name, and the one control on the screen. Centred column,
// capped at 760px so the title breaks in the same place as the subline.
export default function EntryBlock({ onEnter }: EntryBlockProps) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-7 text-center">
      <Image
        src={EMBLEM_SRC}
        alt=""
        width={EMBLEM_SIZE}
        height={EMBLEM_SIZE}
        priority
        className="h-28 w-28 select-none"
      />

      <div className="flex flex-col items-center gap-3.5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
          {ORG_EYEBROW}
        </p>
        <h1 className="font-mono text-[clamp(44px,6.4vw,84px)] font-semibold uppercase leading-none tracking-[0.02em] text-foreground">
          {SYSTEM_NAME}
        </h1>
        <p className="text-[15px] leading-[1.5] text-text-secondary">
          {SYSTEM_SUBLINE}
        </p>
      </div>

      <button
        type="button"
        onClick={onEnter}
        className="mt-3 inline-flex items-center gap-3 bg-accent px-10 py-3.5 font-mono text-base font-semibold uppercase tracking-[0.12em] text-surface-0 transition-colors duration-150 hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {ENTER_LABEL}
        <IconArrowRight size={18} stroke={2.2} aria-hidden="true" />
      </button>

      <p className="font-mono text-[13px] text-text-tertiary">{ENTER_HELPER}</p>
    </div>
  );
}
