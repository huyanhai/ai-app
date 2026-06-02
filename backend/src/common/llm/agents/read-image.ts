// ============================================================
// read-image — 图片内容识别 SubAgent
// 职责：识别用户上传图片中的内容，底层使用 senModel。
// 通过 DeepAgents 框架注册为子代理。
// ============================================================

import { createAgent } from 'langchain';
import { senModel } from '..';
import { AnySubAgent } from 'deepagents';

const graph = createAgent({
  model: senModel,
});

export const readImage: AnySubAgent = {
  name: '图片内容识别',
  description: '识别上传的图片内容',
  systemPrompt: '你是一个图片解析助手，可以根据用户上传的图片文件识别图片内容',
  runnable: graph,
};
