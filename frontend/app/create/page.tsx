"use client";

import { useState } from "react";
import { useVimaxPipeline } from "@/hooks/use-vimax-pipeline";
import { PipelineProgress } from "@/components/create/pipeline-progress";

export default function CreatePage() {
  const [idea, setIdea] = useState("");
  const [userRequirement, setUserRequirement] = useState("");
  const {
    steps,
    isRunning,
    error,
    startPipeline,
    stop,
    reset,
    isPending,
  } = useVimaxPipeline();

  const handleGenerate = () => {
    if (!idea.trim()) return;
    startPipeline(idea.trim(), userRequirement.trim() || undefined);
  };

  const canGenerate = idea.trim().length > 0 && !isPending && !isRunning;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Create
        </h1>
        <p className="mt-1 text-sm text-muted">
          Generate video content from an idea using an automated pipeline
        </p>
      </div>

      {/* Input section */}
      <div className="mb-8 space-y-4">
        <div>
          <label
            htmlFor="idea"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Idea <span className="text-red-500">*</span>
          </label>
          <textarea
            id="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Enter your story idea..."
            disabled={isRunning}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="userRequirement"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Additional Requirements{" "}
            <span className="text-xs text-muted">(optional)</span>
          </label>
          <textarea
            id="userRequirement"
            value={userRequirement}
            onChange={(e) => setUserRequirement(e.target.value)}
            placeholder="E.g., target audience, genre, style preferences..."
            disabled={isRunning}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-lg border border-red-400 bg-white px-6 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              Stop
            </button>
          )}

          {!isRunning && steps.some((s) => s.status !== "pending") && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border"
            >
              Reset
            </button>
          )}

          {isRunning && (
            <span className="inline-flex items-center text-sm text-accent">
              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-accent" />
              Processing...
            </span>
          )}
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Pipeline progress */}
      <PipelineProgress steps={steps} isRunning={isRunning} />
    </div>
  );
}
