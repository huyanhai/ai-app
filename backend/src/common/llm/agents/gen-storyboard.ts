import { createAgent } from 'langchain';
import { imageMode } from '..';
import { AnySubAgent } from 'deepagents';
import { genImageTools } from '../tools/gen-image';

const graph = createAgent({
  model: imageMode,
});

export const genStoryboard: AnySubAgent = {
  name: '故事板生成',
  description: '根据场景和角色生成详细',
  systemPrompt: '你是一个图片生成助手，可以根据用户的描述进行图片生成',
  runnable: graph,
  tools: [genImageTools],
};
