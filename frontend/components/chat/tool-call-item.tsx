import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { ToolCallType } from "./types";

interface ToolCallItemProps {
  toolCall: ToolCallType;
}

export function ToolCallItem({ toolCall }: ToolCallItemProps) {
  const displayName = toolCall.name === "simple_web_search" 
    ? "Web Search" 
    : toolCall.name === "complex_web_search" 
      ? "Deep Web Browse" 
      : toolCall.name;

  const stateLabel = toolCall.status === "running" 
    ? "Executing..." 
    : toolCall.status === "completed" 
      ? "Completed" 
      : "Error";

  return (
    <Tool defaultOpen={toolCall.status !== "completed"} className="my-2">
      <ToolHeader 
        title={displayName}
        type="button"
        toolName={toolCall.name}
        state={stateLabel}
        className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      />
      <ToolContent>
        {toolCall.input && <ToolInput input={toolCall.input} />}
        {toolCall.status === "completed" && toolCall.output && (
          <ToolOutput 
            output={
              typeof toolCall.output === "object" 
                ? <pre className="overflow-x-auto text-[11px] leading-5 text-slate-600 dark:text-slate-400 max-h-48 scrollbar-thin">{JSON.stringify(toolCall.output, null, 2)}</pre>
                : <span className="text-xs text-slate-600 dark:text-slate-400">{String(toolCall.output)}</span>
            } 
          />
        )}
        {toolCall.status === "error" && toolCall.error && (
          <ToolOutput errorText={toolCall.error} />
        )}
      </ToolContent>
    </Tool>
  );
}
