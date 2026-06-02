import { HumanMessage } from 'langchain';
import { posix as path } from 'path';
import { FileUploadDto } from '@/modules/ai/dto/stream.dto';
import {
  FILE_NOTE_PREFIX,
  FILE_NOTE_SUFFIX,
} from '@/common/utils/stream-constants';

export interface PreparedDocFile extends FileUploadDto {
  workspacePath: string;
}

export interface PreparedFiles {
  docFiles: PreparedDocFile[];
  imageFiles: FileUploadDto[];
}

export function prepareFiles(files?: FileUploadDto[]): PreparedFiles {
  const docFiles: PreparedDocFile[] = [];
  const imageFiles: FileUploadDto[] = [];

  for (const file of files || []) {
    if (file.type.startsWith('image/')) {
      imageFiles.push(file);
      continue;
    }

    docFiles.push({
      ...file,
      workspacePath: toWorkspacePath(file.name),
    });
  }

  return { docFiles, imageFiles };
}

export function toWorkspacePath(fileName: string) {
  const normalizedName = path.basename(fileName).replace(/[^\w.-]/g, '_');
  if (!normalizedName || normalizedName === '.' || normalizedName === '..') {
    throw new Error(`Invalid file name: ${fileName}`);
  }

  return `/${normalizedName}`;
}

export function isTextMimeType(mimeType: string) {
  if (mimeType.startsWith('text/')) return true;

  return [
    'application/json',
    'application/xml',
    'application/javascript',
    'application/typescript',
    'application/x-typescript',
    'application/yaml',
    'application/x-yaml',
    'application/x-sh',
  ].includes(mimeType);
}

export function buildInputMessages(
  message: string,
  files: PreparedFiles,
): string | HumanMessage[] {
  let messageText = message;
  if (files.docFiles.length > 0) {
    messageText +=
      FILE_NOTE_PREFIX +
      files.docFiles.map((f) => f.workspacePath).join(', ') +
      FILE_NOTE_SUFFIX;
  }

  if (files.imageFiles.length > 0) {
    return [
      new HumanMessage({
        content: [
          { type: 'text', text: messageText },
          ...files.imageFiles.map((img) => ({
            type: 'image_url' as const,
            image_url: {
              url: img.content.startsWith('data:')
                ? img.content
                : `data:${img.type};base64,${img.content}`,
            },
          })),
        ],
      }),
    ];
  }

  return messageText;
}
