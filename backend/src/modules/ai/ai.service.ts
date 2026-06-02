import { Injectable } from '@nestjs/common';
import { agent, backend } from '@/common/llm/agents';
import { FileUploadDto } from './dto/stream.dto';
import { AsyncQueue } from '@/common/utils/async-queue';
import {
  buildInputMessages,
  isTextMimeType,
  PreparedDocFile,
  prepareFiles,
} from '@/common/utils/ai-file-utils';
import {
  AgentRun,
  resolveFinalText,
  runMessageStream,
  runToolCallStream,
  StreamEvent,
} from '@/common/utils/ai-stream-utils';
import {
  SSE_EVENT,
  SSE_ROLE,
  ERR_STREAM_ABORTED,
} from '@/common/utils/stream-constants';
@Injectable()
export class AiService {
  /**
   * Stream an AI response for the given message, optionally with file attachments.
   * Yields SSE events (msg_start, msg_chunk, msg_end, tool_start, tool_end, tool_error).
   */
  async *stream(
    message: string,
    files?: FileUploadDto[],
    signal?: AbortSignal,
  ) {
    const ensureNotAborted = () => {
      if (signal?.aborted) throw new Error(ERR_STREAM_ABORTED);
    };

    ensureNotAborted();

    const preparedFiles = prepareFiles(files);
    await this.writeDocFiles(preparedFiles.docFiles, ensureNotAborted);

    const inputMessages = buildInputMessages(message, preparedFiles);
    const run = (await agent.streamEvents(
      { messages: inputMessages },
      { version: 'v3' },
    )) as AgentRun;

    const queue = new AsyncQueue<StreamEvent>();
    const closeQueue = () => queue.close();
    let streamedAssistantText = '';
    let assistantMessageOpen = false;
    let lastToolResultText = '';

    signal?.addEventListener('abort', closeQueue, { once: true });

    const emitAssistantText = (text: string) => {
      if (!text) return;

      if (!assistantMessageOpen) {
        queue.push({ type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT });
        assistantMessageOpen = true;
      }

      streamedAssistantText += text;
      queue.push({ type: SSE_EVENT.MSG_CHUNK, content: text });
    };

    const messagesPromise = runMessageStream(
      run,
      signal,
      emitAssistantText,
      (err) => console.error('Error streaming messages:', err),
    );
    const toolCallsPromise = runToolCallStream(
      run,
      signal,
      (event) => queue.push(event),
      (text: string) => {
        lastToolResultText = text;
      },
      (err) => console.error('Error streaming tool calls:', err),
    );
    const resolveOutput = () =>
      this.resolveFinalOutput(
        run,
        signal,
        emitAssistantText,
        () => streamedAssistantText,
        () => lastToolResultText,
      );

    Promise.all([messagesPromise, toolCallsPromise])
      .catch((err: unknown) => {
        if (!signal?.aborted) {
          console.error('Error in stream tasks:', err);
        }
      })
      .then(() => resolveOutput())
      .finally(() => {
        if (assistantMessageOpen) {
          queue.push({ type: SSE_EVENT.MSG_END });
        }
        signal?.removeEventListener('abort', closeQueue);
        queue.close();
      });

    yield* queue.generator();
  }

  /** Write uploaded document files to the backend workspace. */
  private async writeDocFiles(
    files: PreparedDocFile[],
    ensureNotAborted: () => void,
  ) {
    for (const file of files) {
      ensureNotAborted();
      let writeContent: string | Buffer = file.content;

      if (isTextMimeType(file.type)) {
        writeContent = Buffer.from(file.content, 'base64').toString('utf-8');
      }

      await backend.write(file.workspacePath, writeContent);
    }
  }

  /**
   * After streaming completes, resolve the final output from the agent run.
   * Emits any remaining text not already captured by streaming.
   */
  private async resolveFinalOutput(
    run: AgentRun,
    signal: AbortSignal | undefined,
    emit: (text: string) => void,
    getStreamedText: () => string,
    getLastToolResult: () => string,
  ) {
    try {
      const output = await run.output;
      if (signal?.aborted) return;

      const finalText = resolveFinalText(
        output,
        getStreamedText(),
        getLastToolResult(),
      );

      if (!finalText) return;
      emit(finalText);
    } catch (err: unknown) {
      if (!signal?.aborted) {
        console.error('Error resolving final output:', err);
      }
    }
  }
}
