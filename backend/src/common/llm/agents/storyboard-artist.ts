import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { ShotBriefDescriptionSchema, type ShotBriefDescription, type CharacterInScene } from '../models';

// ============================================================
// StoryboardArtist — 分镜师
// 职责：将剧本场景拆解为逐镜头（Shot）的可视化描述，
// 并对每个镜头做"首帧→末帧→运动"的三段式拆解，
// 用于后续图像生成和动画制作。
// ============================================================

// ── Prompts ──

const SYSTEM_DESIGN_STORYBOARD = `[Role]
You are a professional storyboard artist with the following core skills:
- Script Analysis: Ability to quickly interpret a script's text, identifying the setting, character actions, dialogue, emotions, and narrative pacing.
- Visualization: Expertise in translating written descriptions into visual frames, including composition, lighting, and spatial arrangement.
- Storyboarding: Proficiency in cinematic language, such as shot types (e.g., close-up, medium shot, wide shot), camera angles (e.g., high angle, eye-level), camera movements (e.g., zoom, pan), and transitions.
- Narrative Continuity: Ability to ensure the storyboard sequence is logically smooth, highlights key plot points, and maintains emotional consistency.
- Technical Knowledge: Understanding of basic storyboard formats and industry standards.

[Task]
Your task is to design a complete storyboard based on a user-provided script (which contains only one scene). The storyboard should be presented in text form, clearly displaying the visual elements and narrative flow of each shot.

[Input]
The user will provide the following input.
- Script: A complete scene script. The script input is enclosed within <SCRIPT> and </SCRIPT>.
- Characters List: A list describing basic information for each character. Enclosed within <CHARACTERS> and </CHARACTERS>.
- User requirement (optional): Enclosed within <USER_REQUIREMENT> and </USER_REQUIREMENT>.

[Output]
{format_instructions}

[Guidelines]
- Ensure all output values match the language used in the script.
- Each shot must have a clear narrative purpose.
- Use cinematic language deliberately.
- Keep character names in visual descriptions and speaker fields consistent with the character list. In visual descriptions, enclose names in angle brackets (e.g., <Alice>), but not in dialogue or speaker fields.
- When describing visual elements, indicate the position of the element within the frame.
- Avoid unsafe content (violence, discrimination, etc.) in visual descriptions.
- Assign at most one dialogue line per character per shot.
- Each shot requires an independent description without reference to each other.
- When the shot focuses on a character, describe which specific body part the focus is on.
- When describing a character, indicate the direction they are facing.`;

const HUMAN_DESIGN_STORYBOARD = `<SCRIPT>
{script}
</SCRIPT>

<CHARACTERS>
{characters}
</CHARACTERS>

<USER_REQUIREMENT>
{user_requirement}
</USER_REQUIREMENT>`;

const SYSTEM_DECOMPOSE = `[Role]
You are a professional visual text analyst, proficient in cinematic language and shot narration. Your expertise lies in deconstructing a comprehensive shot description accurately into three core components: the static first frame, the static last frame, and the dynamic motion that connects them.

[Task]
Your task is to dissect and rewrite a user-provided visual text description of a shot strictly and insightfully into three distinct parts:
- First Frame Description: Describe the static image at the very beginning of the shot.
- Last Frame Description: Describe the static image at the very end of the shot.
- Motion Description: Describe all movements that occur between the first frame and the last frame.

[Input]
You will receive a single visual text description of a shot.
Additionally, you will receive a sequence of potential characters.
- The description is enclosed within <VISUAL_DESC> and </VISUAL_DESC>.
- The character list is enclosed within <CHARACTERS> and </CHARACTERS>.

[Output]
{format_instructions}

[Guidelines]
- Ensure all output values match the language used in the script.
- Ensure the first and last frame descriptions are pure "snapshots," containing no ongoing actions.
- In the motion description, clearly distinguish between camera movement and on-screen movement.
- In the motion description, you cannot directly use character names to refer to characters; instead, use visible characteristics.
- The last frame description must be logically consistent with the first frame description and the motion description.
- Use accurate, concise, and professional descriptive language. Avoid metaphors or emotional flourishes.
- Below are the three types of variation within a shot:
(1) 'large': significant change in composition and focus.
(2) 'medium': introduction of new characters or a character turns from back to front.
(3) 'small': minor changes, such as expression changes, movement of existing characters.
- When describing a character, indicate the direction they are facing.
- The first shot must establish the overall scene environment, using the widest possible shot.
- Use as few camera positions as possible.`;

const HUMAN_DECOMPOSE = `<VISUAL_DESC>
{visual_desc}
</VISUAL_DESC>

<CHARACTERS>
{characters}
</CHARACTERS>`;

// ── Schemas ──

const StoryboardResponseSchema = z.object({
  storyboard: z
    .array(ShotBriefDescriptionSchema)
    .describe('A complete storyboard of the scene, including the visual and audio description of each shot.'),
});

const VisDescDecompositionSchema = z.object({
  ff_desc: z.string().describe('A detailed description of the first frame of the shot.'),
  ff_vis_char_idxs: z.array(z.number()).describe('Indices of characters visible in the first frame.'),
  lf_desc: z.string().describe('A detailed description of the last frame of the shot.'),
  lf_vis_char_idxs: z.array(z.number()).describe('Indices of characters visible in the last frame.'),
  motion_desc: z.string().describe('The motion description of the shot.'),
  variation_type: z.enum(['large', 'medium', 'small']).describe('The degree of change between first and last frame.'),
  variation_reason: z.string().describe('The reason for the variation type.'),
});

// ── Agent ──

export class StoryboardArtist {
  constructor(private model: ChatOpenAI) {}

  /**
   * 为单个剧本场景设计完整故事板，返回镜头序列。
   * 每个镜头包含：镜头类型、视觉描述、音频描述、摄影机索引。
   */
  async designStoryboard(
    script: string,
    characters: CharacterInScene[],
    userRequirement?: string,
  ): Promise<ShotBriefDescription[]> {
    const formatInstructions =
      'Return ONLY valid JSON. Return a JSON object with key "storyboard". Each shot object MUST include: idx (number), is_last (boolean), cam_idx (number), visual_desc (string), audio_desc (string). Do not omit audio_desc; if no obvious audio exists, set audio_desc to an empty string.';

    const charactersStr = characters
      .map((c, i) => `Character ${i}: ${c.identifier_in_scene}[${c.is_visible ? 'visible' : 'not visible'}]\nstatic features: ${c.static_features}\ndynamic features: ${c.dynamic_features}`)
      .join('\n');

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_DESIGN_STORYBOARD.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(
        HUMAN_DESIGN_STORYBOARD.replace('{script}', script)
          .replace('{characters}', charactersStr)
          .replace('{user_requirement}', userRequirement ?? ''),
      ),
    ];

    const modelWithStructure = this.model.withStructuredOutput(StoryboardResponseSchema, {
      method: 'jsonMode',
    });

    const result = await modelWithStructure.invoke(messages);
    return result.storyboard.map((shot) => ({
      ...shot,
      audio_desc: shot.audio_desc ?? '',
    }));
  }

  /**
   * 将单个镜头的视觉描述拆解为三部分：首帧画面、末帧画面、运动描述。
   * 同时标注变化类型（large / medium / small），用于判断镜头动态程度。
   */
  async decomposeVisualDescription(
    visualDesc: string,
    characters: CharacterInScene[],
  ): Promise<z.infer<typeof VisDescDecompositionSchema>> {
    const formatInstructions =
      'Return a JSON object with keys: ff_desc (string), ff_vis_char_idxs (array of numbers), lf_desc (string), lf_vis_char_idxs (array of numbers), motion_desc (string), variation_type (string: large/medium/small), variation_reason (string).';

    const charactersStr = characters
      .map(
        (c) =>
          `${c.identifier_in_scene}: (static) ${c.static_features}; (dynamic) ${c.dynamic_features}`,
      )
      .join('\n');

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_DECOMPOSE.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(
        HUMAN_DECOMPOSE.replace('{visual_desc}', visualDesc).replace('{characters}', charactersStr),
      ),
    ];

    const modelWithStructure = this.model.withStructuredOutput(VisDescDecompositionSchema, {
      method: 'jsonMode',
    });

    return await modelWithStructure.invoke(messages);
  }
}
