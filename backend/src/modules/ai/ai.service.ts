import { Injectable } from '@nestjs/common';
import { backend, createAgentWithModel } from '@/common/llm/agents';
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
import { ModelsService } from '../models/models.service';
import { AIMessage, BaseMessage, HumanMessage } from 'langchain';
import { createChatModel } from '@/common/llm';
import { extractTextFromContent } from '@/common/utils/message-utils';
import type { AgentSubjectDto } from '../agent-sessions/dto/agent-stream.dto';

export type AiHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  files?: FileUploadDto[];
  subjects?: AgentSubjectDto[];
};

export type AiStreamOptions = {
  skillIds?: string[];
  subjects?: AgentSubjectDto[];
  mode?: 'agent' | 'chat';
};

@Injectable()
export class AiService {
  constructor(private readonly models: ModelsService) {}

  /**
   * Stream an AI response for the given message, optionally with file attachments.
   * Yields SSE events (msg_start, msg_chunk, msg_end, tool_start, tool_end, tool_error).
   */
  async *stream(
    message: string,
    files?: FileUploadDto[],
    signal?: AbortSignal,
    modelId?: string,
    history: AiHistoryMessage[] = [],
    options: AiStreamOptions = {},
  ) {
    const ensureNotAborted = () => {
      if (signal?.aborted) throw new Error(ERR_STREAM_ABORTED);
    };

    ensureNotAborted();

    const preparedFiles = prepareFiles(files);
    await this.writeDocFiles(preparedFiles.docFiles, ensureNotAborted);

    const withSubjects = (text: string, subjects: AgentSubjectDto[] = []) =>
      subjects.length
        ? `参考以下画布内容：\n${subjects
            .map(
              (subject) =>
                `- [${subject.kind ?? 'subject'}] ${subject.name}${subject.description ? `：${subject.description}` : ''}${subject.url ? `\n  资源地址：${subject.url}` : ''}`,
            )
            .join('\n')}\n\n${text}`
        : text;
    const currentInput = buildInputMessages(
      withSubjects(message, options.subjects),
      preparedFiles,
    );
    const currentMessages = Array.isArray(currentInput)
      ? currentInput
      : [new HumanMessage(currentInput)];
    const historyMessages = history.flatMap((item): BaseMessage[] => {
      if (item.role === 'assistant') return [new AIMessage(item.content)];
      const input = buildInputMessages(
        withSubjects(item.content, item.subjects),
        prepareFiles(item.files),
      );
      return Array.isArray(input) ? input : [new HumanMessage(input)];
    });
    const inputMessages = historyMessages.length
      ? [
          ...historyMessages,
          ...currentMessages,
        ]
      : currentInput;
    const model = await this.models.runtime(modelId, 'text');
    if (options.mode === 'chat') {
      const chatModel = createChatModel(model, {
        temperature: 0.7,
        streaming: true,
      });
      const chunks = await chatModel.stream(inputMessages);
      yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
      for await (const chunk of chunks) {
        if (signal?.aborted) break;
        const text = extractTextFromContent(chunk.content);
        if (text) yield { type: SSE_EVENT.MSG_CHUNK, content: text };
      }
      yield { type: SSE_EVENT.MSG_END };
      return;
    }

    const agent = createAgentWithModel(model, options.skillIds);
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
