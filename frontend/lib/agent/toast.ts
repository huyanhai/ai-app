export type AgentToastKind = "success" | "error" | "warning" | "info";

export type AgentToastEvent = CustomEvent<{
  kind: AgentToastKind;
  message: string;
  id?: string;
}>;

export const AGENT_TOAST_EVENT = "agent:toast";

function show(kind: AgentToastKind, message: string, options?: { id?: string }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AGENT_TOAST_EVENT, {
        detail: { kind, message, id: options?.id },
      }),
    );
  }
}

export const toast = {
  success: (message: string, options?: { id?: string }) => show("success", message, options),
  error: (message: string, options?: { id?: string }) => show("error", message, options),
  warning: (message: string, options?: { id?: string }) => show("warning", message, options),
  info: (message: string, options?: { id?: string }) => show("info", message, options),
};
