import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GenerationJob } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ChunkStatus, StreamEvent } from '@/common/utils/ai-stream-utils';
import { SSE_EVENT, SSE_ROLE } from '@/common/utils/stream-constants';
import { PipelineService } from '../pipeline/pipeline.service';
import { StreamDto } from '../pipeline/dto/stream.dto';
import { CreateGenerationDto } from './dto/create-generation.dto';

@Injectable()
export class GenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: PipelineService,
  ) {}

  private serialize(job: GenerationJob) {
    return {
      ...job,
      config: JSON.parse(job.config),
      urls: JSON.parse(job.urls) as string[],
    };
  }

  async create(input: CreateGenerationDto) {
    const job = await this.prisma.generationJob.create({
      data: {
        ...input,
        prompt: input.prompt.trim(),
        config: JSON.stringify(input.config),
      },
    });
    return this.serialize(job);
  }

  async get(id: string) {
    const job = await this.prisma.generationJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('生成记录不存在');
    return this.serialize(job);
  }

  async *run(id: string): AsyncGenerator<StreamEvent> {
    const job = await this.prisma.generationJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('生成记录不存在');
    const previousUrls = JSON.parse(job.urls) as string[];
    if (job.status === 'succeeded') {
      yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.SUCCESS, url: previousUrls[0], urls: previousUrls },
      };
      yield { type: SSE_EVENT.MSG_END };
      return;
    }
    if (job.status === 'running') throw new ConflictException('任务正在生成中');

    await this.prisma.generationJob.update({
      where: { id },
      data: { status: 'running', error: null, urls: '[]' },
    });
    const config = JSON.parse(job.config) as StreamDto['config'];
    const referenceUrl = job.referenceUrl?.startsWith('/')
      ? `http://127.0.0.1:3000${job.referenceUrl}`
      : job.referenceUrl;
    const input: StreamDto = {
      message: [
        ...(referenceUrl ? [{ type: 'image_url' as const, image_url: referenceUrl }] : []),
        { type: 'text', text: job.prompt },
      ],
      modelId: job.modelId,
      config: {
        ...config,
        edit: job.kind === 'image' && Boolean(referenceUrl),
        ratio: config?.ratio || (job.kind === 'image' ? '1:1' : '16:9'),
      },
    };
    const generator = job.kind === 'image'
      ? this.pipeline.image(input)
      : job.kind === 'video'
        ? this.pipeline.video(input)
        : this.pipeline.audio(input);
    const urls: string[] = [];
    let error = '';

    try {
      for await (const event of generator) {
        if (event.type === SSE_EVENT.MSG_CHUNK && typeof event.content === 'object' && 'status' in event.content) {
          const media = event.content;
          if (media.status === ChunkStatus.SUCCESS) {
            const mediaUrls = 'urls' in media && Array.isArray(media.urls)
              ? media.urls.filter((url): url is string => typeof url === 'string')
              : [];
            const nextUrls = mediaUrls.length ? mediaUrls : media.url ? [media.url] : [];
            nextUrls.forEach((url) => {
              if (!urls.includes(url)) urls.push(url);
            });
          }
        }
        if (event.type === SSE_EVENT.MSG_ERROR) error = event.error;
        yield event;
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      yield { type: SSE_EVENT.MSG_ERROR, error };
      yield { type: SSE_EVENT.MSG_END };
    } finally {
      await this.prisma.generationJob.update({
        where: { id },
        data: {
          status: !error && urls.length ? 'succeeded' : 'failed',
          error: !error && urls.length ? null : error || '生成未完成，请重试',
          urls: JSON.stringify(urls),
        },
      });
    }
  }
}
