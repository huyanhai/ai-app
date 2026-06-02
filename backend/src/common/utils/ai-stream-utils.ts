import {
  extractFinalMessageByType,
  extractTextFromContent,
} from '@/common/utils/message-utils';

export type StreamEvent =
  | { type: 'msg_start'; role: string }
  | { type: 'msg_chunk'; content: string }
  | { type: 'msg_end' }
  | { type: 'tool_start'; id: string; name: string; input: Record<string, unknown> | undefined }
  | { type: 'tool_end'; id: string; name: string; output: unknown }
  | { type: 'tool_error'; id: string; name: string; error: string };

export interface StreamMessage {
  text: AsyncIterable<string>;
}

export interface StreamToolCall {
  id: string;
  name: string;
  input: Record<string, unknown> | undefined;
  output: Promise<{ content?: unknown }>;
}

export interface AgentRun {
  messages: AsyncIterable<StreamMessage>;
  toolCalls: AsyncIterable<StreamToolCall>;
  output: Promise<unknown>;
}

export async function runMessageStream(
  run: AgentRun,
  signal: AbortSignal | undefined,
  emit: (text: string) => void,
  onError?: (err: unknown) => void,
) {
  try {
    for await (const msg of run.messages) {
      if (signal?.aborted) break;

      for await (const token of msg.text) {
        if (signal?.aborted) break;
        if (!token) continue;
        emit(token);
      }
    }
  } catch (err: unknown) {
    if (!signal?.aborted) {
      onError?.(err);
    }
  }
}

export async function runToolCallStream(
  run: AgentRun,
  signal: AbortSignal | undefined,
  emitEvent: (event: StreamEvent) => void,
  onToolResult: (text: string) => void,
  onError?: (err: unknown) => void,
) {
  try {
    for await (const call of run.toolCalls) {
      if (signal?.aborted) break;

      emitEvent({
        type: 'tool_start',
        id: call.id,
        name: call.name,
        input: call.input,
      });

      try {
        const output = await call.output;
        const parsedOutput = parseToolOutput(output);
        const toolText = extractToolResultText(output, parsedOutput);
        if (toolText) onToolResult(toolText);

        if (signal?.aborted) break;

        emitEvent({
          type: 'tool_end',
          id: call.id,
          name: call.name,
          output: parsedOutput,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        emitEvent({
          type: 'tool_error',
          id: call.id,
          name: call.name,
          error: message,
        });
      }
    }
  } catch (err: unknown) {
    if (!signal?.aborted) {
      onError?.(err);
    }
  }
}

export function parseToolOutput(output: { content?: unknown }) {
  let parsedOutput = output?.content;

  try {
    if (typeof output?.content === 'string') {
      parsedOutput = JSON.parse(output.content);
    }
  } catch {
    // Leave as string if not JSON
  }

  return parsedOutput;
}

export function extractToolResultText(output: { content?: unknown }, parsedOutput: unknown) {
  return extractTextFromContent(output) || extractTextFromContent(parsedOutput);
}

export function resolveFinalText(
  output: unknown,
  streamedText: string,
  lastToolResult: string,
) {
  const finalText =
    extractFinalMessageByType(output, 'ai') ||
    extractFinalMessageByType(output, 'tool') ||
    lastToolResult;

  if (!finalText) return '';
  if (!streamedText) return finalText;
  if (!finalText.startsWith(streamedText)) return '';

  return finalText.slice(streamedText.length);
}
