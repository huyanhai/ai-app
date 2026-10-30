import { StreamDto } from '@/modules/pipeline/dto/stream.dto';
import { ContentBlock, tool } from 'langchain';
import * as z from 'zod';
import { RuntimeModel } from '..';

export async function genImage({
  message,
  config,
  textList,
  runtimeModel,
}: StreamDto & { runtimeModel: RuntimeModel }) {
  let text = '';
  let index = 0;
  const messages = [];
  message.forEach((item: ContentBlock) => {
    if (item.type === 'text') {
      text += `${item.text}\n`;
    }
    if (item.type === 'image_url') {
      text += `[图片${index++}]`;
      messages.push({
        image: item.image_url,
      });
    }
  });

  if (textList) {
    textList.forEach((item) => {
      text += `${item.action_input}\n${item.supplementary.style}\n${config.ratio || item.supplementary.ratio}`;
    });
  }

  messages.unshift({
    text,
  });

  console.log('messages', messages);
  try {
    const data = await fetch(`${runtimeModel.baseURL}/images/generations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtimeModel.apiKey}`,
      },
      method: 'POST',
      body: JSON.stringify({
        model: runtimeModel.modelId,
        prompt: text.trim(),
        n: config?.count || 1,
      }),
    }).then((res) => res.json());

    if (!Array.isArray(data?.data)) {
      throw new Error(data?.error?.message || data?.message || '图片生成失败');
    }

    return {
      content: data.data.map((item) => ({
        image: item.url || `data:image/png;base64,${item.b64_json}`,
      })),
    };
  } catch (error) {
    throw error;
  }
}

export const createGenImageTool = (runtimeModel: RuntimeModel): any =>
  tool(
    async ({ prompt }) => {
      return genImage({
        runtimeModel,
        message: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        textList: [],
        config: {
          ratio: '3:2',
        },
      });
    },
    {
      name: '图片生成',
      description: '当用户需要生成图片的时候，使用此工具进行图片生成',
      schema: z.object({
        prompt: z.string().describe('生成图片的提示词'),
      }),
    },
  );
