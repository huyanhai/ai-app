/** SSE event types used in streaming responses. */
export const SSE_EVENT = {
  MSG_START: 'msg_start',
  MSG_CHUNK: 'msg_chunk',
  MSG_END: 'msg_end',
  TOOL_START: 'tool_start',
  TOOL_END: 'tool_end',
  TOOL_ERROR: 'tool_error',
} as const;

/** SSE role identifiers. */
export const SSE_ROLE = {
  ASSISTANT: 'assistant',
} as const;

/** Prefix prepended to each SSE data line. */
export const DATA_PREFIX = 'data: ';

/** Prefix for the file-upload note appended to user messages. */
export const FILE_NOTE_PREFIX =
  '\n\n(Note: The user has uploaded files to your workspace: ';

/** Suffix for the file-upload note. */
export const FILE_NOTE_SUFFIX = '. You can read and analyze them if needed.)';

/** Error message used when the client aborts the stream. */
export const ERR_STREAM_ABORTED = 'Stream aborted';

/** Error message used when the response has no body. */
export const ERR_NO_RESPONSE_BODY = 'No response body';
