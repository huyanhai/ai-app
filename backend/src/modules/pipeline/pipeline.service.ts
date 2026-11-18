import { createChatModel } from '@/common/llm';
import { genImage } from '@/common/llm/tools/gen-image';
import { genSceneReferenceImage } from '@/common/llm/tools/gen-scene-reference';
import { ChunkStatus, StreamEvent } from '@/common/utils/ai-stream-utils';
import { SSE_EVENT, SSE_ROLE } from '@/common/utils/stream-constants';

import { Injectable } from '@nestjs/common';
import { ContentBlock } from 'langchain';
import { StreamDto } from './dto/stream.dto';
import { ChatDto } from './dto/chat.dto';
import { textScenePrompt } from '@/common/llm/prompts/text-scene';
import { genVideo, queryVideoTask } from '@/common/llm/tools/gen-video';
import { videoErrorMessage } from '@/common/llm/video-providers/http';
import { ModelsService } from '../models/models.service';
import { genAudio } from '@/common/llm/tools/gen-audio';
import { ImageStorageService } from '../canvas/image-storage.service';

@Injectable()
export class PipelineService {
  constructor(
    private readonly models: ModelsService,
    private readonly images: ImageStorageService,
  ) {}

  // 会话：使用前端模型配置中选中的文本模型流式输出
  async *chat(
    { modelId, scene, messages }: ChatDto,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const model = await this.models.runtime(modelId, 'text');
    const params = JSON.parse(model.params);
    const llm = createChatModel(model, {
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      streaming: true,
    });

    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
    try {
      const stream = await llm.stream(
        [{ role: 'system', content: textScenePrompt(scene) }, ...messages],
        { signal },
      );
      for await (const chunk of stream) {
        // 只输出正文，思考过程（reasoning_content）不下发
        if (chunk.text) {
          yield { type: SSE_EVENT.MSG_CHUNK, content: chunk.text };
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Chat stream error:', err);
      yield {
        type: SSE_EVENT.MSG_ERROR,
        error: err instanceof Error ? err.message : String(err),
      };
      return;
    }
    yield { type: SSE_EVENT.MSG_END };
  }

  async *image(messages: StreamDto) {
    const model = await this.models.runtime(messages.modelId, 'image');
    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT } as StreamEvent;
    yield {
      type: SSE_EVENT.MSG_CHUNK,
      content: {
        status: ChunkStatus.PROCESSING,
        url: null,
      },
    } as StreamEvent;
    try {
      const { content } = messages.assetKind === 'sceneReference'
        ? await genSceneReferenceImage({
            ...messages,
            runtimeModel: model,
            message: messages.message.filter((item) => item.type === 'text'),
            textList: [],
            config: { ...messages.config, edit: false },
          }, await this.models.visionRuntime())
        : await genImage({ ...messages, runtimeModel: model });
      const storedContent = await Promise.all(content.map(async (item) => ({
        ...item,
        image: item.image.startsWith('data:image/')
          ? await this.images.upload(item.image)
          : item.image,
      })));
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: {
          status: ChunkStatus.SUCCESS,
          url: storedContent[0].image,
          urls: storedContent.map((item) => item.image),
        },
      } as StreamEvent;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.FAILED, url: null },
      } as StreamEvent;
      yield { type: SSE_EVENT.MSG_ERROR, error: message } as StreamEvent;
    }
    yield { type: SSE_EVENT.MSG_END } as StreamEvent;
  }

  async *video(messages: StreamDto) {
    const model = await this.models.runtime(messages.modelId, 'video');
    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
    yield {
      type: SSE_EVENT.MSG_CHUNK,
      content: { status: ChunkStatus.PROCESSING, url: null },
    };
    try {
      const taskInfo = await genVideo({ ...messages, runtimeModel: model });
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 15_000));
        const { output } = await queryVideoTask(taskInfo.task_id, model);
        console.log('查询任务状态', output);
        if (output?.task_status === 'SUCCEEDED') {
          let lastFrameUrl: string | undefined;
          let lastFrameError: string | undefined;
          if (messages.config?.extractLastFrame) {
            try {
              lastFrameUrl = await this.images.extractLastFrame(
                output.video_url,
              );
            } catch (error) {
              lastFrameError = error instanceof Error ? error.message : String(error);
            }
          }
          yield {
            type: SSE_EVENT.MSG_CHUNK,
            content: {
              status: ChunkStatus.SUCCESS,
              url: output.video_url,
              lastFrameUrl,
              lastFrameError,
            },
          };
          break;
        }
        if (output?.task_status === 'FAILED') {
          throw new Error(output.message || '视频生成任务失败');
        }
      }
    } catch (error) {
      console.error('视频生成请求失败', error);
      const message = videoErrorMessage(error);
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.FAILED, url: null },
      };
      yield { type: SSE_EVENT.MSG_ERROR, error: message };
    }
    yield { type: SSE_EVENT.MSG_END };
  }

  async *audio(messages: StreamDto) {
    const model = await this.models.runtime(messages.modelId, 'audio');
    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
    yield {
      type: SSE_EVENT.MSG_CHUNK,
      content: { status: ChunkStatus.PROCESSING, url: null },
    };
    try {
      const url = await genAudio({ ...messages, runtimeModel: model });
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.SUCCESS, url },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.FAILED, url: null },
      };
      yield { type: SSE_EVENT.MSG_ERROR, error: message };
    }
    yield { type: SSE_EVENT.MSG_END };
  }

  async *dubbing(messages: StreamDto) {
    const audioModel = await this.models.runtime(messages.modelId, 'audio');
    yield { type: SSE_EVENT.MSG_START, role: SSE_ROLE.ASSISTANT };
    yield {
      type: SSE_EVENT.MSG_CHUNK,
      content: { status: ChunkStatus.PROCESSING, url: null },
    };
    try {
      const hasImage = messages.message.some((item) => item.type === 'image_url');
      const textModel = hasImage
        ? await this.models.visionRuntime()
        : await this.models.runtime(undefined, 'text');
      const llm = createChatModel(textModel, { temperature: 0.7, maxTokens: 160 });
      const response = await llm.invoke([{
        role: 'user',
        content: [
          ...messages.message,
          {
            type: 'text',
            text: '请根据以上主体图片和描述创作一句适合该主体说出的自然短台词。只输出台词正文，不要标题、解释、引号或舞台指示。若未提供图片或描述，则创作一句通用问候。',
          },
        ] as ContentBlock[],
      }]);
      const script = response.text.trim();
      if (!script) throw new Error('文本模型未返回配音台词');
      const url = await genAudio({
        message: [{ type: 'text', text: script }],
        runtimeModel: audioModel,
      });
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.SUCCESS, url },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield {
        type: SSE_EVENT.MSG_CHUNK,
        content: { status: ChunkStatus.FAILED, url: null },
      };
      yield { type: SSE_EVENT.MSG_ERROR, error: message };
    }
    yield { type: SSE_EVENT.MSG_END };
  }

}
