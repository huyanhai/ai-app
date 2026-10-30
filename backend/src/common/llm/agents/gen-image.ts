import { createAgent } from 'langchain';
import { AnySubAgent } from 'deepagents';
import { createChatModel, RuntimeModel } from '..';
import { createGenImageTool } from '../tools/gen-image';

export const createGenImageAgent = (
  runtimeModel: RuntimeModel,
): AnySubAgent => ({
  name: '图片生成',
  description: '根据用户的要求生成图片',
  systemPrompt: '你是一个图片生成助手，可以根据用户的描述进行图片生成',
  runnable: createAgent({ model: createChatModel(runtimeModel) }),
  tools: [createGenImageTool(runtimeModel)],
});
