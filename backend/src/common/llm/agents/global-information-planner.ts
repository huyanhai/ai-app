import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import {
  CharacterInEventSchema,
  type CharacterInScene,
  type CharacterInEvent,
  type CharacterInNovel,
  type Scene,
  formatCharacterInScene,
} from '../models';

// ============================================================
// GlobalInformationPlanner — 全局信息规划器
// 职责：跨场景、跨事件融合角色信息，维护整部小说的角色一致性。
// 包含两个核心操作：
// 1. 将同一事件内多个场景的角色合并（识别跨场景的同一角色）
// 2. 将当前事件的角色合并到整部小说的全局角色列表
// ============================================================

// ── Prompts ──

const SYSTEM_MERGE_ACROSS_SCENES = `You are an expert script analysis and character fusion specialist. Your role is to intelligently analyze multiple script scenes, identify characters that represent the same entity across different scenes, and merge them into a unified character list with consistent identifiers.

**TASK**
Process the input scenes, each containing a script and characters with their names and features. Identify and merge characters that are logically the same across scenes. Output a consolidated list of characters for the entire event.

**INPUT**
A sequence of scenes. Each scene is enclosed within <SCENE_N_START> and <SCENE_N_END> tags.
Each scene includes a script enclosed within <SCRIPT_START> and <SCRIPT_END> tags, and characters enclosed within <CHARACTERS_START> and <CHARACTERS_END> tags.

**OUTPUT**
{format_instructions}

**GUIDELINES**
1. Character Fusion: Analyze contextual clues to determine if characters from different scenes are the same person.
2. Unique Identifier: Assign a consistent, unique ID to each merged character.
3. Scene Mapping: For each character, list all scenes they appear in and the name used.
4. Completeness: Ensure all characters from all scenes are included. No duplicates or omissions.
5. If a character undergoes significant changes across scenes, split them into separate roles.
6. The language of outputs in values should be same as the input text.`;

const HUMAN_MERGE_ACROSS_SCENES = `{scenes_sequence}`;

const SYSTEM_MERGE_TO_NOVEL = `You are an information integration expert skilled in accurately identifying, matching, and merging character information.

**TASK**
Merge the character list extracted from the current event into the global character list. For existing characters, ensure their feature descriptions remain consistent; for new characters, add them to the global list.

**INPUT**
1. Existing Characters in the Novel: Enclosed within <EXISTING_CHARACTERS_START> and <EXISTING_CHARACTERS_END> tags.
2. Characters in the Current Event: Enclosed within <EVENT_CHARACTERS_START> and <EVENT_CHARACTERS_END> tags.

**OUTPUT**
{format_instructions}

**GUIDELINES**
1. Feature Consistency: Strictly compare the features of the current event characters with those of existing characters.
2. Efficient Merging: Avoid duplicate characters.
3. Feature Update: If an existing character's features are expanded, update their description accordingly.`;

const HUMAN_MERGE_TO_NOVEL = `<EXISTING_CHARACTERS_START>
{existing_characters}
<EXISTING_CHARACTERS_END>

<EVENT_CHARACTERS_START>
{event_characters}
<EVENT_CHARACTERS_END>`;

// ── Schemas ──

const MergeAcrossScenesSchema = z.object({
  characters: z.array(CharacterInEventSchema),
});

const CharForMergeSchema = z.object({
  index_in_event: z
    .number()
    .describe('The index of the character in the current event character list.'),
  index_in_novel: z
    .number()
    .describe(
      'The index in the existing novel character list. Set to -1 if this is a new character.',
    ),
  identifier_in_novel: z
    .string()
    .describe(
      'The unique identifier for the character in the novel. For new characters, ensure no conflict.',
    ),
  modified_features: z
    .string()
    .describe(
      'The modified static features of the character after merging.',
    ),
});

const MergeToNovelSchema = z.object({
  characters: z
    .array(CharForMergeSchema)
    .describe(
      'List of characters in the event with their corresponding index in the existing novel characters list.',
    ),
});

// ── Agent ──

export class GlobalInformationPlanner {
  constructor(private model: ChatOpenAI) {}

  /**
   * 将同一 Event 下多个 Scene 中的角色进行跨场景融合，
   * 识别不同场景中的相同角色并统一 ID。
   * 会对输出做校验：确保每个角色的 active_scenes 在原始场景中存在对应。
   */
  async mergeCharactersAcrossScenesInEvent(
    eventIdx: number,
    scenes: Scene[],
  ): Promise<CharacterInEvent[]> {
    const formatInstructions =
      'Return a JSON object with a key "characters" whose value is an array of objects, each with keys: index (number), identifier_in_event (string), active_scenes (object mapping scene index to identifier string), static_features (string).';

    let scenesSequence = '';
    for (const scene of scenes) {
      scenesSequence += `<SCENE_${scene.idx}_START>\n`;
      scenesSequence += `<SCRIPT_START>\n${scene.script}\n<SCRIPT_END>\n\n`;
      scenesSequence += `<CHARACTERS_START>\n`;
      for (const char of scene.characters) {
        scenesSequence += `<CHARACTER_${char.idx}_START>\n${formatCharacterInScene(char)}<CHARACTER_${char.idx}_END>\n`;
      }
      scenesSequence += `<CHARACTERS_END>\n`;
      scenesSequence += `<SCENE_${scene.idx}_END>\n`;
    }

    const messages: BaseMessage[] = [
      new SystemMessage(
        SYSTEM_MERGE_ACROSS_SCENES.replace('{format_instructions}', formatInstructions),
      ),
      new HumanMessage(
        HUMAN_MERGE_ACROSS_SCENES.replace('{scenes_sequence}', scenesSequence),
      ),
    ];

    const modelWithStructure = this.model.withStructuredOutput(MergeAcrossScenesSchema, {
      name: 'merge_characters_across_scenes',
      method: 'functionCalling',
    });

    const response = await modelWithStructure.invoke(messages);

    // Validate output
    for (const character of response.characters) {
      for (const [sceneIdx, identifierInScene] of Object.entries(character.active_scenes)) {
        const scene = scenes[Number(sceneIdx)];
        if (!scene.characters.some((c) => c.identifier_in_scene === identifierInScene)) {
          throw new Error(
            `Character ${identifierInScene} not found in scene ${sceneIdx} of event ${eventIdx}`,
          );
        }
      }
    }

    return response.characters;
  }

  /**
   * 将当前 Event 的角色合并到整部小说的全局角色列表中。
   * 已有角色更新其 static_features；新角色追加到列表末尾。
   */
  async mergeCharactersToExistingCharactersInNovel(
    eventIdx: number,
    existingCharactersInNovel: CharacterInNovel[],
    charactersInEvent: CharacterInEvent[],
  ): Promise<CharacterInNovel[]> {
    const existingCharsStr = existingCharactersInNovel
      .map(
        (c) =>
          `<CHARACTER_${c.index}_START>\n${c.identifier_in_novel}\nStatic features: ${c.static_features}\n<CHARACTER_${c.index}_END>`,
      )
      .join('\n');

    const eventCharsStr = charactersInEvent
      .map(
        (c, i) =>
          `<CHARACTER_${i}_START>\n${c.identifier_in_event}\nStatic features: ${c.static_features}\n<CHARACTER_${i}_END>`,
      )
      .join('\n');

    const formatInstructions =
      'Return a JSON object with a key "characters" whose value is an array of objects, each with keys: index_in_event (number), index_in_novel (number), identifier_in_novel (string), modified_features (string).';

    const messages: BaseMessage[] = [
      new SystemMessage(
        SYSTEM_MERGE_TO_NOVEL.replace('{format_instructions}', formatInstructions),
      ),
      new HumanMessage(
        HUMAN_MERGE_TO_NOVEL.replace('{existing_characters}', existingCharsStr).replace(
          '{event_characters}',
          eventCharsStr,
        ),
      ),
    ];

    const modelWithStructure = this.model.withStructuredOutput(MergeToNovelSchema, {
      name: 'merge_characters_to_novel',
      method: 'functionCalling',
    });

    const response = await modelWithStructure.invoke(messages);

    // Process results
    for (const char of response.characters) {
      if (char.index_in_novel === -1) {
        // New character
        const newChar: CharacterInNovel = {
          index: existingCharactersInNovel.length,
          identifier_in_novel: char.identifier_in_novel,
          static_features: char.modified_features,
          active_events: { [eventIdx]: charactersInEvent[char.index_in_event].identifier_in_event },
        };
        existingCharactersInNovel.push(newChar);
      } else {
        // Update existing character
        existingCharactersInNovel[char.index_in_novel].static_features = char.modified_features;
        existingCharactersInNovel[char.index_in_novel].active_events[eventIdx] =
          charactersInEvent[char.index_in_event].identifier_in_event;
      }
    }

    return existingCharactersInNovel;
  }
}
