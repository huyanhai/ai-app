import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { parseSseLine } from "./sse-utils";
import {
  createInitialSteps,
  type PipelineStepState,
  type PipelineStepName,
  type VimaxEvent,
} from "@/components/create/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface PipelineParams {
  idea: string;
  userRequirement?: string;
}

function applyEvent(
  steps: PipelineStepState[],
  event: Record<string, unknown>,
): PipelineStepState[] {
  switch (event.type) {
    case "vimax_step_start": {
      const step = event.step as PipelineStepName;
      return steps.map((s) =>
        s.name === step ? { ...s, status: "running" as const } : s,
      );
    }
    case "vimax_step_complete": {
      const step = event.step as PipelineStepName;
      return steps.map((s) =>
        s.name === step
          ? { ...s, status: "completed" as const, result: event.result }
          : s,
      );
    }
    case "vimax_step_error": {
      const step = event.step as PipelineStepName;
      return steps.map((s) =>
        s.name === step
          ? { ...s, status: "error" as const, error: event.error as string }
          : s,
      );
    }
    case "vimax_sub_step": {
      const step = event.step as PipelineStepName;
      return steps.map((s) =>
        s.name === step
          ? {
              ...s,
              progress: {
                current: event.current as number,
                total: event.total as number,
              },
            }
          : s,
      );
    }
    default:
      return steps;
  }
}

export function useVimaxPipeline() {
  const [steps, setSteps] = useState<PipelineStepState[]>(() =>
    createInitialSteps(),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationKey: ["vimax_pipeline"],
    mutationFn: async ({ idea, userRequirement }: PipelineParams) => {
      setSteps(createInitialSteps());
      setIsRunning(true);
      setError(null);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const response = await fetch(`${API_BASE}/ai/pipeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({ idea, userRequirement }),
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parseSseLine(line);
            if (!event) continue;

            const typed = event as VimaxEvent;

            if (
              typed.type === "vimax_complete" ||
              typed.type === "vimax_error"
            ) {
              setIsRunning(false);
              if (typed.type === "vimax_error") {
                setError(typed.error);
              }
              continue;
            }

            setSteps((prev) => applyEvent(prev, event));
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
        setIsRunning(false);
        throw err;
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
      }
    },
  });

  const startPipeline = useCallback(
    (idea: string, userRequirement?: string) => {
      if (mutation.isPending) return;
      mutation.mutate({ idea, userRequirement });
    },
    [mutation],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setSteps(createInitialSteps());
    setIsRunning(false);
    setError(null);
    mutation.reset();
  }, [mutation]);

  return {
    steps,
    isRunning,
    error,
    startPipeline,
    stop,
    reset,
    isPending: mutation.isPending,
  };
}
