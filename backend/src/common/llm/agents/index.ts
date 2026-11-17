export { Screenwriter } from './screenwriter';
export { ScriptPlanner } from './script-planner';
export { ScriptEnhancer } from './script-enhancer';
export { CharacterExtractor } from './character-extractor';
export { StoryboardArtist } from './storyboard-artist';
export { CharacterPortraitsGenerator } from './character-portraits-generator';
export { ReferenceImageSelector } from './reference-image-selector';
export { CameraImageGenerator } from './camera-image-generator';
export { BestImageSelector } from './best-image-selector';
export { SceneExtractor } from './scene-extractor';
export { EventExtractor } from './event-extractor';
export { GlobalInformationPlanner } from './global-information-planner';
export { NovelCompressor } from './novel-compressor';

import { createDeepAgent, DeepAgent, LocalShellBackend } from 'deepagents';
import { createChatModel, RuntimeModel } from '..';
import { resolve } from 'path';
import { createGenImageAgent } from './gen-image';
import { createGenImageTool } from '../tools/gen-image';
import { createReadImageAgent } from './read-image';
import { createGenScriptAgent } from './gen-script';

export const backend = new LocalShellBackend({
  rootDir: process.cwd(),
  virtualMode: false,
});

export const createAgentWithModel = (
  runtimeModel: RuntimeModel,
  skillIds?: string[],
  additionalTools: any[] = [],
): DeepAgent =>
  createDeepAgent({
    model: createChatModel(runtimeModel, { temperature: 0.7, streaming: true }) as any,
    backend,
    tools: [createGenImageTool(runtimeModel), ...additionalTools],
    ...(additionalTools.length
      ? {
          systemPrompt: `你是当前 AI 视频创作画布里的 Agent。用中文简洁回复，通过工具帮助用户读取和修改画布。\n- 修改前先用 canvas_get_state 读取最新画布和稳定节点 ID；不要凭名称猜测 ID。\n- 只改用户要求涉及的内容，优先用一次 canvas_apply_ops 完成相关原子操作，再用 canvas_arrange 整理相关节点。\n- 节点提示词放在 data.draftText；文本节点的正文放在 data.text；媒体地址放在 data.url。\n- 连线表示上游参考流向下游。创建相关节点时同时创建连线，不要堆孤立节点。\n- 删除只针对用户明确指定的节点。所有修改都可撤销，不要重复执行已经成功的写操作。\n- 工具失败时说明原因；发生修订冲突时重新读取画布，再基于最新状态决定是否需要修改。\n- 视频工具只分析最后一帧，不得声称理解完整运动或音频。\n- 当前未配置网页搜索或网页读取能力，不要编造网页结果。\n- 不要复述工具调用过程，界面会展示；完成后简要概括实际结果。`,
        }
      : {}),
    skills: skillIds?.length
      ? skillIds.map((id) => resolve(__dirname, '../skills', id))
      : [resolve(__dirname, '../skills')],
    subagents: [
      createGenScriptAgent(runtimeModel),
      createGenImageAgent(runtimeModel),
      createReadImageAgent(runtimeModel),
    ],
  });
