import type { Metadata } from "next";

import BriefDocument from "@/components/brief/BriefDocument";
import BriefIndex from "@/components/brief/BriefIndex";
import { ALERTS } from "@/lib/monitor/alerts";
import { parseBriefParams } from "@/lib/monitor/briefLink";
import { formatZulu } from "@/lib/zulu";

export const metadata: Metadata = {
  title: "Decision Brief",
};

// The brief is addressed entirely by its URL - which alert, which simulation
// year, which weights - so a link reproduces the document, and the monitor can
// open one in a new tab without handing state across.
export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const request = parseBriefParams(await searchParams, ALERTS);
  if (!request.alert) return <BriefIndex problem={request.problem} />;

  return (
    <BriefDocument
      alert={request.alert}
      year={request.year}
      weights={request.weights}
      problem={request.problem}
      // Stamped here, on the server, so the markup the client hydrates agrees
      // with what was sent. A brief is a snapshot; its time should not tick.
      generatedAt={formatZulu(new Date())}
    />
  );
}
