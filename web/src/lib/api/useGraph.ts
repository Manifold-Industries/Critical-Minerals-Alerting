/** Client hook owning the /graph fetch lifecycle: loading, error, retry. */
import { useCallback, useEffect, useState } from "react";
import { fetchGraph } from "@/lib/api/client";
import type { GraphData } from "@/lib/api/types";

export type GraphState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; graph: GraphData };

export function useGraph(): { state: GraphState; retry: () => void } {
  const [state, setState] = useState<GraphState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchGraph(controller.signal)
      .then((graph) => setState({ status: "ready", graph }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ status: "error", message });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((previous) => previous + 1);
  }, []);
  return { state, retry };
}
