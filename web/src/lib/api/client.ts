/** The only place the API is called. Every response is zod-validated. */
import { graphEnvelopeSchema } from "@/lib/api/schemas";
import type { GraphData } from "@/lib/api/types";

export class ApiError extends Error {}

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not configured — cannot reach the API.");
  }
  return url.replace(/\/$/, "");
}

export async function fetchGraph(signal?: AbortSignal): Promise<GraphData> {
  const base = apiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${base}/graph`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(`API unreachable at ${base} — is the API running?`);
  }
  if (!response.ok) {
    throw new ApiError(`API returned HTTP ${response.status} for /graph.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("API returned a non-JSON response for /graph.");
  }

  const parsed = graphEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue ? issue.path.join(".") : "unknown";
    throw new ApiError(`Unexpected /graph response shape at "${path}": ${issue?.message ?? ""}`);
  }
  if (!parsed.data.success || parsed.data.data === null) {
    throw new ApiError(parsed.data.error ?? "API reported failure with no error message.");
  }
  return parsed.data.data;
}
