import EntryBlock from "@/components/landing/EntryBlock";
import FooterLinks from "@/components/landing/FooterLinks";
import InfoStrip from "@/components/landing/InfoStrip";

// The front door. A single screen between the marking bars the root layout
// draws: the entry block fills the height, then the info strip and statutory
// links close it out.
export default function HomePage() {
  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
      <div className="flex w-full max-w-[1200px] flex-col px-[clamp(20px,5vw,72px)]">
        <section className="flex flex-1 items-center justify-center py-[clamp(16px,4vh,56px)]">
          <EntryBlock />
        </section>
        <InfoStrip />
        <FooterLinks />
      </div>
    </div>
  );
}
