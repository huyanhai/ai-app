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

export function useAgentChat() {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  const selectCurrentSession = useCallback((id: string | null) => {
    currentSessionRef.current = id;
    setCurrentSessionId(id);
  }, []);

  const selectSession = useCallback(
    async (id: string) => {
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
            attachments: message.attachments,
            subjects: message.subjects,
            mode: message.mode,
          })),
        );
      } catch (cause) {
        setError((cause as Error).message);
      }
    },
    [selectCurrentSession],
  );

  const loadSessions = useCallback(async () => {
    const list = await request<AgentSessionSummary[]>("/agent/sessions");
    setSessions(list);
    return list;
  }, []);

  const loadSkills = useCallback(async () => {
    const list = await request<AgentSkill[]>("/agent/skills");
    setSkills(list);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [list] = await Promise.all([loadSessions(), loadSkills()]);
        if (list[0]) await selectSession(list[0].id);
      } catch (cause) {
        setError((cause as Error).message);
      }
    };
    void initialize();
  }, [loadSessions, loadSkills, selectSession]);

  const createSession = useCallback(async () => {
    const session = await request<AgentSessionSummary>("/agent/sessions", {
      method: "POST",
    });
    setSessions((current) => [session, ...current]);
    selectCurrentSession(session.id);
    setMessages([]);
    setError("");
    return session;
  }, [selectCurrentSession]);

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

      try {
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
        await sseFetch({
          url: `/agent/sessions/${activeSessionId}/messages/stream`,
          abortController,
          body: JSON.stringify({
            message,
            modelId,
            files: files.map((file) => ({
              name: file.name,
              content: file.content,
              type: file.type,
            })),
            skillIds,
            subjects,
            mode,
          }),
          cb: (event) => {
            if (currentSessionRef.current !== activeSessionId) return;
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
