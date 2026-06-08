import { StreamDto } from '../../../modules/pipeline/dto/stream.dto';
import { ContentBlock, tool } from 'langchain';
import * as z from 'zod';

export interface IVideoMedia {
  url: string;
  type: string;
}

const model = {
  textToVideo: process.env.ALI_TEXT_VIDEO_MODEL,
  imageToVideo: process.env.ALI_IMAGE_VIDEO_MODEL,
  firstAndLastFrameToVideo: process.env.ALI_FRAME_VIDEO_MODEL,
};

export async function genVideo({ message, config }: StreamDto) {
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

  console.log(prompt, media, model[config.videoMode]);

  try {
    const data = await fetch(process.env.ALI_VIDEO_URL, {
      headers: {
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ALI_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({
        model: model[config.videoMode] || model.textToVideo,
        input: {
          prompt,
          media,
        },
        parameters: {
          resolution: '720P',
          duration: config?.duration || 5,
          prompt_extend: true,
          watermark: false,
          ratio: config?.ratio || '16:9',
        },
      }),
    }).then((res) => res.json());
    const result = data?.output;

    if (result.task_status === 'PENDING') {
      return result;
    }
    return data.message;
  } catch (error) {
    return error;
  }
}

export const genVideoTools: any = tool(
  async ({ prompt }) => {
    return genVideo({
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
