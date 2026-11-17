import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageStorageService } from '../canvas/image-storage.service';
import { imageDimensions } from './image-dimensions';

export type AgentAsset = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  mime_type: string;
  name: string;
  byte_size: number;
  text?: string;
};

export type AgentUpload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class AgentAssetService {
  constructor(private readonly images: ImageStorageService) {}

  async upload(file: AgentUpload) {
    if (!file?.buffer?.length) throw new BadRequestException('请选择要上传的文件');
    const image = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype);
    const document = ['text/plain', 'text/markdown'].includes(file.mimetype) || /\.(txt|md)$/i.test(file.originalname);
    if (!image && !document) throw new BadRequestException('只支持 PNG/JPEG/WebP/GIF 图片和 TXT/Markdown 文档');
    if (image && file.size > 5 * 1024 * 1024) throw new BadRequestException('图片不能超过 5MB');
    if (document && file.size > 200_000) throw new BadRequestException('文档不能超过 200KB');
    const id = randomUUID();
    const dimensions = image ? imageDimensions(file.buffer, file.mimetype) : { width: null, height: null };
    const url = image
      ? await this.images.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`)
      : `/agent/assets/${id}/content`;
    const asset: AgentAsset = {
      id, url, ...dimensions, mime_type: file.mimetype || (document ? 'text/plain' : 'application/octet-stream'),
      name: file.originalname, byte_size: file.size,
      ...(document ? { text: file.buffer.toString('utf8').replace(/^\uFEFF/, '') } : {}),
    };
    await mkdir(this.root(), { recursive: true });
    const path = join(this.root(), `${id}.json`);
    await writeFile(`${path}.tmp`, JSON.stringify(asset), 'utf8');
    await rename(`${path}.tmp`, path);
    return asset;
  }

  async get(id: string): Promise<AgentAsset | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    try {
      return JSON.parse(await readFile(join(this.root(), `${id}.json`), 'utf8'));
    } catch {
      return null;
    }
  }

  private root() {
    return process.env.AGENT_ASSET_DIR || join(process.cwd(), 'uploads', 'agent-assets');
  }
}
