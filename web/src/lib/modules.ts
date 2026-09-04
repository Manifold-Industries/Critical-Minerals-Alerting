import {
  IconBell,
  IconFileText,
  IconGlobe,
  IconTriangle,
  type Icon,
} from "@tabler/icons-react";

export interface ModuleDefinition {
  readonly name: string;
  readonly href: string;
  readonly icon: Icon;
  readonly disabled: boolean;
}

// Workflow order per spec: Explore → Monitor → Strategize → Brief, fusing the
// Decomposition Prototype modules (Atlas, Cascade, Prism, Forge) with the
// critical-minerals alerting workflow. Monitor and Brief are live; the rest
// are staged placeholders until their screens land.
export const MODULES: readonly ModuleDefinition[] = [
  { name: "Explore", href: "/explore", icon: IconGlobe, disabled: true },
  { name: "Monitor", href: "/monitor", icon: IconBell, disabled: false },
  {
    name: "Strategize",
    href: "/strategize",
    icon: IconTriangle,
    disabled: true,
  },
  { name: "Brief", href: "/brief", icon: IconFileText, disabled: false },
];

export const DEFAULT_MODULE_HREF = "/monitor";
