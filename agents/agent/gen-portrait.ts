import type { TCharacterInScene } from "./character-extractor";

/**
 * 生成角色三视图合辑 Prompt（正面 / 侧面 / 背面 拼在一张图上）
 * 适用于角色设定参考图，纯白背景，从左到右排列
 */
export function genTurnaroundPrompt(
  character: TCharacterInScene,
  style: string,
): string {
  const features = `(static) ${character.staticFeatures}; (dynamic) ${character.dynamicFeatures}`;
  return [
    `A character turnaround reference sheet of ${character.identifierInScene}, showing three full-body views side by side on a pure white background.`,
    `From left to right: front view, side view (facing left), back view. Each view is evenly spaced, same scale, standing upright with arms relaxed at sides. Natural expression.`,
    `Features: ${features}`,
    `Style: ${style}`,
    `Clean layout, no text labels, consistent lighting across all views.`,
  ].join("\n");
}
