interface BaseMessageLike {
  content?: unknown;
  type?: string;
  getType?: () => string;
}

interface StateWithMessages {
  messages?: unknown[];
}

/**
 * Recursively extract text from LangChain message content.
 * Handles strings, arrays of content blocks, and nested objects.
 */
function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          if (record.type === 'text' && typeof record.text === 'string') {
            return record.text;
          }
        }
        return '';
      })
      .join('');
  }

  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
    if (record.content !== undefined) return extractTextFromContent(record.content);
    if (record.output !== undefined) return extractTextFromContent(record.output);
  }

  return '';
}

/**
 * Find the last message of a given type in a LangGraph state object
 * and extract its text content.
 */
function extractFinalMessageByType(
  state: unknown,
  type: 'ai' | 'tool',
): string {
  const stateObj = state as StateWithMessages;
  const messages: unknown[] = Array.isArray(stateObj.messages)
    ? stateObj.messages
    : [];
  const msg = [...messages]
    .reverse()
    .find((m): m is BaseMessageLike => {
      if (typeof m !== 'object' || m === null) return false;

      const message = m as BaseMessageLike;
      const messageType =
        typeof message.getType === 'function' ? message.getType() : message.type;

      return messageType === type;
    });
  return extractTextFromContent(msg?.content);
}

export { extractTextFromContent, extractFinalMessageByType };
