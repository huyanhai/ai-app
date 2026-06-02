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
  url: string; // Base64 data URI
  type: string;
}

export interface MessageType {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallType[];
  attachments?: AttachmentType[];
}

