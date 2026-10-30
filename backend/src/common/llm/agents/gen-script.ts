import { createAgent, tool } from 'langchain';
import { AnySubAgent } from 'deepagents';
import { createChatModel, RuntimeModel } from '..';
import * as z from 'zod';
import { Screenwriter } from './screenwriter';
import { CharacterExtractor } from './character-extractor';

const SYSTEM_PROMPT = `你是剧本生成子代理。
  先调用 develop_story，再调用 write_script，再调用role_extraction
  最终只输出JSON：
  {
    "story": "...",
    "script": ["scene1", "scene2"],
    "role": ["role1", "role2"]
  }`;

export const createGenScriptAgent = (
  runtimeModel: RuntimeModel,
): AnySubAgent => {
  const model = createChatModel(runtimeModel);
  const screenwriter = new Screenwriter(model);
  const characterExtractor = new CharacterExtractor(model);
  const developStoryTool = tool(
    async ({ idea, userRequirement }) => ({
      story: await screenwriter.developStory(idea, userRequirement),
    }),
    {
      name: 'develop_story',
      description: '根据创意和要求生成完整故事',
      schema: z.object({
        idea: z.string().describe('用户创意'),
        userRequirement: z.string().optional().describe('用户附加要求'),
      }),
    },
  );
  const writeScriptTool = tool(
    async ({ story, userRequirement }) => ({
      script: await screenwriter.writeScriptBasedOnStory(
        story,
        userRequirement,
      ),
    }),
    {
      name: 'write_script',
      description: '将故事改编为分场景剧本',
      schema: z.object({
        story: z.string().describe('完整故事文本'),
        userRequirement: z.string().optional().describe('用户附加要求'),
      }),
    },
  );
  const roleExtractionTool = tool(
    async ({ scripts }) => ({
      role: await characterExtractor.extractCharacters(scripts.join('\n\n')),
    }),
    {
      name: 'role_extraction',
      description: '您是一位顶尖的电影剧本分析专家',
      schema: z.object({
        scripts: z.array(z.string()).describe('场景剧本'),
      }),
    },
  );
  return {
    name: '剧本生成',
    description: '根据用户创意先生成故事，再生成分场景剧本，再进行角色提取',
    systemPrompt: SYSTEM_PROMPT,
    runnable: createAgent({
      model: createChatModel(runtimeModel, {
        temperature: 0.7,
        streaming: true,
      }),
      systemPrompt: SYSTEM_PROMPT,
      tools: [developStoryTool, writeScriptTool],
    }),
    tools: [developStoryTool, writeScriptTool, roleExtractionTool],
  };
};
