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
): DeepAgent =>
  createDeepAgent({
    model: createChatModel(runtimeModel, { temperature: 0.7, streaming: true }),
    backend,
    tools: [createGenImageTool(runtimeModel)],
    skills: skillIds?.length
      ? skillIds.map((id) => resolve(__dirname, '../skills', id))
      : [resolve(__dirname, '../skills')],
    subagents: [
      createGenScriptAgent(runtimeModel),
      createGenImageAgent(runtimeModel),
      createReadImageAgent(runtimeModel),
    ],
  });
