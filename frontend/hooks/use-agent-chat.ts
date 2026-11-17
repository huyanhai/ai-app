"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageType, SubjectReference } from "@/components/chat/types";
import { sseFetch } from "@/lib/sse";
import { applyEvent } from "./use-chat";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export type AgentSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
};

export type AgentFileInput = {
  name: string;
  content: string;
  type: string;
  url: string;
};

export type SendAgentMessage = {
  text: string;
  contentState?: string;
  modelId: string;
  files?: AgentFileInput[];
  skillIds?: string[];
  subjects?: SubjectReference[];
  mode: "agent" | "chat";
};

type AgentSessionDetail = AgentSessionSummary & {
  messages: {
    id: number;
    role: "user" | "assistant";
    content: string;
    contentState?: string;
    attachments?: MessageType["attachments"];
    subjects?: SubjectReference[];
    mode?: "agent" | "chat";
  }[];
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "会话请求失败");
  }
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
};

export function useAgentChat(canvasId = "default", options: {
  beforeSend?: () => number | undefined | Promise<number | undefined>;
  onCanvasChanged?: () => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
} = {}) {
  const activeSessionKey = `active-agent-session-id:${canvasId}`;
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    optionsRef.current.onBusyChange?.(isLoading);
    return () => optionsRef.current.onBusyChange?.(false);
  }, [isLoading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const selectCurrentSession = useCallback((id: string | null) => {
    currentSessionRef.current = id;
    setCurrentSessionId(id);
  }, []);

  const selectSession = useCallback(
    async (id: string) => {
      window.localStorage.setItem(activeSessionKey, id);
      selectCurrentSession(id);
      setMessages([]);
      setError("");
      try {
        const detail = await request<AgentSessionDetail>(
          `/agent/sessions/${id}`,
        );
        if (currentSessionRef.current !== id) return;
        setMessages(
          detail.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            contentState: message.contentState,
            attachments: message.attachments,
            subjects: message.subjects,
            mode: message.mode,
          })),
        );
      } catch (cause) {
        setError((cause as Error).message);
      }
    },
    [activeSessionKey, selectCurrentSession],
  );

  const loadSessions = useCallback(async () => {
    const list = await request<AgentSessionSummary[]>(`/agent/sessions?canvasId=${encodeURIComponent(canvasId)}`);
    setSessions(list);
    return list;
  }, [canvasId]);

  const loadSkills = useCallback(async () => {
    const list = await request<AgentSkill[]>("/agent/skills");
    setSkills(list);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        let [list] = await Promise.all([loadSessions(), loadSkills()]);
        const storedId = window.localStorage.getItem(activeSessionKey);
        if (canvasId !== "default" && storedId && !list.some((session) => session.id === storedId)) {
          const legacy = await request<AgentSessionSummary[]>("/agent/sessions?canvasId=default");
          if (legacy.some((session) => session.id === storedId)) {
            await request("/agent/sessions/claim-legacy", {
              method: "POST",
              body: JSON.stringify({ canvasId }),
            });
            list = await loadSessions();
          }
        }
        const initialId = list.some((session) => session.id === storedId)
          ? storedId
          : canvasId === "default"
            ? list[0]?.id
            : null;
        if (initialId) await selectSession(initialId);
        else {
          selectCurrentSession(null);
          setMessages([]);
        }
      } catch (cause) {
        setError((cause as Error).message);
      }
    };
    void initialize();
  }, [activeSessionKey, canvasId, loadSessions, loadSkills, selectCurrentSession, selectSession]);

  const createSession = useCallback(async () => {
    const session = await request<AgentSessionSummary>("/agent/sessions", {
      method: "POST",
      body: JSON.stringify({ canvasId }),
    });
    setSessions((current) => [session, ...current]);
    window.localStorage.setItem(activeSessionKey, session.id);
    selectCurrentSession(session.id);
    setMessages([]);
    setError("");
    return session;
  }, [activeSessionKey, canvasId, selectCurrentSession]);

  const renameSession = useCallback(async (id: string, title: string) => {
    const session = await request<AgentSessionSummary>(`/agent/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    setSessions((current) =>
      current.map((item) => (item.id === id ? session : item)),
    );
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      await request<void>(`/agent/sessions/${id}`, { method: "DELETE" });
      const remaining = sessions.filter((item) => item.id !== id);
      setSessions(remaining);
      if (currentSessionRef.current === id) {
        if (remaining[0]) await selectSession(remaining[0].id);
        else {
          selectCurrentSession(null);
          setMessages([]);
        }
      }
    },
    [selectCurrentSession, selectSession, sessions],
  );

  const send = useCallback(
    async ({
      text,
      contentState,
      modelId,
      files = [],
      skillIds = [],
      subjects = [],
      mode,
    }: SendAgentMessage) => {
      const message = text.trim();
      if (!message || isLoading) return;
      setIsLoading(true);
      setError("");
      let sessionId = currentSessionRef.current;
      const assistantId = crypto.randomUUID();
      let streamStarted = false;

      try {
        const canvasRevision = mode === "agent"
          ? await optionsRef.current.beforeSend?.()
          : undefined;
        if (!sessionId) {
          const session = await createSession();
          sessionId = session.id;
        }
        const activeSessionId = sessionId;
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: message,
            contentState,
            attachments: files.map((file) => ({
              name: file.name,
              type: file.type,
              url: file.url,
            })),
            subjects,
            mode,
          },
          {
            id: assistantId,
            role: "assistant",
            content: "",
            toolCalls: [],
            mode,
          },
        ]);

        const abortController = new AbortController();
        abortRef.current = abortController;
        streamStarted = true;
        await sseFetch({
          url: `/agent/sessions/${activeSessionId}/messages/stream`,
          abortController,
          body: JSON.stringify({
            message,
            contentState,
            modelId,
            files: files.map((file) => ({
              name: file.name,
              content: file.content,
              type: file.type,
            })),
            skillIds,
            subjects,
            mode,
            canvasRevision,
          }),
          cb: (event) => {
            if (currentSessionRef.current !== activeSessionId) return;
            if (
              event.type === "tool_end" &&
              ["canvas_apply_ops", "canvas_arrange", "canvas_delete"].includes(String(event.name)) &&
              typeof event.output === "object" && event.output !== null &&
              (event.output as { success?: boolean }).success
            ) {
              void Promise.resolve(optionsRef.current.onCanvasChanged?.()).catch((cause) => {
                setError(cause instanceof Error ? cause.message : "画布刷新失败");
              });
            }
            setMessages((current) =>
              current.map((item) =>
                applyEvent(item, event, assistantId),
              ),
            );
          },
        });
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") {
          const errorMessage = (cause as Error).message;
          setError(errorMessage);
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId && !item.content
                ? { ...item, content: `请求失败：${errorMessage}` }
                : item,
            ),
          );
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
        if (mode === "agent" && streamStarted) {
          await Promise.resolve(optionsRef.current.onCanvasChanged?.()).catch(() => undefined);
        }
        await loadSessions().catch(() => undefined);
      }
    },
    [createSession, isLoading, loadSessions],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return {
    sessions,
    skills,
    currentSessionId,
    messages,
    isLoading,
    error,
    send,
    stop,
    selectSession,
    createSession,
    renameSession,
    deleteSession,
  };
}
