import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { CharacterInSceneSchema, type CharacterInScene } from '../models';

// ============================================================
// CharacterExtractor — 角色提取器
// 职责：从单个剧本场景中提取所有角色信息，
// 区分为静态特征（外貌/体型）和动态特征（服装/配饰）。
// ============================================================

// ── Prompts ──

const SYSTEM_PROMPT = `[Role]
You are a top-tier movie script analysis expert.

[Task]
Your task is to analyze the provided script and extract all relevant character information.

[Input]
You will receive a script enclosed within <SCRIPT> and </SCRIPT>.

[Output]
{format_instructions}

[Guidelines]
- Ensure that the language of all output values matches that used in the script.
- Group all names referring to the same entity under one character. Select the most appropriate name as the character's identifier. If the person is a real famous person, the real person's name should be retained (e.g., Elon Musk, Bill Gates).
- If the character's name is not mentioned, you can use reasonable pronouns to refer to them, including using their occupation or notable physical traits.
- For background characters in the script, you do not need to consider them as individual characters.
- If a character's traits are not described or only partially outlined in the script, you need to design plausible features based on the context.
- In static features, describe the character's physical appearance, physique, and other relatively unchanging features. In dynamic features, describe attire, accessories, key items they carry.
- Don't include any information about the character's personality, role, or relationships with others in either static or dynamic features.
- When designing character features, different character appearances should be made more distinct from each other.
- The description of characters should be detailed, avoiding the use of abstract terms.`;

const HUMAN_PROMPT = `<SCRIPT>
{script}
</SCRIPT>`;

// ── Schema ──

const ExtractCharactersSchema = z.object({
  characters: z
    .array(CharacterInSceneSchema)
    .describe('A list of characters extracted from the script.'),
});

// ── Agent ──

export class CharacterExtractor {
  constructor(private model: ChatOpenAI) {}

  async extractCharacters(script: string): Promise<CharacterInScene[]> {
    const formatInstructions =
      'Return a JSON object with a key "characters" whose value is an array of objects, each with keys: idx (number), identifier_in_scene (string), is_visible (boolean), static_features (string), dynamic_features (string).';

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT.replace('{format_instructions}', formatInstructions)),
      new HumanMessage(HUMAN_PROMPT.replace('{script}', script)),
    ];

    const modelWithStructure = this.model.withStructuredOutput(ExtractCharactersSchema, {
      method: 'jsonMode',
    });

    const result = await modelWithStructure.invoke(messages);
    return result.characters;
  }
}
