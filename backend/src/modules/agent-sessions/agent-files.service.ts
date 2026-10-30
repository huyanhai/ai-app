import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import type { FileUploadDto } from '../ai/dto/stream.dto';
import { isTextMimeType } from '@/common/utils/ai-file-utils';

export type StoredAttachment = {
  name: string;
  type: string;
  size: number;
  storedName: string;
  url: string;
};

const MAX_TOTAL_SIZE = 5 * 1024 * 1024;

@Injectable()
export class AgentFilesService {
  private root(sessionId: string) {
    return join(process.cwd(), 'uploads', 'agent-sessions', sessionId);
  }

  async save(sessionId: string, files: FileUploadDto[] = []) {
    if (files.length > 5) throw new BadRequestException('最多上传 5 个文件');
    const totalSize = files.reduce(
      (total, file) => total + Buffer.from(file.content, 'base64').byteLength,
      0,
    );
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new BadRequestException('附件总大小不能超过 5MB');
    }
    const root = this.root(sessionId);
    await mkdir(root, { recursive: true });
    const saved: StoredAttachment[] = [];
    for (const file of files) {
      if (
        !file.type.startsWith('image/') &&
        !isTextMimeType(file.type) &&
        file.type !== 'application/pdf'
      ) {
        throw new BadRequestException(`不支持的文件类型：${file.name}`);
      }
      const content = Buffer.from(file.content, 'base64');
      const storedName = `${crypto.randomUUID()}${extname(basename(file.name)).slice(0, 16)}`;
      await writeFile(join(root, storedName), content);
      saved.push({
        name: basename(file.name),
        type: file.type,
        size: content.byteLength,
        storedName,
        url: `/agent/sessions/${sessionId}/files/${storedName}`,
      });
    }
    return saved;
  }

  path(sessionId: string, storedName: string) {
    return join(this.root(sessionId), basename(storedName));
  }

  async load(sessionId: string, attachments: StoredAttachment[] = []) {
    const files: FileUploadDto[] = [];
    for (const attachment of attachments) {
      const content = await readFile(
        this.path(sessionId, attachment.storedName),
      );
      files.push({
        name: attachment.name,
        type: attachment.type,
        content: content.toString('base64'),
      });
    }
    return files;
  }

  async removeSession(sessionId: string) {
    await rm(this.root(sessionId), { recursive: true, force: true });
  }
}
