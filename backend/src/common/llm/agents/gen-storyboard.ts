import { createAgent } from 'langchain';
import { AnySubAgent } from 'deepagents';
import { createChatModel, RuntimeModel } from '..';
import { createGenImageTool } from '../tools/gen-image';

export const createGenStoryboardAgent = (
  runtimeModel: RuntimeModel,
): AnySubAgent => ({
  name: '故事板生成',
  description: '根据场景和角色生成详细',
  systemPrompt: '你是一个图片生成助手，可以根据用户的描述进行图片生成',
  runnable: createAgent({ model: createChatModel(runtimeModel) }),
  tools: [createGenImageTool(runtimeModel)],
});
