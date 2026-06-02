import { createAgent, tool } from 'langchain';
import { AnySubAgent } from 'deepagents';
import { alMode, senModel } from '..';
import * as z from 'zod';
import { Screenwriter } from './screenwriter';
import { CharacterExtractor } from './character-extractor';

const screenwriter = new Screenwriter(senModel);
const characterExtractor = new CharacterExtractor(senModel);

// 生成剧本
const developStoryTool = tool(
  async ({ idea, userRequirement }) => {
    const story = await screenwriter.developStory(idea, userRequirement);
    return { story };
  },
  {
    name: 'develop_story',
    description: '根据创意和要求生成完整故事',
    schema: z.object({
      idea: z.string().describe('用户创意'),
      userRequirement: z.string().optional().describe('用户附加要求'),
    }),
  },
);

// 场景剧本
const writeScriptTool = tool(
  async ({ story, userRequirement }) => {
    const script = await screenwriter.writeScriptBasedOnStory(
      story,
      userRequirement,
    );
    return { script };
  },
  {
    name: 'write_script',
    description: '将故事改编为分场景剧本',
    schema: z.object({
      story: z.string().describe('完整故事文本'),
      userRequirement: z.string().optional().describe('用户附加要求'),
    }),
  },
);

// 角色提取
const roleExtractionTool = tool(
  async ({ scripts }) => {
    const role = await characterExtractor.extractCharacters(
      scripts.join('\n\n'),
    );
    return { role };
  },
  {
    name: 'role_extraction',
    description: '您是一位顶尖的电影剧本分析专家',
    schema: z.object({
      scripts: z.array(z.string()).describe('场景剧本'),
    }),
  },
);

const SYSTEM_PROMPT = `你是剧本生成子代理。
  先调用 develop_story，再调用 write_script，再调用role_extraction
  最终只输出JSON：
  {
    "story": "...",
    "script": ["scene1", "scene2"],
    "role": ["role1", "role2"]
  }`;

const graph = createAgent({
  model: alMode,
  systemPrompt: SYSTEM_PROMPT,
  tools: [developStoryTool, writeScriptTool],
});

export const genScript: AnySubAgent = {
  name: '剧本生成',
  description: '根据用户创意先生成故事，再生成分场景剧本，再进行角色提取',
  systemPrompt: SYSTEM_PROMPT,
  runnable: graph,
  tools: [developStoryTool, writeScriptTool, roleExtractionTool],
};
