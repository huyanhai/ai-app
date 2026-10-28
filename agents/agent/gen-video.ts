import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "langchain";
import { z } from "zod";

// 视频生成
const SYSTEM_PROMPT = `[Role]
你是一位专业的视频生成提示词工程师，擅长将分镜拆解数据转化为高质量视频生成提示词。

[Task]
根据用户提供的镜头首帧画面描述、末帧画面描述和运动描述，生成视频生成提示词。视频将使用首帧和末帧作为参考图，中间由AI补全运动过程。

[Input]
你将收到以下内容：
- <FIRST_FRAME>和</FIRST_FRAME>标签中的首帧画面描述
- <LAST_FRAME>和</LAST_FRAME>标签中的末帧画面描述
- <MOTION_DESC>和</MOTION_DESC>标签中的运动描述

[Output]
{format_instructions}

[Guidelines]
- 输出语言与输入相同
- 重点描述运动过程：从首帧到末帧之间发生了什么变化
- 区分摄影机运动和画面内物体运动
- 不要描述首帧或末帧的静态画面（那由参考图提供）
- 提示词应简洁聚焦，避免冗余
- 保持与原始画面描述一致的风格和氛围
- 根据运动复杂度推荐合理的视频时长（2-10秒）
- 大幅运动（人物走动、镜头移动等）推荐5-10秒
- 小幅运动（表情变化、微风吹动等）推荐2-4秒`;

const HUMAN_PROMPT = `<FIRST_FRAME>
{first_frame}
</FIRST_FRAME>

<LAST_FRAME>
{last_frame}
</LAST_FRAME>

<MOTION_DESC>
{motion_desc}
</MOTION_DESC>`;

const schema = z.object({
  prompt: z.string().describe("视频生成提示词，聚焦运动过程描述"),
  duration: z.number().describe("推荐视频时长（秒），根据运动复杂度 2-10 秒"),
  ratio: z.string().describe("画面比例，默认 16:9"),
});

/**
 * 将分镜拆解数据（首帧、末帧、运动描述）转化为视频生成提示词，
 * 用于 firstAndLastFrameToVideo 模式。
 * 返回 prompt + duration + ratio，可直接用于 genVideo。
 */
export function genVideoPrompt(
  llm: ChatOpenAI,
  firstFrame: string,
  lastFrame: string,
  motionDesc: string,
) {
  const formatInstructions =
    'Return a JSON object with keys: prompt (string), duration (number), ratio (string).';

  return llm
    .withStructuredOutput(schema)
    .invoke([
      new SystemMessage(
        SYSTEM_PROMPT.replace("{format_instructions}", formatInstructions),
      ),
      new HumanMessage(
        HUMAN_PROMPT.replace("{first_frame}", firstFrame)
          .replace("{last_frame}", lastFrame)
          .replace("{motion_desc}", motionDesc),
      ),
    ]);
}
