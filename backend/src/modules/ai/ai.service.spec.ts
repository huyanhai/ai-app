/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { agent, backend } from '@/common/llm/agents';
import { FILE_NOTE_PREFIX, FILE_NOTE_SUFFIX } from '@/common/utils/stream-constants';

jest.mock('@/common/llm/agents', () => ({
  agent: {
    streamEvents: jest.fn(),
  },
  backend: {
    write: jest.fn(),
  },
}));

async function* makeAsyncIterable<T>(items: T[]) {
  for (const item of items) {
    yield item;
  }
}

describe('AiService', () => {
  let service: AiService;
  const streamEventsMock = agent.streamEvents as jest.Mock;
  const backendWriteMock = backend.write as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('streams assistant tokens individually and closes the message', async () => {
    streamEventsMock.mockResolvedValue({
      messages: makeAsyncIterable([
        { text: makeAsyncIterable(['Hel', 'lo']) },
      ]),
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
        messages:
          'inspect' +
          FILE_NOTE_PREFIX +
          '/notes.md' +
          FILE_NOTE_SUFFIX,
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
      { type: 'tool_end', id: 'tool-1', name: 'search', output: { text: 'tool result' } },
      { type: 'msg_start', role: 'assistant' },
      { type: 'msg_chunk', content: 'tool result' },
      { type: 'msg_end' },
    ]);
  });
});
