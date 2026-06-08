import { StreamDto } from '@/modules/pipeline/dto/stream.dto';
import { ContentBlock, tool } from 'langchain';
import * as z from 'zod';

export async function genImage({ message, config, textList }: StreamDto) {
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
    const data = await fetch(process.env.ALI_IMAGE_URL, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ALI_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({
        model: process.env.ALI_IMAGE_MODEL,
        input: {
          messages: [
            {
              role: 'user',
              content: messages,
            },
          ],
        },
      }),
    }).then((res) => res.json());
    const result = data?.output?.choices?.[0]?.message;

    if (result) {
      return result;
    }
    return data.message;
  } catch (error) {
    return error;
  }
}

export const genImageTools: any = tool(
  async ({ prompt }) => {
    return genImage({
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
