import type { CharacterInScene } from '../models';

// ============================================================
// CharacterPortraitsGenerator — 角色三视图 Prompt 生成器
// 职责：根据角色特征描述生成正面/侧面/背面的肖像 Prompt。
// 注意：本类只输出 Prompt 字串，不直接调用图像生成模型。
// ============================================================

export class CharacterPortraitsGenerator {
  /** 生成正面全身肖像 Prompt：纯白背景、居中站立、自然表情 */
  generateFrontPrompt(character: CharacterInScene, style: string): string {
    const features = `(static) ${character.static_features}; (dynamic) ${character.dynamic_features}`;
    return [
      `Generate a full-body, front-view portrait of character ${character.identifier_in_scene} based on the following description, with a pure white background.`,
      `The character should be centered in the image, occupying most of the frame. Gazing straight ahead. Standing with arms relaxed at sides. Natural expression.`,
      `Features: ${features}`,
      `Style: ${style}`,
    ].join('\n');
  }

  /** 生成左侧面全身肖像 Prompt */
  generateSidePrompt(character: CharacterInScene): string {
    return [
      `Generate a full-body, side-view portrait of character ${character.identifier_in_scene} based on the provided front-view portrait, with a pure white background.`,
      `The character should be centered in the image, occupying most of the frame. Facing left. Standing with arms relaxed at sides.`,
    ].join('\n');
  }

  /** 生成背面全身肖像 Prompt（不显示面部） */
  generateBackPrompt(character: CharacterInScene): string {
    return [
      `Generate a full-body, back-view portrait of character ${character.identifier_in_scene} based on the provided front-view portrait, with a pure white background.`,
      `The character should be centered in the image, occupying most of the frame. No facial features should be visible.`,
    ].join('\n');
  }
}
