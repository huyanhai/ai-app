import { createAgent } from 'langchain';
import { AnySubAgent } from 'deepagents';
import { createChatModel, RuntimeModel } from '..';

export const createReadImageAgent = (
  runtimeModel: RuntimeModel,
): AnySubAgent => ({
  name: '图片内容识别',
  description: '识别上传的图片内容',
  systemPrompt: '你是一个图片解析助手，可以根据用户上传的图片文件识别图片内容',
  runnable: createAgent({ model: createChatModel(runtimeModel) }),
});
