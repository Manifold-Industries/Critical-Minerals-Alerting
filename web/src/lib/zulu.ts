// Zulu (UTC) timestamp in DoD date-time-group style, e.g. "201430Z AUG 2026".
export function formatZulu(now: Date): string {
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const month = now
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const year = now.getUTCFullYear();
  return `${day}${hours}${minutes}Z ${month} ${year}`;
}
