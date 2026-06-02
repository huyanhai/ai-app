import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { MessageType } from "./types";
import { ToolCallItem } from "./tool-call-item";
import { SourcesList } from "./sources-list";
import { Markdown } from "@/components/markdown";
import { User, Bot, FileIcon } from "lucide-react";

interface MessageItemProps {
  message: MessageType;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  const searchResults = message.toolCalls
    ? message.toolCalls
        .filter(
          (tc) =>
            tc.status === "completed" &&
            tc.output &&
            Array.isArray(tc.output.results),
        )
        .flatMap((tc) => tc.output.results)
    : [];

  const content = (message.content || "").trim();
  const isLoading = !isUser && !content;
  const hasRunningTool =
    message.toolCalls &&
    message.toolCalls.some((tc) => tc.status === "running");
  const displayContent = content || (hasRunningTool ? "Thinking..." : "");

  return (
    <Message from={message.role} className="items-start gap-3 px-2">
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <MessageContent
        className={
          isUser
            ? "bg-blue-600 text-white dark:bg-blue-700"
            : "bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 bg-white"
        }
      >
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="mb-3 flex items-center overflow-x-auto pb-2">
            {message.attachments.map((att, i) => {
              const isImage = att.type.startsWith("image/");
              return (
                <div
                  key={i}
                  className="relative transition-transform duration-200 hover:z-40 hover:-translate-y-1"
                  style={{ zIndex: i + 1, marginLeft: i === 0 ? 0 : "-64px" }}
                >
                  <div className="flex w-55 items-center gap-2 rounded-xl border border-white/20 bg-white/20 p-2 text-xs text-white shadow-[0_8px_24px_rgba(15,23,42,0.25)] backdrop-blur-md dark:border-white/10 dark:bg-white/10">
                    {isImage ? (
                      <img
                        src={att.url}
                        alt={att.name}
                        className="max-h-10 max-w-10 rounded object-cover border border-white/20 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/20 text-white shadow-sm">
                        <FileIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-white/90">
                        {att.name}
                      </span>
                      <span className="truncate text-[10px] text-white/60">
                        {isImage ? "Image" : "Document"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3 space-y-2">
            {message.toolCalls.map((tc) => (
              <ToolCallItem key={tc.id || tc.name} toolCall={tc} />
            ))}
          </div>
        )}

        {!isUser && searchResults.length > 0 && (
          <SourcesList results={searchResults} />
        )}

        {isLoading ? (
          <div className="flex items-center gap-1.5 py-2 px-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500" />
          </div>
        ) : (
          displayContent && (
            <MessageResponse
              className={
                isUser ? "text-white" : "text-slate-800 dark:text-slate-200"
              }
            >
              {isUser ? displayContent : <Markdown>{displayContent}</Markdown>}
            </MessageResponse>
          )
        )}
      </MessageContent>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <User className="h-5 w-5" />
        </div>
      )}
    </Message>
  );
}
