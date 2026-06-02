/// <reference types="jest" />
import { HumanMessage } from 'langchain';
import {
  buildInputMessages,
  isTextMimeType,
  prepareFiles,
  toWorkspacePath,
} from './ai-file-utils';
import { FILE_NOTE_PREFIX, FILE_NOTE_SUFFIX } from './stream-constants';

describe('ai-file-utils', () => {
  it('sanitizes file names into workspace paths', () => {
    expect(toWorkspacePath('../notes 01.md')).toBe('/notes_01.md');
  });

  it('classifies image and document uploads', () => {
    const prepared = prepareFiles([
      { name: 'doc.txt', type: 'text/plain', content: 'ZGF0YQ==' },
      { name: 'image.png', type: 'image/png', content: 'abc' },
    ]);

    expect(prepared.docFiles).toEqual([
      {
        name: 'doc.txt',
        type: 'text/plain',
        content: 'ZGF0YQ==',
        workspacePath: '/doc.txt',
      },
    ]);
    expect(prepared.imageFiles).toEqual([
      { name: 'image.png', type: 'image/png', content: 'abc' },
    ]);
  });

  it('recognizes configured text mime types', () => {
    expect(isTextMimeType('text/plain')).toBe(true);
    expect(isTextMimeType('application/json')).toBe(true);
    expect(isTextMimeType('application/octet-stream')).toBe(false);
  });

  it('builds a plain text message when there are only document files', () => {
    const input = buildInputMessages('inspect', {
      docFiles: [
        {
          name: 'doc.txt',
          type: 'text/plain',
          content: 'ZGF0YQ==',
          workspacePath: '/doc.txt',
        },
      ],
      imageFiles: [],
    });

    expect(input).toBe(
      'inspect' + FILE_NOTE_PREFIX + '/doc.txt' + FILE_NOTE_SUFFIX,
    );
  });

  it('builds a multimodal message when image files are present', () => {
    const input = buildInputMessages('look', {
      docFiles: [],
      imageFiles: [
        { name: 'image.png', type: 'image/png', content: 'abc' },
      ],
    });

    expect(Array.isArray(input)).toBe(true);
    expect(input[0]).toBeInstanceOf(HumanMessage);
  });
});
