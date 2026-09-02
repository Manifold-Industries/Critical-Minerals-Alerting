const CLASSIFICATION_LABEL = "UNCLASSIFIED";

// #007A33 is the standard banner green for UNCLASSIFIED (CUI Notice 2019-01).
const BANNER_COLOR = "#007A33";

export default function ClassificationBanner() {
  return (
    <div
      role="banner"
      className="w-full py-1 text-center font-mono text-xs font-bold tracking-[0.35em] text-white"
      style={{ backgroundColor: BANNER_COLOR }}
    >
      {CLASSIFICATION_LABEL}
    </div>
  );
}
