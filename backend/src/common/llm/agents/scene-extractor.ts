import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { SceneSchema, type Scene, type Event, formatEvent, formatScene } from '../models';

// ============================================================
// SceneExtractor — 场景提取器
// 职责：将一个 Event（剧情事件）转化为具体的剧本场景（Scene）。
// 同一事件最多拆 5 个场景，位置或时间变化时自动切新场景。
// ============================================================

// ── Prompts ──

const SYSTEM_PROMPT = `You are an expert scriptwriter specializing in adapting literary works into structured screenplay scenes. Your task is to analyze event descriptions from novels and transform them into compelling screenplay scenes, leveraging relevant context while ignoring extraneous information.

**TASK**
Generate the next scene for a screenplay adaptation based on the provided input. Each scene must include:
- Environment: slugline and detailed description
- Characters: List of characters appearing in the scene, with their static features, dynamic features, and visibility status
- Script: Character actions and dialogues in standard screenplay format

**INPUT**
- Event Description: Enclosed within <EVENT_DESCRIPTION_START> and <EVENT_DESCRIPTION_END> tags.
- Context Fragments: Enclosed within <CONTEXT_FRAGMENTS_START> and <CONTEXT_FRAGMENTS_END> tags. Each fragment in <FRAGMENT_N_START> and <FRAGMENT_N_END> tags.
- Previous Scenes (if any): Enclosed within <PREVIOUS_SCENES_START> and <PREVIOUS_SCENES_END> tags.

**OUTPUT**
{format_instructions}

**GUIDELINES**
1. Extract scenes based on the provided context fragments. Preserve original meaning and dialogue.
2. Focus on Relevance: Use only context fragments that directly align with the event description.
3. Dialogues and Actions: Convert descriptive prose into actionable lines and dialogues.
4. Conciseness: Keep descriptions brief and visual.
5. Format Consistency: Ensure industry-standard screenplay structure.
6. Implicit Inference: Infer logically from the event description if context fragments lack exact details.
7. No Extraneous Content.
8. Each character must be an individual, not a group.
9. When the location or time changes, a new scene should be created. Total scenes not more than 5.
10. The language of outputs in values should be same as the input.`;

const HUMAN_PROMPT = `<EVENT_DESCRIPTION_START>
{event_description}
<EVENT_DESCRIPTION_END>

<CONTEXT_FRAGMENTS_START>
{context_fragments}
<CONTEXT_FRAGMENTS_END>

<PREVIOUS_SCENES_START>
{previous_scenes}
<PREVIOUS_SCENES_END>`;

// ── Agent ──

export class SceneExtractor {
  constructor(private model: ChatOpenAI) {}

  async getNextScene(
    relevantChunks: string[],
    event: Event,
    previousScenes: Scene[],
  ): Promise<Scene> {
    const formatInstructions =
      'Return a JSON object with keys: idx (number), is_last (boolean), environment (object with slugline and description), characters (array of character objects each with idx, identifier_in_scene, is_visible, static_features, dynamic_features), script (string).';

    const contextFragmentsStr = relevantChunks
      .map((chunk, i) => `<FRAGMENT_${i}_START>\n${chunk}\n<FRAGMENT_${i}_END>`)
      .join('\n');

    const previousScenesStr = previousScenes
      .map((scene, i) => `<SCENE_${i}_START>\n${formatScene(scene)}\n<SCENE_${i}_END>`)
      .join('\n');

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(
        HUMAN_PROMPT.replace('{event_description}', formatEvent(event))
          .replace('{context_fragments}', contextFragmentsStr)
          .replace('{previous_scenes}', previousScenesStr),
      ),
    ];

    const modelWithStructure = this.model.withStructuredOutput(SceneSchema, {
      name: 'get_next_scene',
      method: 'functionCalling',
    });

    return await modelWithStructure.invoke(messages);
  }
}
