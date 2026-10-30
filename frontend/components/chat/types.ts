export interface ToolCallType {
  id: string;
  name: string;
  input: any;
  output?: any;
  error?: string;
  status: "running" | "completed" | "error";
}

export interface AttachmentType {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface SubjectReference {
  id: string;
  name: string;
  description?: string;
  kind?: ReferenceKind;
  url?: string;
}

export type ReferenceKind = "subject" | "image" | "video" | "audio" | "text";

export interface MessageType {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallType[];
  attachments?: AttachmentType[];
  subjects?: SubjectReference[];
  mode?: "agent" | "chat";
}

