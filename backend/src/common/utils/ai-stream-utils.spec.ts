/// <reference types="jest" />
import {
  extractToolResultText,
  parseToolOutput,
  resolveFinalText,
  runMessageStream,
  runToolCallStream,
} from './ai-stream-utils';

describe('ai-stream-utils', () => {
  it('parses json tool output when possible', () => {
    expect(parseToolOutput({ content: '{"text":"ok"}' })).toEqual({ text: 'ok' });
  });

  it('keeps raw tool output when it is not json', () => {
    expect(parseToolOutput({ content: 'plain text' })).toBe('plain text');
  });

  it('prefers raw tool output text before parsed output text', () => {
    expect(
      extractToolResultText({ content: '{"text":"ok"}' }, { text: 'ok' }),
    ).toBe('{"text":"ok"}');
  });

  it('returns the full final text when nothing was streamed', () => {
    expect(
      resolveFinalText({ messages: [{ type: 'ai', content: 'done' }] }, '', ''),
    ).toBe('done');
  });

  it('returns only the missing suffix when partial content was streamed', () => {
    expect(
      resolveFinalText(
        { messages: [{ type: 'ai', content: 'Hello world' }] },
        'Hello',
        '',
      ),
    ).toBe(' world');
  });

  it('falls back to the last tool result when no final message exists', () => {
    expect(resolveFinalText({ messages: [] }, '', 'tool result')).toBe('tool result');
  });

  it('streams message tokens through the provided emitter', async () => {
    const emitted: string[] = [];

    await runMessageStream(
      {
        messages: (async function* () {
          yield { text: (async function* () { yield 'Hel'; yield 'lo'; })() };
        })(),
        toolCalls: (async function* () {})(),
        output: Promise.resolve(undefined),
      },
      undefined,
      (text) => emitted.push(text),
    );

    expect(emitted).toEqual(['Hel', 'lo']);
  });

  it('streams tool call lifecycle events and tool result text', async () => {
    const events = [];
    const results: string[] = [];

    await runToolCallStream(
      {
        messages: (async function* () {})(),
        toolCalls: (async function* () {
          yield {
            id: 'tool-1',
            name: 'search',
            input: { q: 'x' },
            output: Promise.resolve({ content: { text: 'done' } }),
          };
        })(),
        output: Promise.resolve(undefined),
      },
      undefined,
      (event) => events.push(event),
      (text) => results.push(text),
    );

    expect(events).toEqual([
      { type: 'tool_start', id: 'tool-1', name: 'search', input: { q: 'x' } },
      { type: 'tool_end', id: 'tool-1', name: 'search', output: { text: 'done' } },
    ]);
    expect(results).toEqual(['done']);
  });
});
