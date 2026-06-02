import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

// ============================================================
// BestImageSelector — 最佳图选择器
// 职责：从多张候选生成图中，基于参考图和目标描述，
// 按角色一致性 → 空间一致性 → 描述准确性的优先级选出一张最佳图。
// ============================================================

// ── Prompts ──

const SYSTEM_PROMPT = `[Role]
You are a professional visual assessment expert. Your expertise includes identifying Character Consistency and Spatial Consistency between candidate image and reference image, and assessing semantic consistency between candidate image and text description.

[Task]
Based on the reference image provided by the user, the text description of the target image, and several candidate images, evaluate which candidate image performs best in Character Consistency, Spatial Consistency, and Description Accuracy.

[Input]
The user will provide the following content:
- Reference images with brief text descriptions.
- Candidate images to be evaluated.
- Text description for target image enclosed within <TARGET_DESCRIPTION_START> and <TARGET_DESCRIPTION_END> tags.

[Output]
{format_instructions}

[Guidelines]
- Prioritize Character Consistency.
- Focus on Spatial Consistency.
- Strictly Compare with Text Description.
- If multiple images partially meet the criteria, select the one with the highest overall consistency.
- Avoid subjective preferences; base all analysis on objective comparisons.
- Prioritize images without white borders, black edges, or any additional framing.`;

const HUMAN_PROMPT = `<TARGET_DESCRIPTION_START>
{target_description}
<TARGET_DESCRIPTION_END>`;

// ── Schema ──

const BestImageSchema = z.object({
  best_image_index: z.number().describe('The index of the best image.'),
  reason: z.string().describe('The reason why the image is the best.'),
});

// ── Agent ──

export class BestImageSelector {
  constructor(private model: ChatOpenAI) {}

  /** 从候选图中选最佳一张，返回其路径。无候选图时抛异常。 */
  async select(
    referencePairs: Array<{ path: string; text: string }>,
    targetDescription: string,
    candidatePaths: string[],
  ): Promise<string> {
    if (candidatePaths.length === 0) {
      throw new Error('No candidate images to select from');
    }

    const formatInstructions =
      'Return a JSON object with keys: best_image_index (number), reason (string).';

    let humanContent = '';
    for (let idx = 0; idx < referencePairs.length; idx++) {
      humanContent += `Reference Image ${idx}: ${referencePairs[idx].text}\n`;
    }
    for (let idx = 0; idx < candidatePaths.length; idx++) {
      humanContent += `Candidate Image ${idx}: ${candidatePaths[idx]}\n`;
    }
    humanContent += HUMAN_PROMPT.replace('{target_description}', targetDescription);

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(humanContent),
    ];

    const modelWithStructure = this.model.withStructuredOutput(BestImageSchema, {
      name: 'select_best_image',
      method: 'functionCalling',
    });

    const response = await modelWithStructure.invoke(messages);
    const idx = response.best_image_index;

    if (!Number.isInteger(idx) || idx < 0 || idx >= candidatePaths.length) {
      return candidatePaths[0];
    }

    return candidatePaths[idx];
  }
}
