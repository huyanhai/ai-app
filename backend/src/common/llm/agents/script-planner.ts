import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

// ============================================================
// ScriptPlanner — 剧本规划器
// 职责：将基本故事创意扩展为完整剧本草案。
// 包含意图路由机制：自动判断叙事/动作/蒙太奇三种风格，
// 并选择对应的 Prompt 模板生成剧本。
// ============================================================

// ── Prompts ──

const NARRATIVE_SCRIPT_PROMPT = `You are a world-class creative writing and screenplay development expert with extensive experience in story structure, character development, and narrative pacing.

**Task**
Your task is to transform a basic story idea into a comprehensive, engaging script with rich narrative detail, compelling character arcs, and cinematic storytelling elements.

**Input**
You will receive a basic story idea or concept enclosed within <BASIC_IDEA_START> and <BASIC_IDEA_END>.

**Output**
{format_instructions}

**Guidelines**
No metaphors allowed!!! (eg. A gust of wind rustled through it, a ghostly touch.)

1. **Story Structure**: Develop a clear three-act structure with proper setup, confrontation, and resolution.
2. **Character Development**: Create well-rounded characters with clear motivations, flaws, and character arcs.
3. **Visual Storytelling**: Write with cinematic language that emphasizes visual elements, actions, and atmospheric details.
4. **Emotional Depth**: Incorporate emotional beats, internal conflicts, and character relationships.
5. **Pacing and Tension**: Build suspense and maintain engagement through proper scene transitions.
6. **Genre Consistency**: Maintain appropriate tone, style, and conventions for the story's genre.
7. **Dialogue Quality**: Use the:" " symbols (eg. Peter says: "Everything is looking good."). Do not use voiceover format.
8. **Thematic Elements**: Weave in meaningful themes and subtext.
9. **Conflict and Stakes**: Establish clear external and internal conflicts with high stakes.
10. **Satisfying Resolution**: Ensure all major plot threads are resolved.

**Warnings**
Don't write any camera movement in the script (eg. cut to), you should write the script by using storyboard description, not camera view.
No metaphors allowed!!!`;

const MOTION_SCRIPT_PROMPT = `You are a top-tier action and motion-sequence script designer with deep visual expertise in conveying speed, force, choreography, and technical precision.

**Task**
Transform a basic idea into a motion-driven script that emphasizes precise action description, clear spatial orientation, and unambiguous, technically accurate details.

**Input**
You will receive a basic idea enclosed within <BASIC_IDEA_START> and <BASIC_IDEA_END>.

**Output**
{format_instructions}

**Global Rules**
No metaphors allowed. Less conversation.

**Motion Style Guidelines**
1. Technical Explicitness: Prefer precise nouns and qualifiers over poetic language.
2. Kinetic Clarity: Make trajectories, vectors, speed/acceleration sensations, and force outcomes explicit.
3. Spatial Cohesion: Maintain a consistent mental map of positions.
4. Sequenced Action Beats: Write step-by-step beats that can be storyboarded.
5. Dialogue Minimalism: Use dialogue sparingly.
6. Keep the script length similar to the following examples.
7. If the user does not specify, only one character can appear at most.
8. Less character's actions close-ups, more exterior shots.
9. Don't describe the character's physical state.

**Warnings**
- Do not use metaphors.`;

const MONTAGE_SCRIPT_PROMPT = `You are a top-tier montage script designer with deep expertise in compressing time, juxtaposing images, and shaping emotional arcs through shot selection and rhythm.

Task
Transform a basic idea into an emotion-driven montage script that emphasizes internal experience through visual sequencing.

Input
You will receive a basic idea enclosed within <BASIC_IDEA_START> and <BASIC_IDEA_END>.

Output
{format_instructions}

**Global Rules**
No metaphors allowed. Keep dialogue minimal. Use pure paragraph. Convey meaning primarily through shot progression, rhythm, and visual juxtaposition.

**Montage Style Guidelines**
Use plain sentence/paragraph. For each scene, write multiple shots to enhance montage effect.
Total no less than 500 words, each paragraph no more than 50 words.
Build an emotional arc across beats. Use sparse, precise notes for sound/music.
Keep dialogue minimal. Focus on expressive visuals, reactions, and transitions.

**Warnings**
Do not use metaphors. Avoid poetic language; prefer precise, observable details.`;

const HUMAN_TEMPLATE = `<BASIC_IDEA_START>
{basic_idea}
<BASIC_IDEA_END>`;

const ROUTER_SYSTEM = `You are an intent router for script planning. Classify the user's basic idea into one of following intents:

- narrative: The idea centers on character, plot, themes, dialogue, or broad storytelling beats.
- motion: The idea centers on action, speed, vehicles, combat, choreography, sports, or any kinetic sequence where precise, technical motion description is primary.
- montage: The idea centers on a series of shots that convey an emotional arc through imagery, pacing, and juxtaposition.

Respond using the required JSON format only.
{format_instructions}`;

// ── Schemas ──

const IntentRouterSchema = z.object({
  intent: z.enum(['narrative', 'motion', 'montage']),
  rationale: z.string().optional(),
});

const PlannedScriptSchema = z.object({
  planned_script: z
    .string()
    .describe(
      'The full planned script with rich narrative detail, character development, dialogue, and cinematic descriptions.',
    ),
});

// ── Agent ──

export class ScriptPlanner {
  constructor(private model: ChatOpenAI) {}

  /**
   * 规划剧本：先通过 Intent Router 判断用户意图（narrative / motion / montage），
   * 再使用对应的 Prompt 模板生成完整剧本。
   */
  async planScript(basicIdea: string): Promise<{ plannedScript: string }> {
    // 1) Route intent
    const routerMessages: BaseMessage[] = [
      new SystemMessage(
        ROUTER_SYSTEM.replace(
          '{format_instructions}',
          'Return a JSON object with keys "intent" (string: narrative/motion/montage) and "rationale" (string).',
        ),
      ),
      new HumanMessage(HUMAN_TEMPLATE.replace('{basic_idea}', basicIdea)),
    ];

    const routerModel = this.model.withStructuredOutput(IntentRouterSchema, {
      name: 'intent_router',
      method: 'functionCalling',
    });

    const routing = await routerModel.invoke(routerMessages);
    const chosenIntent = routing.intent ?? 'narrative';

    // 2) Build the planning chain with the selected template
    let systemTemplate: string;
    switch (chosenIntent) {
      case 'narrative':
        systemTemplate = NARRATIVE_SCRIPT_PROMPT;
        break;
      case 'motion':
        systemTemplate = MOTION_SCRIPT_PROMPT;
        break;
      case 'montage':
        systemTemplate = MONTAGE_SCRIPT_PROMPT;
        break;
      default:
        systemTemplate = NARRATIVE_SCRIPT_PROMPT;
    }

    const formatInstructions =
      'Return a JSON object with a single key "planned_script" whose value is a string containing the full script.';

    const planningMessages: BaseMessage[] = [
      new SystemMessage(systemTemplate.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(HUMAN_TEMPLATE.replace('{basic_idea}', basicIdea)),
    ];

    const planningModel = this.model.withStructuredOutput(PlannedScriptSchema, {
      name: 'plan_script',
      method: 'functionCalling',
    });

    const response = await planningModel.invoke(planningMessages);
    return { plannedScript: response.planned_script };
  }
}
