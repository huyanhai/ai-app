"use client";

import { useRef, useEffect } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageItem } from "./message-item";
import { ChatInput } from "./chat-input";
import { MessageSquare } from "lucide-react";
import { useChat } from "@/hooks/use-chat";

export function ChatView() {
  const { messages, send, stop, isLoading } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (
    text: string,
    files?: { name: string; content: string; type: string; url: string }[],
  ) => {
    send({ text, files });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4">
        <Conversation className="min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Welcome to SenseNova Agent"
              description="Ask me any question! I can browse the web in real-time using search engines and scrape pages to find the most accurate and up-to-date information."
              icon={<MessageSquare className="h-10 w-10 text-blue-500" />}
              className="flex-1 rounded-none border-0 bg-transparent"
            />
          ) : (
            <ConversationContent ref={scrollRef}>
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}
            </ConversationContent>
          )}
          <ConversationScrollButton />
        </Conversation>
        <div className="w-full px-4 pb-4">
          <ChatInput onSend={handleSend} onStop={stop} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
