import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "langchain";
import { z } from "zod";

// 帧图生成
const SYSTEM_PROMPT = `[Role]
你是一位专业的电影级图像生成提示词工程师，擅长将镜头画面描述转化为高质量AI图像生成提示词。

[Task]
根据用户提供的镜头画面描述（出自分镜拆解的首帧或末帧），生成专业图像生成提示词。

[Input]
你将收到<FRAME_DESC>和</FRAME_DESC>标签中的画面描述。

[Output]
{format_instructions}

[Guidelines]
- 保留原始画面描述中的所有视觉元素、构图和空间关系
- 添加画质规格：8K分辨率、大师级画质、细节丰富
- 根据画面内容提炼合适的视觉风格关键词
- 确定合适的画面比例（电影场景默认16:9）
- 描述中必须包含光影、色彩、构图等视觉语言
- 根据画面内容添加2-3个情感或氛围词
- 风格必须与画面描述中的内容保持一致
- 输出的语言与输入相同`;

const HUMAN_PROMPT = `<FRAME_DESC>
{frame_desc}
</FRAME_DESC>`;

const schema = z.object({
  actionInput: z
    .string()
    .describe("扩写后的图像描述，包含画质规格、光影色彩、情感氛围等"),
  style: z
    .string()
    .describe("风格关键词，多个用斜杠分隔，如：电影级摄影/写实/赛博朋克"),
  aspectRatio: z.string().describe("画面比例，默认 16:9"),
});

/**
 * 将分镜拆解后的帧画面描述转化为图像生成提示词
 * 返回格式与 imagePrompt 一致，可直接用于 genImage
 */
export function genFramePrompt(
  llm: ChatOpenAI,
  frameDesc: string,
  styleHint?: string,
) {
  const formatInstructions =
    'Return a JSON object with keys: action_input (string), style (string), aspect_ratio (string).';

  const humanContent = styleHint
    ? `${HUMAN_PROMPT.replace("{frame_desc}", frameDesc)}\n\n风格提示：${styleHint}`
    : HUMAN_PROMPT.replace("{frame_desc}", frameDesc);

  return llm
    .withStructuredOutput(schema)
    .invoke([
      new SystemMessage(
        SYSTEM_PROMPT.replace("{format_instructions}", formatInstructions),
      ),
      new HumanMessage(humanContent),
    ]);
}
