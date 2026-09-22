// Copy for the landing screen. Kept out of the components so the wording can be
// reviewed in one place — every string here is public-facing text an owner will
// want to edit without touching layout.

export interface LandingLink {
  readonly label: string;
  readonly href: string;
}

export interface InfoColumn {
  readonly label: string;
  readonly body: string;
  readonly link?: LandingLink;
}

// Routes for the support pages do not exist yet. "#" keeps the anchors inert
// rather than pointing readers at a 404; swap in real paths as they land.
const PENDING = "#";

export const ORG_EYEBROW = "Department of War";
export const SYSTEM_NAME = "Mineral Intelligence Center";
export const SYSTEM_SUBLINE =
  "Office of the Assistant Secretary of War for Industrial Base Policy";
// The office's own emblem, in public/. Decorative on this screen: the eyebrow,
// title, and subline beside it already name the office the seal identifies, so
// it carries an empty alt rather than repeating them to a screen reader.
export const EMBLEM_SRC = "/ASWIBP.png";
export const EMBLEM_SIZE = 112;

export const ENTER_LABEL = "Enter System";
// CAC / PIV sign-in is not built yet, so the helper says so rather than
// claiming a credential check the system does not perform.
export const ENTER_HELPER =
  "CAC / PIV sign-in coming soon · No credential required yet";

export const INFO_COLUMNS: readonly InfoColumn[] = [
  {
    label: "Mission",
    body: "Detect disruption across critical mineral supply chains and turn it into decisions the industrial base can act on.",
  },
  {
    label: "Access",
    body: "Department of War personnel, federal partners, and cleared contractors. Sponsored accounts become mandatory once sign-in is enabled.",
    link: { label: "Request an account", href: PENDING },
  },
  {
    label: "Support",
    body: "Credential, certificate, and sign-in problems are handled by the operations desk.",
    link: { label: "Access help desk", href: PENDING },
  },
];

export const FOOTER_LINKS: readonly LandingLink[] = [
  { label: "Accessibility", href: PENDING },
  { label: "FOIA", href: PENDING },
  { label: "No FEAR Act", href: PENDING },
  { label: "Privacy & Security", href: PENDING },
  { label: "USA.gov", href: "https://www.usa.gov" },
];
