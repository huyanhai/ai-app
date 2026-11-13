import { BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { FileUploadDto } from '@/modules/ai/dto/stream.dto';
import { isTextMimeType } from '@/common/utils/ai-file-utils';

const MAX_FILES = 5;
const MAX_TOTAL_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 120_000;

export async function prepareProductionAttachments(files: FileUploadDto[] = []) {
  if (files.length > MAX_FILES) throw new BadRequestException('最多上传 5 个附件');
  const buffers = files.map((file) => Buffer.from(file.content, 'base64'));
  const totalSize = buffers.reduce((total, buffer) => total + buffer.byteLength, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    throw new BadRequestException('附件总大小不能超过 5MB');
  }

  const documents: string[] = [];
  const images: { type: 'image_url'; image_url: { url: string } }[] = [];
  for (const [index, file] of files.entries()) {
    const buffer = buffers[index];
    if (file.type.startsWith('image/')) {
      images.push({
        type: 'image_url',
        image_url: { url: `data:${file.type};base64,${file.content}` },
      });
      continue;
    }
    let text: string;
    if (isTextMimeType(file.type)) {
      text = buffer.toString('utf-8');
    } else if (file.type === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        text = (await parser.getText()).text;
      } catch {
        throw new BadRequestException(`无法读取 PDF：${file.name}`);
      } finally {
        await parser.destroy();
      }
    } else {
      throw new BadRequestException(`不支持的文件类型：${file.name}`);
    }
    if (!text.trim()) {
      throw new BadRequestException(
        file.type === 'application/pdf'
          ? `PDF 未提取到文字，请上传可复制文本的剧本：${file.name}`
          : `文件内容为空：${file.name}`,
      );
    }
    documents.push(`\n\n【附件：${file.name}】\n${text.trim()}`);
  }
  const text = documents.join('');
  if (text.length > MAX_TEXT_LENGTH) {
    throw new BadRequestException('剧本文字过长，请拆分后上传');
  }
  return { text, images };
}
