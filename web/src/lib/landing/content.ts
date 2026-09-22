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

// The standard DoD notice-and-consent banner text, shown before sign-in.
export const CONSENT_EYEBROW = "Notice and consent";
export const CONSENT_TITLE = "U.S. Government information system";

// Stands above the notice, outside the scrolling area, so the disclaimer cannot
// be missed: agreeing to a verbatim federal consent banner is the one moment on
// this screen where a reader could take the prototype for the real thing.
export const CONSENT_DEMO_NOTE =
  "This is a demonstration prototype, not an actual Department of War system. The notice below is reproduced for realism and has no legal effect.";
export const CONSENT_BODY =
  "You are accessing a U.S. Government (USG) Information System (IS) that is provided for USG-authorized use only. By using this IS (which includes any device attached to this IS), you consent to the following conditions:";

export const CONSENT_TERMS: readonly string[] = [
  "The USG routinely intercepts and monitors communications on this IS for purposes including, but not limited to, penetration testing, COMSEC monitoring, network operations and defense, personnel misconduct, law enforcement, and counterintelligence investigations.",
  "At any time, the USG may inspect and seize data stored on this IS.",
  "Communications using, or data stored on, this IS are not private, are subject to routine monitoring, interception, and search, and may be disclosed or used for any USG-authorized purpose.",
  "This IS includes security measures — such as authentication and access controls — to protect USG interests, not for your personal benefit or privacy.",
];

export const CONSENT_CANCEL = "Cancel";
export const CONSENT_AGREE = "I agree · Enter system";
