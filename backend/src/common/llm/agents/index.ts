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
import { alMode } from '..';
import { resolve } from 'path';
import { genImage } from './gen-image';
import { genImageTools } from '../tools/gen-image';
import { readImage } from './read-image';
import { genScript } from './gen-script';

export const backend = new LocalShellBackend({
  rootDir: process.cwd(),
  virtualMode: false,
});

export const agent: DeepAgent = createDeepAgent({
  model: alMode,
  backend,
  tools: [genImageTools],
  skills: [resolve(__dirname, '../skills')],
  subagents: [genScript, genImage, readImage],
});
