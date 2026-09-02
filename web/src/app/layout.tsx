import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import ClassificationBanner from "@/components/ClassificationBanner";
import CommandHeader from "@/components/CommandHeader";
import NavRail from "@/components/NavRail";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Terminal chrome — data readouts, labels, and command text.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Critical Minerals Alerting",
  description:
    "Supply chain disruption alerting console for critical minerals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col">
        <ClassificationBanner />
        <CommandHeader />
        <div className="flex min-h-0 flex-1">
          <NavRail />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </div>
        <ClassificationBanner />
      </body>
    </html>
  );
}
