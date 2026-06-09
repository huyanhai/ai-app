import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "langchain";
import { z } from "zod";

// 角色提取
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

const characterInSceneSchema = z.object({
  idx: z
    .number()
    .describe("The index of the character in the scene, starting from 0"),
  identifierInScene: z
    .string()
    .describe("The identifier for the character in this specific scene"),
  isVisible: z
    .boolean()
    .describe("Indicates whether the character is visible in this scene"),
  staticFeatures: z
    .string()
    .describe(
      "Static features of the character (facial features, body shape, etc.)",
    ),
  dynamicFeatures: z
    .string()
    .describe(
      "Dynamic features of the character (clothing, accessories, etc.)",
    ),
});

export type TCharacterInScene = z.infer<typeof characterInSceneSchema>;

const schema = z.object({
  characters: z
    .array(characterInSceneSchema)
    .describe("A list of characters extracted from the script."),
});

// 角色提取
export function extractCharacters(llm: ChatOpenAI, script: string) {
  const formatInstructions =
    'Return a JSON object with a key "characters" whose value is an array of objects, each with keys: idx (number), identifier_in_scene (string), is_visible (boolean), static_features (string), dynamic_features (string).';

  return llm
    .withStructuredOutput(schema)
    .invoke([
      new SystemMessage(
        SYSTEM_PROMPT.replace("{format_instructions}", formatInstructions),
      ),
      new HumanMessage(HUMAN_PROMPT.replace("{script}", script)),
    ]);
}
