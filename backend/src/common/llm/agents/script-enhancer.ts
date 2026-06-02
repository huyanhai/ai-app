import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

// ============================================================
// ScriptEnhancer — 剧本润色器
// 职责：对规划好的剧本进行精细化润色，增强感官细节、
// 确保角色/地点名称一致性，优化对话自然度。
// 注意：不改变情节、结构和场景顺序。
// ============================================================

// ── Prompts ──

const SYSTEM_PROMPT = `[Role]
You are a senior screenplay polishing and continuity expert.

[Task]
Enhance a planned narrative script by adding specific, concrete sensory details, tightening continuity, clarifying scene transitions, and keeping terminology consistent (character names, locations, objects). Improve dialogue naturalness without changing the original intent or plot. Maintain cinematic descriptiveness suitable for storyboards, not camera directions.

[Input]
You will receive a planned script within <PLANNED_SCRIPT_START> and <PLANNED_SCRIPT_END>.

[Output]
{format_instructions}

[Guidelines]
1. Preserve the story, structure, and scene order; do not add or remove scenes.
2. Strengthen visual specificity (lighting, textures, sounds, weather, time-of-day) using grounded detail.
3. Ensure character names, ages, relationships, and locations stay consistent across scenes.
4. Dialogue should be concise, in quotes, character-specific, and purposeful.
5. Avoid camera jargon (e.g., cut to, close-up) and voiceover formatting.
6. No metaphors.
7. Repetition for Precision: Re-state important objects/actors often to remove ambiguity.
8. Character Features for Dialogue: For each character in the conversation, repeat the core voice description.
9. Preserve the original narration symbols if exists (eg. Narration: "Everything is looking good").
10. Roles & Positions Description: Always specify who is where and what they're doing.

Warnings
No camera directions. No metaphors. Do not change the plot.`;

const HUMAN_PROMPT = `<PLANNED_SCRIPT_START>
{planned_script}
<PLANNED_SCRIPT_END>`;

// ── Schema ──

const EnhancedScriptSchema = z.object({
  enhanced_script: z
    .string()
    .describe(
      'A refined script version with clearer continuity, stronger concrete detail, and improved dialogue while preserving the original story and scene order.',
    ),
});

// ── Agent ──

export class ScriptEnhancer {
  constructor(private model: ChatOpenAI) {}

  /** 对规划剧本做精细化润色：补充感官细节、修复连贯性、优化对话 */
  async enhanceScript(plannedScript: string): Promise<string> {
    const formatInstructions =
      'Return a JSON object with a single key "enhanced_script" whose value is a string containing the enhanced script.';

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(HUMAN_PROMPT.replace('{planned_script}', plannedScript)),
    ];

    const modelWithStructure = this.model.withStructuredOutput(EnhancedScriptSchema, {
      name: 'enhance_script',
      method: 'functionCalling',
    });

    const response = await modelWithStructure.invoke(messages);
    return response.enhanced_script;
  }
}
