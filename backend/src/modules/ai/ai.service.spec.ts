/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { backend } from '@/common/llm/agents';
import {
  FILE_NOTE_PREFIX,
  FILE_NOTE_SUFFIX,
} from '@/common/utils/stream-constants';

const mockAgent = { streamEvents: jest.fn() };
const mockChatModel = { stream: jest.fn() };

jest.mock('@/common/llm/agents', () => ({
  createAgentWithModel: () => mockAgent,
  backend: {
    write: jest.fn(),
  },
}));

jest.mock('@/common/llm', () => ({
  createChatModel: () => mockChatModel,
}));

async function* makeAsyncIterable<T>(items: T[]) {
  for (const item of items) {
    yield item;
  }
}

describe('AiService', () => {
  let service: AiService;
  const streamEventsMock = mockAgent.streamEvents as jest.Mock;
  const backendWriteMock = backend.write as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: require('../models/models.service').ModelsService,
          useValue: { runtime: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('streams assistant tokens individually and closes the message', async () => {
    streamEventsMock.mockResolvedValue({
      messages: makeAsyncIterable([{ text: makeAsyncIterable(['Hel', 'lo']) }]),
      toolCalls: makeAsyncIterable([]),
      output: Promise.resolve({
        messages: [{ type: 'ai', content: 'Hello' }],
      }),
    });

    const events = [];
    for await (const event of service.stream('hi')) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'msg_start', role: 'assistant' },
      { type: 'msg_chunk', content: 'Hel' },
      { type: 'msg_chunk', content: 'lo' },
      { type: 'msg_end' },
    ]);
  });

  it('falls back to the final ai output when nothing was streamed', async () => {
    streamEventsMock.mockResolvedValue({
      messages: makeAsyncIterable([]),
      toolCalls: makeAsyncIterable([]),
      output: Promise.resolve({
        messages: [{ type: 'ai', content: 'Final answer' }],
      }),
    });

    const events = [];
    for await (const event of service.stream('hi')) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'msg_start', role: 'assistant' },
      { type: 'msg_chunk', content: 'Final answer' },
      { type: 'msg_end' },
    ]);
  });

  it('writes sanitized document file paths and appends them to the prompt', async () => {
    streamEventsMock.mockResolvedValue({
      messages: makeAsyncIterable([]),
      toolCalls: makeAsyncIterable([]),
      output: Promise.resolve({
        messages: [{ type: 'ai', content: 'done' }],
      }),
    });

    const files = [
      {
        name: '../notes.md',
        type: 'text/markdown',
        content: Buffer.from('hello').toString('base64'),
      },
    ];

    const events = [];
    for await (const event of service.stream('inspect', files)) {
      events.push(event);
    }

    expect(backendWriteMock).toHaveBeenCalledWith('/notes.md', 'hello');
    expect(streamEventsMock).toHaveBeenCalledWith(
      {
        messages: 'inspect' + FILE_NOTE_PREFIX + '/notes.md' + FILE_NOTE_SUFFIX,
      },
      { version: 'v3' },
    );
    expect(events).toContainEqual({ type: 'msg_chunk', content: 'done' });
  });

  it('uses tool output as a fallback when there is no final ai message', async () => {
    streamEventsMock.mockResolvedValue({
      messages: makeAsyncIterable([]),
      toolCalls: makeAsyncIterable([
        {
          id: 'tool-1',
          name: 'search',
          input: { q: 'x' },
          output: Promise.resolve({ content: { text: 'tool result' } }),
        },
      ]),
      output: Promise.resolve({
        messages: [{ type: 'tool', content: 'tool result' }],
      }),
    });

    const events = [];
    for await (const event of service.stream('hi')) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'tool_start', id: 'tool-1', name: 'search', input: { q: 'x' } },
      {
        type: 'tool_end',
        id: 'tool-1',
        name: 'search',
        output: { text: 'tool result' },
      },
      { type: 'msg_start', role: 'assistant' },
      { type: 'msg_chunk', content: 'tool result' },
      { type: 'msg_end' },
    ]);
  });

  it('prepends stored conversation messages to the current input', async () => {
    streamEventsMock.mockResolvedValue({
      messages: makeAsyncIterable([]),
      toolCalls: makeAsyncIterable([]),
      output: Promise.resolve({
        messages: [{ type: 'ai', content: 'done' }],
      }),
    });

    for await (const _event of service.stream(
      'next',
      undefined,
      undefined,
      undefined,
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'answer' },
      ],
    )) {
      // Consume the stream.
    }

    const input = streamEventsMock.mock.calls[0][0];
    expect(input.messages).toHaveLength(3);
    expect(input.messages.map((message) => message.content)).toEqual([
      'first',
      'answer',
      'next',
    ]);
  });

  it('streams directly from the text model in chat mode', async () => {
    mockChatModel.stream.mockResolvedValue(
      makeAsyncIterable([{ content: 'Direct' }, { content: ' answer' }]),
    );

    const events = [];
    for await (const event of service.stream(
      'hi',
      undefined,
      undefined,
      undefined,
      [],
      { mode: 'chat' },
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'msg_start', role: 'assistant' },
      { type: 'msg_chunk', content: 'Direct' },
      { type: 'msg_chunk', content: ' answer' },
      { type: 'msg_end' },
    ]);
    expect(streamEventsMock).not.toHaveBeenCalled();
  });
});
