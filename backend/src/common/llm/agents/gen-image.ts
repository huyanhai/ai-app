// ============================================================
// gen-image — 图片生成 SubAgent
// 职责：基于用户描述生成图片，底层使用 imageMode 模型和 genImageTools。
// 通过 DeepAgents 框架注册为子代理。
// ============================================================

import { createAgent } from 'langchain';
import { imageMode } from '..';
import { AnySubAgent } from 'deepagents';
import { genImageTools } from '../tools/gen-image';

const graph = createAgent({
  model: imageMode,
});

export const genImage: AnySubAgent = {
  name: '图片生成',
  description: '根据用户的要求生成图片',
  systemPrompt: '你是一个图片生成助手，可以根据用户的描述进行图片生成',
  runnable: graph,
  tools: [genImageTools],
};
