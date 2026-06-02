import { useState, useRef } from "react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Paperclip, Square } from "lucide-react";
import Attachments, { AttachmentFile } from "./attachments";

interface ChatInputProps {
  onSend: (
    message: string,
    files: { name: string; content: string; type: string; url: string }[],
  ) => void;
  onStop: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  disabled,
  isLoading = false,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsDisabled = disabled || isLoading;

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              url: event.target!.result as string,
              type: file.type,
              file: file,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
    // Reset value so same file can be re-selected if removed
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      // Prevent default to avoid pasting the file name or path as text, if applicable
      e.preventDefault();
      processFiles(Array.from(e.clipboardData.files));
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (message: { text: string }) => {
    const trimmed = message.text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (controlsDisabled) return;

    const filesPayload = attachments.map((att) => {
      const base64Index = att.url.indexOf(";base64,");
      const base64Content =
        base64Index !== -1 ? att.url.substring(base64Index + 8) : att.url;
      return {
        name: att.name,
        content: base64Content,
        type: att.type,
        url: att.url,
      };
    });

    onSend(trimmed, filesPayload);
    setText("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="relative">
      {attachments.length > 0 && (
        <Attachments
          attachments={attachments}
          onRemoveAttachment={handleRemoveAttachment}
        />
      )}
      <PromptInput
        status={isLoading ? "streaming" : "ready"}
        onSubmit={handleSubmit}
        className="overflow-hidden"
      >
        <PromptInputBody>
          <PromptInputTextarea
            ref={textareaRef}
            disabled={controlsDisabled}
            placeholder="Ask a question, upload images or files..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!controlsDisabled) {
                  e.currentTarget.form?.requestSubmit();
                }
              }
            }}
            onPaste={handlePaste}
          />
        </PromptInputBody>

        <PromptInputFooter className="justify-between">
          <PromptInputTools>
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={controlsDisabled}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title="Upload images or files"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </PromptInputTools>
          {isLoading ? (
            <PromptInputButton
              onClick={onStop}
              className="h-11 rounded-full border-slate-950 bg-slate-950 px-4 text-white hover:border-slate-800 hover:bg-slate-800 dark:border-white dark:bg-white dark:text-slate-950 dark:hover:border-slate-200 dark:hover:bg-slate-200"
              active
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </PromptInputButton>
          ) : (
            <PromptInputSubmit
              disabled={(!text.trim() && attachments.length === 0) || disabled}
            />
          )}
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
