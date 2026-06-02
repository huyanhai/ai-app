import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

// ============================================================
// ReferenceImageSelector — 参考图选择器
// 职责：从已有参考图库中智能选择最适合下一帧生成的图片，
// 保证角色/环境/风格一致性。
// 采用两阶段过滤：文本模型初筛 → 多模态模型精筛。
// ============================================================

// ── Prompts ──

const SYSTEM_PROMPT_TEXT = `[Role]
You are a professional visual creation assistant skilled in multimodal image analysis and reasoning.

[Task]
Your core task is to intelligently select the most suitable reference images from a provided set of reference image descriptions based on the user's text description, ensuring character consistency, environmental consistency, and style consistency.

[Input]
You will receive a text description of the target frame, along with a sequence of reference image descriptions.
- The text description of the target frame is enclosed within <FRAME_DESC> and </FRAME_DESC>.
- The sequence of reference image descriptions is enclosed within <SEQ_DESC> and </SEQ_DESC>. Each description is prefixed with its index, starting from 0.

[Output]
{format_instructions}

[Guidelines]
- Ensure that the language of all output values matches that used in the frame description.
- Prioritize image descriptions with similar compositions.
- The images from prior frames are arranged in chronological order. Give higher priority to more recent images.
- Choose reference image descriptions that are as concise as possible and avoid duplicate information.
- When a new character appears, prioritize selecting their portrait image description.
- For character portraits, select at most one image from multiple views.
- Select at most 8 optimal reference image descriptions.`;

const SYSTEM_PROMPT_MULTIMODAL = `[Role]
You are a professional visual creation assistant skilled in multimodal image analysis and reasoning.

[Task]
Your core task is to intelligently select the most suitable reference images from a provided reference image library based on the user's text description, ensuring character consistency, environmental consistency, and style consistency.

[Input]
You will receive a text description of the target frame, along with a sequence of reference images.
- The text description of the target frame is enclosed within <FRAME_DESC> and </FRAME_DESC>.
- The sequence of reference images is enclosed within <SEQ_IMAGES> and </SEQ_IMAGES>. Each reference image is provided with a text description. The reference images are indexed starting from 0.

[Output]
{format_instructions}

[Guidelines]
- Prioritize image descriptions with similar compositions.
- The images from prior frames are arranged in chronological order. Give higher priority to more recent images.
- Choose reference image descriptions that are as concise as possible and avoid duplicate information.
- When a new character appears, prioritize selecting their portrait image description.
- For character portraits, select at most one image from multiple views.
- Select at most 8 optimal reference image descriptions.`;

const HUMAN_TEMPLATE = `<FRAME_DESC>
{frame_description}
</FRAME_DESC>`;

// ── Schema ──

const RefImageSchema = z.object({
  ref_image_indices: z
    .array(z.number())
    .describe('Indices of reference images selected from the provided images.'),
  text_prompt: z
    .string()
    .describe(
      'Text description to guide the image generation, specifying which elements should reference which image.',
    ),
});

export interface ImageTextPair {
  path: string;
  text: string;
}

export interface SelectorOutput {
  referenceImagePathAndTextPairs: ImageTextPair[];
  textPrompt: string;
}

// ── Agent ──

export class ReferenceImageSelector {
  constructor(private model: ChatOpenAI) {}

  /**
   * 选择参考图并生成综合 Text Prompt。
   * 当候选图 >= 8 张时，先用纯文本模型初筛；
   * 再用多模态模型精筛（最多保留 8 张）。
   * 返回选中图片路径 + 综合生成 Prompt。
   */
  async selectReferenceImagesAndGeneratePrompt(
    availablePairs: ImageTextPair[],
    frameDescription: string,
  ): Promise<SelectorOutput> {
    let filteredPairs = availablePairs;

    // 1. Filter using text-only model if too many images
    if (availablePairs.length >= 8) {
      const formatInstructions =
        'Return a JSON object with keys: ref_image_indices (array of numbers), text_prompt (string).';

      const humanContent = availablePairs
        .map((pair, idx) => `Image ${idx}: ${pair.text}`)
        .join('\n');

      const messages: BaseMessage[] = [
        new SystemMessage(
          SYSTEM_PROMPT_TEXT.replace('{format_instructions}', formatInstructions),
        ),
        new HumanMessage(
          `${humanContent}\n${HUMAN_TEMPLATE.replace('{frame_description}', frameDescription)}`,
        ),
      ];

      const textModel = this.model.withStructuredOutput(RefImageSchema, {
        name: 'select_reference_images',
        method: 'functionCalling',
      });

      try {
        const ref = await textModel.invoke(messages);
        filteredPairs = ref.ref_image_indices.map((i: number) => availablePairs[i]);
      } catch {
        // If structured output fails, use all pairs
      }
    }

    // 2. Filter using multimodal model
    const formatInstructions =
      'Return a JSON object with keys: ref_image_indices (array of numbers), text_prompt (string).';

    let humanContent = '';
    for (let idx = 0; idx < filteredPairs.length; idx++) {
      humanContent += `Image ${idx}: ${filteredPairs[idx].text}\n`;
    }
    humanContent += HUMAN_TEMPLATE.replace('{frame_description}', frameDescription);

    const messages: BaseMessage[] = [
      new SystemMessage(
        SYSTEM_PROMPT_MULTIMODAL.replace('{format_instructions}', formatInstructions),
      ),
      new HumanMessage(humanContent),
    ];

    const multimodalModel = this.model.withStructuredOutput(RefImageSchema, {
      name: 'select_reference_images_multimodal',
      method: 'functionCalling',
    });

    try {
      const response = await multimodalModel.invoke(messages);
      const selectedPairs = response.ref_image_indices.map((i: number) => filteredPairs[i]);
      return {
        referenceImagePathAndTextPairs: selectedPairs,
        textPrompt: response.text_prompt,
      };
    } catch {
      return {
        referenceImagePathAndTextPairs: filteredPairs.slice(0, 8),
        textPrompt: frameDescription,
      };
    }
  }
}
