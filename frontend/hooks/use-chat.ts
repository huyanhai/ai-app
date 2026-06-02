import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageType } from "@/components/chat/types";
import { parseSseLine } from "@/lib/sse";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface SendParams {
  text: string;
  files?: { name: string; content: string; type: string; url: string }[];
}

function applyEvent(
  msg: MessageType,
  event: Record<string, unknown>,
  assistantMsgId: string,
): MessageType {
  if (msg.id !== assistantMsgId) return msg;

  switch (event.type) {
    case "msg_chunk":
      return { ...msg, content: msg.content + (event.content ?? "") };

    case "tool_start": {
      const existingCalls = msg.toolCalls ?? [];
      if (existingCalls.some((tc) => tc.id === event.id)) return msg;
      return {
        ...msg,
        toolCalls: [
          ...existingCalls,
          {
            id: event.id as string,
            name: event.name as string,
            input: event.input,
            status: "running" as const,
          },
        ],
      };
    }

    case "tool_end": {
      const existingCalls = msg.toolCalls ?? [];
      return {
        ...msg,
        toolCalls: existingCalls.map((tc) =>
          tc.id === event.id
            ? { ...tc, status: "completed" as const, output: event.output }
            : tc,
        ),
      };
    }

    case "tool_error": {
      const existingCalls = msg.toolCalls ?? [];
      return {
        ...msg,
        toolCalls: existingCalls.map((tc) =>
          tc.id === event.id
            ? { ...tc, status: "error" as const, error: event.error as string }
            : tc,
        ),
      };
    }

    default:
      return msg;
  }
}

export function useChat() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationKey: ["chat"],
    mutationFn: async ({ text, files }: SendParams) => {
      const assistantMsgId = Math.random().toString(36).slice(7);

      setMessages((prev) => {
        const userMsgId = Math.random().toString(36).slice(7);
        return [
          ...prev,
          {
            id: userMsgId,
            role: "user" as const,
            content: text,
            attachments: files
              ? files.map((f) => ({ name: f.name, url: f.url, type: f.type }))
              : undefined,
          },
          {
            id: assistantMsgId,
            role: "assistant" as const,
            content: "",
            toolCalls: [],
          },
        ];
      });

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const response = await fetch(`${API_BASE}/ai/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            message: text,
            files: files
              ? files.map((f) => ({
                  name: f.name,
                  content: f.content,
                  type: f.type,
                }))
              : undefined,
          }),
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

            setMessages((prev) =>
              prev.map((msg) => applyEvent(msg, event, assistantMsgId)),
            );
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    "Sorry, an error occurred while processing your request.",
                }
              : msg,
          ),
        );
        throw error;
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
      }
    },
  });

  const send = useCallback(
    (params: SendParams) => {
      if (mutation.isPending) return;
      mutation.mutate(params);
    },
    [mutation],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return {
    messages,
    send,
    stop,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: () => {
      setMessages([]);
      mutation.reset();
    },
  };
}
