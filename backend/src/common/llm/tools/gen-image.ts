import { ContentBlock, HumanMessage, tool } from 'langchain';
import * as z from 'zod';

export async function genImage(prompt: string | HumanMessage['content'][0][]) {
  let text = '';
  let content = [];

  if (typeof prompt === 'string') {
    content.push({ text: prompt });
  } else {
    prompt.forEach((item: any) => {
      if (item.type === 'text') {
        text += item.text;
      }
      if (item.type === 'image_url') {
        text += `[图片]`;
        content.push({
          image: item.image_url,
        });
      }
    });
    content.push({
      text,
    });
  }

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
              content,
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
    return genImage(prompt);
  },
  {
    name: '图片生成',
    description: '当用户需要生成图片的时候，使用此工具进行图片生成',
    schema: z.object({
      prompt: z.string().describe('生成图片的提示词'),
    }),
  },
);
