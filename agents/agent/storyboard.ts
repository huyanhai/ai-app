import { ChatOpenAI } from "@langchain/openai";
import { TCharacterInScene } from "./character-extractor";
import { HumanMessage, SystemMessage } from "langchain";
import { z } from "zod";

// ── 分镜 ──

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
You are a professional visual text analyst and cinematic prompt engineer, proficient in cinematic language and shot narration. Your expertise lies in deconstructing a comprehensive shot description and character details, then recomposing them into two specialized, production-ready prompts.

[Task]
Your task is to analyze the provided shot description and character information, and produce two distinct, comprehensive prompts:

1. **分镜提示词 (visualPrompt)**: A rich, detailed prompt for AI image generation. It must fuse ALL of the following into a cohesive paragraph using the format: [FIELD_LABEL] + content. The fields to include are:
   - 画面构图: composition, shot size, camera angle
   - Character description and their action (using <name> notation)
   - 人物空间与互动关系: spatial relationship between character and environment
   - 极具体的微表情与面部特写: detailed micro-expressions and close-up descriptions
   - 明确的场景环境元素与前景/背景道具: environmental elements, props, foreground/background
   - 光影几何与大气效果: lighting, volumetric effects, color palette
   - 视觉风格/胶片质感: visual style, film stock feel
   - 技术参数: lens, aperture, camera specs

2. **视频运动提示词 (motionVideoPrompt)**: A rich, detailed prompt for AI video generation (first-frame + last-frame + motion). It must fuse ALL of the following into a cohesive paragraph using the format: [FIELD_LABEL] + content. The fields to include are:
   - 明确的摄影机运镜轨迹与速度: camera movement trajectory and speed
   - 主体极其具体的物理动作细节与微表情变化: character's physical action details and micro-expression changes over time
   - 角色之间的精确肢体互动过程: precise character-to-character interaction (if any)
   - 环境物理动态: environmental physics (wind, water, light changes, etc.)
   - 音效与音乐氛围描述: sound effects and music atmosphere
   - 对话台词与语气: dialogue text and tone
   - 时长: shot duration in seconds

[Input]
You will receive a single visual text description of a shot, along with character information.
- The description is enclosed within <VISUAL_DESC> and </VISUAL_DESC>.
- The character list is enclosed within <CHARACTERS> and </CHARACTERS>.
- Additional shot metadata (shot type, duration, emotion, scene tags, lighting, dialogue, character action) is enclosed within <SHOT_META> and </SHOT_META>.

[Output]
{format_instructions}

[Guidelines]
- Ensure all output values match the language used in the script.
- Use the [FIELD_LABEL] + notation for each section within the two prompts.
- Keep character names in angle brackets (e.g., <Alice>) in both prompts.
- The visual prompt should be a complete, self-contained description ready for image generation.
- The motion video prompt should focus on what changes/moves between the first and last frame.
- Use accurate, concise, and professional descriptive language. Avoid metaphors or emotional flourishes.
- Below are the three types of variation within a shot:
(1) 'large': significant change in composition and focus.
(2) 'medium': introduction of new characters or a character turns from back to front.
(3) 'small': minor changes, such as expression changes, movement of existing characters.`;

const HUMAN_DECOMPOSE = `<VISUAL_DESC>
{visual_desc}
</VISUAL_DESC>

<CHARACTERS>
{characters}
</CHARACTERS>

<SHOT_META>
Shot Type: {shot_type}
Duration: {duration}s
Emotion: {emotion}
Scene Tags: {scene_tags}
Lighting: {lighting}
Dialogue: {dialogue}
Character Action: {character_action}
</SHOT_META>`;

// ── Schemas ──

/** 分镜中的每个镜头 */
export const ShotBriefDescriptionSchema = z.object({
  idx: z
    .number()
    .describe("The index of the shot in the sequence, starting from 0"),
  isLast: z.boolean().describe("Whether this is the last shot"),
  cameraIdx: z.number().describe("The index of the camera in the scene"),
  /** 画面描述 */
  visualDesc: z
    .string()
    .describe(
      "A vivid visual description of the shot, including composition, character action, environment, lighting",
    ),
  /** 音效 */
  audioDesc: z
    .string()
    .optional()
    .describe("A detailed description of the audio in the shot"),
  /** 对白 */
  dialogue: z
    .string()
    .default("")
    .describe("Dialogue text and delivery tone for this shot, if any"),
  /** 景别 */
  shotType: z
    .string()
    .describe(
      "The shot size/type: 特写/近景/中景/全景/远景 (close-up/medium/wide/establishing)",
    ),
  /** 时长 */
  duration: z
    .number()
    .describe("Duration of the shot in seconds (usually 3-6)"),
  /** 情绪 */
  emotion: z
    .string()
    .describe("Emotional tone of the shot, e.g. 宁静/期盼/狂喜/释然"),
  /** 场景标签 */
  sceneTags: z
    .string()
    .describe("Scene keywords/tags, e.g. 高山之巅，晨雾，日出破晓"),
  /** 光影氛围 */
  lighting: z
    .string()
    .describe(
      "Lighting and atmosphere description, e.g. 强烈的暖金色逆光，绝美的丁达尔效应",
    ),
  /** 机位角度 */
  cameraAngle: z
    .string()
    .default("")
    .describe("Camera angle: 平视/俯视/仰视/航拍"),
});

export type TShotBriefDescription = z.infer<typeof ShotBriefDescriptionSchema>;

/** 拆分后输出的组合 Prompt 结构 */
const visDescDecompositionSchema = z.object({
  /** 分镜提示词 — 融合画面/角色/空间/微表情/环境/光影/风格/技术参数的完整图像生成提示 */
  visualPrompt: z
    .string()
    .describe(
      "The complete visual prompt for image generation, combining composition, character, spatial relationship, micro-expression, environment, lighting, visual style, and technical specs. Use [FIELD_LABEL] + notation.",
    ),
  /** 视频运动提示词 — 融合运镜/角色动作/环境动态/音效/对白/时长的完整视频生成提示 */
  motionVideoPrompt: z
    .string()
    .describe(
      "The complete motion video prompt for video generation (first+last frame to video), combining camera movement, character action details, environment dynamics, sound effects, dialogue, and duration. Use [FIELD_LABEL] + notation.",
    ),
  variationType: z
    .enum(["large", "medium", "small"])
    .describe(
      "The degree of change between first and last frame: large (composition change), medium (new character enters), small (expression change)",
    ),
  variationReason: z
    .string()
    .describe("The reason for the variation type choice"),
});

/**
 * 分镜
 * 为单个剧本场景设计完整故事板，返回镜头序列。
 * 每个镜头包含：镜头索引、景别、时长、情绪、场景标签、光影氛围、
 * 对白、画面描述、音效描述、机位角度。
 */
export function designStoryboard(
  llm: ChatOpenAI,
  script: string,
  characters: TCharacterInScene[],
  userRequirement?: string,
) {
  const formatInstructions = `
Return ONLY valid JSON. Return a JSON object with key "storyboard".
Each shot object MUST include following keys:
- idx (number): shot index, starting from 0
- isLast (boolean): whether this is the last shot
- cameraIdx (number): camera index
- visualDesc (string): vivid visual description of the shot
- audioDesc (string): sound/audio description (empty string if none)
- dialogue (string): dialogue text (empty string if none)
- shotType (string): 景别 — one of 特写/近景/中景/全景/远景
- duration (number): shot length in seconds (3-6)
- emotion (string): emotional tone — e.g. 宁静/期盼/狂喜/释然/虔诚
- sceneTags (string): scene keywords — e.g. 高山之巅，晨雾，日出破晓
- lighting (string): lighting and atmosphere — e.g. 强烈的暖金色逆光，绝美的丁达尔效应
- cameraAngle (string): camera angle — e.g. 平视/俯视/仰角/航拍
`;

  const charactersStr = characters
    .map(
      (c, i) =>
        `Character ${i}: ${c.identifierInScene}[${c.isVisible ? "visible" : "not visible"}]\nstatic features: ${c.staticFeatures}\ndynamic features: ${c.dynamicFeatures}`,
    )
    .join("\n");

  return llm.withStructuredOutput(storyboardResponseSchema).invoke([
    new SystemMessage(
      SYSTEM_DESIGN_STORYBOARD.replace(
        "{format_instructions}",
        formatInstructions,
      ),
    ),
    new HumanMessage(
      HUMAN_DESIGN_STORYBOARD.replace("{script}", script)
        .replace("{characters}", charactersStr)
        .replace("{user_requirement}", userRequirement ?? ""),
    ),
  ]);
}

/**
 * 将分镜镜头拆解为两个完整组合 Prompt：
 * - visualPrompt：分镜提示词（用于图像生成）
 * - motionVideoPrompt：视频运动提示词（用于首尾帧生视频）
 *
 * 替代原来的独立 ff_desc / lf_desc / motion_desc，
 * 直接按标准格式输出可直接消费的组合提示词。
 */
export function decomposeVisualDescription(
  llm: ChatOpenAI,
  shot: TShotBriefDescription,
  characters: TCharacterInScene[],
) {
  const formatInstructions =
    "Return a JSON object with keys: visualPrompt (string), motionVideoPrompt (string), variationType (string: large/medium/small), variationReason (string).";

  const charactersStr = characters
    .map(
      (c) =>
        `${c.identifierInScene}: (static) ${c.staticFeatures}; (dynamic) ${c.dynamicFeatures}`,
    )
    .join("\n");

  return llm.withStructuredOutput(visDescDecompositionSchema).invoke([
    new SystemMessage(
      SYSTEM_DECOMPOSE.replace("{format_instructions}", formatInstructions),
    ),
    new HumanMessage(
      HUMAN_DECOMPOSE.replace("{visual_desc}", shot.visualDesc)
        .replace("{characters}", charactersStr)
        .replace("{shot_type}", shot.shotType)
        .replace("{duration}", String(shot.duration))
        .replace("{emotion}", shot.emotion)
        .replace("{scene_tags}", shot.sceneTags)
        .replace("{lighting}", shot.lighting)
        .replace("{dialogue}", shot.dialogue ?? "")
        .replace("{character_action}", ""),
    ),
  ]);
}

// ── Response Schemas ──
// 直接复用 ShotBriefDescriptionSchema，保证类型完全一致

const storyboardResponseSchema = z.object({
  storyboard: z
    .array(ShotBriefDescriptionSchema)
    .describe("A complete storyboard of the scene."),
});

/** 将故事板数据序列化为 CSV-兼容的行 */
export function serializeStoryboardRow(
  shot: TShotBriefDescription,
  index: number,
  characters: TCharacterInScene[],
  visualPrompt: string,
  motionVideoPrompt: string,
): Record<string, unknown> {
  return {
    镜号: index + 1,
    时长: shot.duration,
    画面描述: shot.visualDesc,
    角色1: characters[0]?.identifierInScene ?? "",
    角色描述1: characters
      .map(
        (c) =>
          `[${c.identifierInScene}: (static) ${c.staticFeatures}; (dynamic) ${c.dynamicFeatures}]`,
      )
      .join(" "),
    角色图1: "",
    参考: "",
    景别: shot.shotType,
    角色动作: "",
    情绪: shot.emotion,
    场景标签: shot.sceneTags,
    光影氛围: shot.lighting,
    音效: shot.audioDesc ?? "",
    对白: shot.dialogue ?? "",
    分镜提示词: visualPrompt,
    视频运动提示词: motionVideoPrompt,
  };
}
