import { StreamDto } from '../../../modules/pipeline/dto/stream.dto';
import { ContentBlock, tool } from 'langchain';
import * as z from 'zod';
import { RuntimeModel } from '..';

export interface IVideoMedia {
  url: string;
  type: string;
}

const videoUrls = (model: RuntimeModel) => {
  if (model.provider === 'dashscope') {
    const origin = new URL(model.baseURL).origin;
    return {
      create: `${origin}/api/v1/services/aigc/video-generation/video-synthesis`,
      query: (taskId: string) => `${origin}/api/v1/tasks/${taskId}`,
    };
  }
  return {
    create: `${model.baseURL}/contents/generations/tasks`,
    query: (taskId: string) =>
      `${model.baseURL}/contents/generations/tasks/${taskId}`,
  };
};

const readResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok || data?.code) {
    throw new Error(data?.message || `视频接口请求失败（${response.status}）`);
  }
  return data;
};

export async function queryVideoTask(
  taskId: string,
  runtimeModel: RuntimeModel,
) {
  const response = await fetch(videoUrls(runtimeModel).query(taskId), {
    headers: { Authorization: `Bearer ${runtimeModel.apiKey}` },
  });
  return readResponse(response);
}

export async function genVideo({
  message,
  config,
  textList,
  runtimeModel,
}: StreamDto & { runtimeModel: RuntimeModel }) {
  let prompt = '';
  let index = 0;
  const media: IVideoMedia[] = [];
  message.forEach((item: ContentBlock) => {
    if (item.type === 'text') {
      prompt += item.text + '\n';
    }

    // 参考图生视频
    if (item.type === 'image_url') {
      prompt += `[图片${index++}]`;
      media.push({
        type: 'reference_image',
        url: item.image_url as string,
      });
    }
  });

  if (config?.firstFrameUrl) {
    media.push({ type: 'first_frame', url: config.firstFrameUrl });
  }
  if (config?.lastFrameUrl) {
    media.push({ type: 'last_frame', url: config.lastFrameUrl });
  }

  textList?.forEach((item) => {
    prompt += `${item.action_input}\n${item.supplementary?.style || ''}\n`;
  });

  console.log(prompt, media, runtimeModel.modelId);

  try {
    const data = await fetch(videoUrls(runtimeModel).create, {
      headers: {
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtimeModel.apiKey}`,
      },
      method: 'POST',
      body: JSON.stringify({
        model: runtimeModel.modelId,
        input: {
          prompt,
          media,
        },
        parameters: {
          resolution: config?.resolution || '720P',
          duration: config?.duration || 5,
          prompt_extend: true,
          watermark: false,
          ratio: config?.ratio || '16:9',
        },
      }),
    }).then(readResponse);
    const result = data?.output;

    if (result?.task_id) {
      return result;
    }
    throw new Error(data?.message || '视频生成接口未返回任务 ID');
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export const createGenVideoTool = (runtimeModel: RuntimeModel): any =>
  tool(
    async ({ prompt }) => {
      return genVideo({
        runtimeModel,
        message: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        textList: [],
        config: {
          videoMode: 'textToVideo',
          duration: 5,
          ratio: '16:9',
        },
      });
    },
    {
      name: '视频生成',
      description: '当用户需要生成视频的时候，使用此工具进行视频生成',
      schema: z.object({
        prompt: z.string().describe('生成视频的提示词'),
      }),
    },
  );
