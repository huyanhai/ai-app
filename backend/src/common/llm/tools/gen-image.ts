import { StreamDto } from '@/modules/pipeline/dto/stream.dto';
import { ContentBlock, tool } from 'langchain';
import * as z from 'zod';
import { RuntimeModel } from '..';

const PRESET_SIZES: Record<string, string> = {
  '21:9': '1536x658',
  '16:9': '1536x864',
  '4:3': '1536x1152',
  '1:1': '1024x1024',
  '3:4': '1152x1536',
  '9:16': '864x1536',
};

const outputSize = (config?: StreamDto['config']) => {
  const base = PRESET_SIZES[config?.ratio ?? ''] || '1024x1024';
  const longSide = config?.resolution === '2K'
    ? 2048
    : config?.resolution === '4K'
      ? 4096
      : undefined;
  if (!longSide) return base;
  const [width, height] = base.split('x').map(Number);
  const scale = longSide / Math.max(width, height);
  return `${Math.round(width * scale)}x${Math.round(height * scale)}`;
};

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
      text += `[图片${++index}]`;
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
    const sourceImages = messages
      .filter((item) => 'image' in item)
      .map((item) => item.image as string);
    let response: Response;
    if (config?.edit && sourceImages.length > 0) {
      const form = new FormData();
      form.append('model', runtimeModel.modelId);
      form.append('prompt', text.trim());
      form.append('n', String(config?.count || 1));
      let size: string;
      if (config?.outpaint) {
        const [width, height] = (config.ratio || '1:1').split(':').map(Number);
        const ratio = width / height;
        size = ratio > 1 ? '1536x1024' : ratio < 1 ? '1024x1536' : '1024x1024';
      } else {
        size = outputSize(config);
      }
      form.append('size', size);
      console.log('image request', {
        endpoint: 'edits',
        model: runtimeModel.modelId,
        size,
        count: config?.count || 1,
      });
      for (const [index, sourceImage] of sourceImages.entries()) {
        const imageResponse = await fetch(sourceImage);
        if (!imageResponse.ok) {
          throw new Error(`参考图片读取失败（${imageResponse.status}）`);
        }
        form.append('image', await imageResponse.blob(), `image-${index}.png`);
      }
      response = await fetch(`${runtimeModel.baseURL}/images/edits`, {
        headers: { Authorization: `Bearer ${runtimeModel.apiKey}` },
        method: 'POST',
        body: form,
      });
    } else {
      const size = outputSize(config);
      console.log('image request', {
        endpoint: 'generations',
        model: runtimeModel.modelId,
        size,
        count: config?.count || 1,
      });
      response = await fetch(`${runtimeModel.baseURL}/images/generations`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${runtimeModel.apiKey}`,
        },
        method: 'POST',
        body: JSON.stringify({
          model: runtimeModel.modelId,
          prompt: text.trim(),
          n: config?.count || 1,
          size,
        }),
      });
    }
    const data = await response.json();

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
