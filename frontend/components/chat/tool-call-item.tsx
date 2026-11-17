import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { ToolCallType } from "./types";

interface ToolCallItemProps {
  toolCall: ToolCallType;
}

export function ToolCallItem({ toolCall }: ToolCallItemProps) {
  const displayNames: Record<string, string> = {
    simple_web_search: "网页搜索",
    complex_web_search: "深度网页浏览",
    canvas_get_state: "读取画布",
    canvas_apply_ops: "修改画布",
    canvas_arrange: "整理布局",
    canvas_delete: "删除节点",
    canvas_inspect_image: "查看图片",
    canvas_inspect_video: "查看视频",
    canvas_capture_frame: "截取视频帧",
  };
  const displayName = displayNames[toolCall.name] ?? toolCall.name;

  const stateLabel = toolCall.status === "running" 
    ? "执行中..." 
    : toolCall.status === "completed" 
      ? "已完成" 
      : "执行失败";

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
