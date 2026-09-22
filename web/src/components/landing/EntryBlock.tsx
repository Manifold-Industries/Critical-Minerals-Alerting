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
//
// The type and spacing here are sized to keep the whole screen — masthead, info
// strip, and footer — inside one viewport on a laptop, so the entry block is
// never something a reader has to scroll past.
export default function EntryBlock({ onEnter }: EntryBlockProps) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-6 text-center">
      <Image
        src={EMBLEM_SRC}
        alt=""
        width={EMBLEM_SIZE}
        height={EMBLEM_SIZE}
        priority
        className="h-24 w-24 select-none"
      />

      <div className="flex flex-col items-center gap-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
          {ORG_EYEBROW}
        </p>
        <h1 className="font-mono text-[clamp(30px,4.2vw,54px)] font-semibold uppercase leading-none tracking-[0.02em] text-foreground">
          {SYSTEM_NAME}
        </h1>
        <p className="text-[15px] leading-[1.5] text-text-secondary">
          {SYSTEM_SUBLINE}
        </p>
      </div>

      <button
        type="button"
        onClick={onEnter}
        className="mt-1 inline-flex items-center gap-3 bg-accent px-10 py-3 font-mono text-[15px] font-semibold uppercase tracking-[0.12em] text-surface-0 transition-colors duration-150 hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {ENTER_LABEL}
        <IconArrowRight size={18} stroke={2.2} aria-hidden="true" />
      </button>

      <p className="font-mono text-[13px] text-text-tertiary">{ENTER_HELPER}</p>
    </div>
  );
}
