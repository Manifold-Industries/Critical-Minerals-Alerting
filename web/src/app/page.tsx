import FooterLinks from "@/components/landing/FooterLinks";
import InfoStrip from "@/components/landing/InfoStrip";
import LandingScreen from "@/components/landing/LandingScreen";
import UtilityBar from "@/components/landing/UtilityBar";

// The front door. A single screen between the marking bars the root layout
// draws: utility bar, the entry block filling what is left, then the info strip
// and statutory links.
export default function HomePage() {
  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
      <div className="flex w-full max-w-[1200px] flex-col px-[clamp(20px,5vw,72px)]">
        <UtilityBar />
        <LandingScreen />
        <InfoStrip />
        <FooterLinks />
      </div>
    </div>
  );
}
