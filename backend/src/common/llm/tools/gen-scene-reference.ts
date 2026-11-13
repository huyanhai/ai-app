import { HumanMessage } from 'langchain';
import { createChatModel, RuntimeModel } from '..';
import { genImage } from './gen-image';

export async function genSceneReferenceImage(
  input: Parameters<typeof genImage>[0],
  reviewerModel: RuntimeModel,
) {
  const reviewer = createChatModel(reviewerModel, {
    temperature: 0,
    maxTokens: 128,
    timeout: 60_000,
    maxRetries: 0,
    modelKwargs: reviewerModel.modelId?.startsWith('sensenova-')
      ? { reasoning_effort: 'none' }
      : undefined,
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await genImage({
      ...input,
      config: { ...input.config, count: 1, edit: false },
      message: attempt === 0 ? input.message : [
        ...input.message,
        {
          type: 'text',
          text: '重新绘制同一场地的纯空景。上一张错误地出现了生命主体；只画建筑、地形、植物、水、天空和静物，不画任何人物、动物、鱼或昆虫。',
        },
      ],
      textList: [],
    });
    const image = result.content[0]?.image;
    if (!image) throw new Error('图片生成接口未返回结果');
    const review = await reviewer.invoke([
      new HumanMessage({
        content: [
          {
            type: 'text',
            text: '只看图片内容，判断是否出现任何可辨认的人、拟人角色或动物（包括猫、鱼、鸟、昆虫，以及倒影、雕像和画中形象）。有或无法确定时只回答 OCCUPIED；完全没有时只回答 EMPTY。不要根据生成提示词判断。',
          },
          { type: 'image_url', image_url: { url: image } },
        ],
      }),
    ]);
    const verdict = review.text.trim().toUpperCase();
    if (verdict === 'EMPTY') return { content: [result.content[0]] };
    if (verdict !== 'OCCUPIED')
      throw new Error('无法确认场景参考图是否为空景，请检查视觉模型配置后重试');
  }
  throw new Error('场景参考图多次出现人物或动物，请修改场景提示词后重试');
}
