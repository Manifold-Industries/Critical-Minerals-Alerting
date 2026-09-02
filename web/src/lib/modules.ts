import {
  IconAffiliate,
  IconBell,
  IconGlobe,
  IconNews,
  type Icon,
} from "@tabler/icons-react";

export interface ModuleDefinition {
  readonly name: string;
  readonly href: string;
  readonly icon: Icon;
  readonly disabled: boolean;
}

// Alerts is the only live module; the rest are staged placeholders until
// their screens land.
export const MODULES: readonly ModuleDefinition[] = [
  { name: "Alerts", href: "/alerts", icon: IconBell, disabled: false },
  { name: "Atlas", href: "/atlas", icon: IconGlobe, disabled: true },
  { name: "Supply", href: "/supply", icon: IconAffiliate, disabled: true },
  { name: "Sources", href: "/sources", icon: IconNews, disabled: true },
];

export const DEFAULT_MODULE_HREF = "/alerts";
