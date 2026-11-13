import { Injectable } from '@nestjs/common';
import { HumanMessage, SystemMessage } from 'langchain';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createChatModel } from '@/common/llm';
import { ModelsService } from '../models/models.service';
import { markProductionPromptAssets } from './production.prompt-assets';
import { prepareProductionAttachments } from './production.attachments';
import { FileUploadDto } from '@/modules/ai/dto/stream.dto';
import {
  ProductionCharactersSchema,
  ProductionComedyStoryReviewSchema,
  ProductionImagePromptsSchema,
  ProductionPlan,
  ProductionPlanSchema,
  ProductionRequirementsSchema,
  ProductionScriptSchema,
  ProductionStorySchema,
  ProductionStoryReviewSchema,
  ProductionStoryboardSchema,
  ProductionVideoPromptsSchema,
} from './production.types';

type ProductionChunk = (data: unknown) => void;

const matchByIdOrOrder = <T extends { id: string }>(
  items: T[],
  id: string,
  index: number,
) => {
  const indexed = items[index];
  return indexed?.id === id
    ? indexed
    : items.find((item) => item.id === id) ?? indexed;
};

const comedyReversalMinimum = (targetDuration?: number) =>
  (targetDuration ?? 0) >= 30 ? 2 : 1;
const comedyReversalMaximum = (targetDuration?: number) =>
  (targetDuration ?? 0) <= 45 ? 2 : (targetDuration ?? 0) <= 90 ? 3 : 4;

@Injectable()
export class ProductionPlanner {
  private readonly skillCache = new Map<string, string>();

  constructor(private readonly models: ModelsService) {}

  private async model(modelId?: string, options: {
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    maxRetries?: number;
    disableReasoning?: boolean;
  } = {}) {
    const runtimeModel = await this.models.runtime(modelId, 'text');
    const { disableReasoning, ...modelOptions } = options;
    return createChatModel(runtimeModel, {
      temperature: 0.7,
      ...modelOptions,
      modelKwargs: disableReasoning && runtimeModel.modelId.startsWith('sensenova-')
        ? { reasoning_effort: 'none' }
        : undefined,
    });
  }

  private creativeGuidance(...skills: string[]) {
    return skills
      .map((skill) => {
        if (!this.skillCache.has(skill)) {
          this.skillCache.set(
            skill,
            readFileSync(
              resolve(
                process.cwd(),
                'src/common/llm/skills',
                skill,
                'SKILL.md',
              ),
              'utf8',
            ),
          );
        }
        return `以下来自 ${skill} 技能，仅作为创作指导。阶段状态、用户确认和结构化输出契约优先；不得执行技能脚本、调用工具或写入项目文件。\n${this.skillCache.get(skill)}`;
      })
      .join('\n\n');
  }

  private guidanceFor(input: unknown, ...skills: string[]) {
    const source = typeof input === 'string' ? input : JSON.stringify(input);
    if (
      source.includes('classical-poetry-live-action') ||
      source.includes('古诗词真人微剧情')
    ) {
      skills.push('classical-poetry-live-action');
    }
    if (source.includes('animated-visual-comedy') || source.includes('动漫视觉喜剧')) {
      skills.push('animated-visual-comedy');
    }
    return this.creativeGuidance(...skills);
  }

  private storyMethods(input: string) {
    const paths = ['workflow/references/methods/storyDevelopment.md'];
    if (input.includes('classical-poetry-live-action') || input.includes('古诗词真人微剧情'))
      paths.push('classical-poetry-live-action/references/adaptation-and-directing.md');
    if (input.includes('animated-visual-comedy') || input.includes('动漫视觉喜剧'))
      paths.push('animated-visual-comedy/references/comedy-craft.md');
    return paths.map((path) => readFileSync(
      resolve(process.cwd(), 'src/common/llm/skills', path), 'utf8',
    )).join('\n\n');
  }

  private validateComedyStory<T extends {
    workflow?: 'classical-poetry-live-action' | 'animated-visual-comedy';
    targetDuration?: number;
    comedyDesign?: {
      candidates: { id: string }[];
      selectedCandidateId: string;
      performanceBudget: { seconds: number }[];
      reversals: {
        origin: 'strategy' | 'mistake' | 'accident';
        spatialLogic: string;
        expectationEvidence: string;
        expectation: string;
        reversal: string;
        stateChange: string;
        advantageBefore: string;
        advantageAfter: string;
      }[];
      endingCallback: {
        winnerAction: string;
        characterControl: string;
        spatialSetup: string;
        scaleConsistency: string;
      };
    };
  }>(story: T): T {
    if (story.workflow !== 'animated-visual-comedy') return story;
    if (!story.comedyDesign)
      throw new Error('动漫喜剧缺少视觉钩子、反转和结尾回敬设计，请重试');
    const minimum = comedyReversalMinimum(story.targetDuration);
    if (!story.comedyDesign.candidates.some((candidate) =>
      candidate.id === story.comedyDesign?.selectedCandidateId
    ))
      throw new Error('动漫喜剧必须从三个候选方案中明确选择最强方案');
    if (story.comedyDesign.reversals.length < minimum)
      throw new Error(`动漫喜剧至少需要 ${minimum} 次有效局势反转，并另设结尾回敬`);
    const maximum = comedyReversalMaximum(story.targetDuration);
    if (story.comedyDesign.reversals.length > maximum)
      throw new Error(`当前时长最多容纳 ${maximum} 次主要反转，请合并重复动作并保留最强笑料`);
    if (story.targetDuration) {
      const seconds = story.comedyDesign.performanceBudget.reduce((total, item) => total + item.seconds, 0);
      if (seconds < story.targetDuration * 0.9 || seconds > story.targetDuration * 1.1)
        throw new Error(`喜剧表演预算为 ${seconds} 秒，与目标 ${story.targetDuration} 秒不匹配`);
    }
    if (!story.comedyDesign.reversals.some((item) => item.origin === 'strategy'))
      throw new Error('动漫喜剧至少需要一次由角色主动策略造成的反转');
    if (story.comedyDesign.reversals.some((item) =>
      item.expectationEvidence.trim() === item.expectation.trim() ||
      item.expectation.trim() === item.reversal.trim() ||
      item.reversal.trim() === item.stateChange.trim() ||
      item.advantageBefore.trim() === item.advantageAfter.trim()
    ))
      throw new Error('动漫喜剧反转必须有独立的预期证据，并推翻预期、改变优势');
    if (!story.comedyDesign.endingCallback.winnerAction.trim())
      throw new Error('动漫喜剧结尾必须由获胜者此前的行动促成，不能只靠巧合');
    if (
      story.comedyDesign.reversals.some((item) => !item.spatialLogic.trim()) ||
      !story.comedyDesign.endingCallback.characterControl.trim() ||
      !story.comedyDesign.endingCallback.spatialSetup.trim() ||
      !story.comedyDesign.endingCallback.scaleConsistency.trim()
    )
      throw new Error('动漫喜剧必须交代动作空间、结果控制方式和物体尺寸重量逻辑');
    return story;
  }

  async requirements(
    input: string,
    modelId?: string,
    onChunk?: ProductionChunk,
    files: FileUploadDto[] = [],
  ) {
    const model = await this.model(modelId);
    const attachments = await prepareProductionAttachments(files);
    const text = `${input}${attachments.text}`;
    const runnable = model
      .withStructuredOutput(ProductionRequirementsSchema, {
        name: 'clarify_production_requirements',
        method: 'functionCalling',
      });
    const stream = await runnable.streamEvents([
        new SystemMessage(`你是导演 Agent 的需求澄清助手。判断影视创作需求是否足以生成完整剧本。
只询问会实质改变主角、故事冲突、结局、改编边界、目标时长或视觉形式的关键缺项，最多 3 个问题，不重复已知信息。
信息足够时 status=ready 且 questions=[]；信息不足时 status=questions，brief 汇总已知需求，questions 给出最关键的问题。
用户明确表示“帮我补充”“由你决定”“不知道”或授权 Agent 创作时，必须根据已知偏好合理补齐缺失设定，status=ready 且 questions=[]，不得继续追问。
附件剧本是用户提供的原始创作材料，必须读取并纳入需求分析；参考图片必须实际观察其画风、色彩和造型特征，不得声称未收到图片。
brief 需要完整写出主角、目标、核心冲突、场景、结局、时长和视觉形式，并区分用户要求与 Agent 创作补充。
brief 使用易读的 Markdown 格式：按“用户明确要求”“Agent 创作补充”“制作适配要点”分节，每项设定单独一行，不要把所有内容连成一段。
不得生成剧本、角色、分镜或媒体提示词。`),
        new SystemMessage(this.guidanceFor(input, 'elicitation-skill')),
        attachments.images.length
          ? new HumanMessage({
              content: [
                { type: 'text', text },
                ...attachments.images,
              ],
            })
          : new HumanMessage(text),
      ], { version: 'v2' });
    let result: unknown;
    let rawArguments = '';
    let streamedBrief = '';
    for await (const chunk of stream) {
      if (chunk.event === 'on_chat_model_stream') {
        const parts = chunk.data.chunk.tool_call_chunks ?? [];
        for (const part of parts) {
          if (!part.args) continue;
          rawArguments += part.args;
          const brief = this.partialJsonString(rawArguments, 'brief');
          if (brief && brief !== streamedBrief) {
            streamedBrief = brief;
            onChunk?.({ brief });
          }
        }
      } else if (chunk.event === 'on_chain_end' && chunk.data.output?.brief) {
        result = chunk.data.output;
      }
    }
    return ProductionRequirementsSchema.parse(
      rawArguments ? JSON.parse(rawArguments) : result,
    );
  }

  private partialJsonString(source: string, key: string) {
    const match = new RegExp(`"${key}"\\s*:\\s*"`).exec(source);
    if (!match) return '';
    const start = match.index + match[0].length;
    let value = source.slice(start);
    let escaped = false;
    let complete = false;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (character === '"' && !escaped) {
        value = value.slice(0, index);
        complete = true;
        break;
      }
      escaped = character === '\\' && !escaped;
      if (character !== '\\') escaped = false;
    }
    try {
      return JSON.parse(`"${value}"`) as string;
    } catch {
      if (complete || !value.endsWith('\\')) return '';
      try {
        return JSON.parse(`"${value.slice(0, -1)}"`) as string;
      } catch {
        return '';
      }
    }
  }

  async story(input: string, modelId?: string, onChunk?: ProductionChunk) {
    const comedyStory = input.includes('animated-visual-comedy') || input.includes('动漫视觉喜剧');
    const model = await this.model(modelId, comedyStory
      ? { disableReasoning: true, maxTokens: 8000, timeout: 240_000, maxRetries: 0 }
      : {});
    const messages = [
        new SystemMessage(`你是故事开发 Agent。根据原始诗句、段落和已确认需求，先创作一篇有开端、发展、结果和情绪落点的完整故事，不写场景剧本、分镜或提示词。
sourceBasis 只写原文与用户明确要求的事实；creativeAdditions 列出你新增的人物、事件、动机与关系，不冒充原文或史实。
storyArc 写清人物眼前目标、阻碍、实际行动、行动造成的结果，以及人物关系或处境的变化。故事正文必须把这些过程演出来，不能只在 storyArc 中声明。
每个关键结果要由前文行动导致，人物位置、持物和数量保持连续。故事的完整性优先于目标视频时长；不要为了时长删掉必要因果，后续剧本阶段再决定如何演绎。
动漫视觉喜剧必须无对白。先在 comedyDesign.candidates 中设计三个机制不同的完整候选，分别记录最强笑点、弱点，并按视觉性、意外度、因果、角色主动性、尾笑点五项各 1-10 分评分；填写 selectedCandidateId 和 selectionReason，再把选中的方案写入其余字段，禁止直接扩写第一个想法。
每个候选先通过三格无字漫画测试：办法、明确预测、意外结果。第三格只是摔倒、撞墙、被机关击中或事故变大的候选直接淘汰。两次主要反转必须采用不同机制并改变不同层面，禁止重复击中同一角色；单次笑料最多三次清楚碰撞，不能用长连锁代替角色决策。角色的性格缺陷必须直接导致错误选择，结尾要回收开场视觉细节并增加一层意义反转，不能只是重播中段机关。
comedyDesign.performanceBudget 按故事顺序列出全部表演节拍，每项填写 beat、startState、action、endState、newInformation、seconds；后一节拍 startState 必须承接前一节拍 endState，seconds 总和匹配目标时长。45 秒及以下只保留两次主要反转加一次结尾回敬，不堆第三次反转；重复动作没有新信息就删除。
修改已有动漫喜剧时，不得原样返回当前故事或旧 comedyDesign：旧数据缺少新字段时必须补齐，用户指出的巧合、比例和节奏问题必须同时修改故事正文与结构字段，不能只改字段让旧正文继续保留问题。输出前逐项核对所有必填字段。
若当前故事连续出现同一机关击中同一角色、修订意见指出重复动作，或上一轮仍未达到 9 分，必须保留角色和题材但从 candidates 改选不同喜剧机制，整体重写正文；禁止返回旧故事，禁止继续给同一机关补丁。
根据角色关系选择 single-protagonist 或 rivalry。openingHook 从进行中的冲突开始，不用环境或姿势介绍拖延。reversals 逐项填写 actor、action、origin、setup、spatialLogic、expectationEvidence、expectation、reversal、payoff、stateChange、advantageBefore、advantageAfter；spatialLogic 交代起点、轨迹、落点和身体能力，至少一次 origin=strategy，预期必须有此前画面证据，优势前后必须不同。30 秒及以上至少两次，单纯事故变大不算反转。
endingCallback 填写 apparentVictory、reusedSetup、plantedEarly、winnerAction、characterControl、spatialSetup、scaleConsistency、finalOutcome：关键规则必须在前三分之一提前展示，最终胜利由获胜者此前行动促成；characterControl 写清角色如何主动控制结果，spatialSetup 写清为何能到达落点，scaleConsistency 写清尺寸、重量和搬运方式。禁止无准备的“正好、精准、碰巧”接住，禁止让角色用嘴或单手拿走远超身体能力的重物。结尾回敬不计入前述反转数量。压缩重复转圈、扑空、摔倒和得意反应，确保目标时长能演完。
遵守用户的题材、画幅、视觉风格和改编边界。古诗词改编保留核心意象与情绪，让诗意由生活事件自然产生，不强加重大灾难或作者生平。所有文本使用用户输入语言。`),
        new SystemMessage(`${this.guidanceFor(input, 'short-drama-develop')}\n\n${this.storyMethods(input)}`),
        new HumanMessage(input),
    ];
    if (comedyStory) {
      const stream = await model.stream([
        ...messages,
        new HumanMessage('只输出一个完整 JSON 对象，不要 Markdown 或解释。顶层必须包含 title、synopsis、story、sourceBasis、creativeAdditions、storyArc、visualStyle、ratio、targetDuration、comedyDesign；所有字段严格遵循前述结构，不能省略 candidates、performanceBudget、openingHook、reversals 或 endingCallback。'),
      ]);
      let rawText = '';
      let streamedStory = '';
      for await (const chunk of stream) {
        rawText += chunk.text;
        const partialStory = this.partialJsonString(rawText, 'story');
        if (partialStory && partialStory !== streamedStory) {
          streamedStory = partialStory;
          onChunk?.({ story: partialStory });
        }
      }
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      const story = ProductionStorySchema.parse(JSON.parse(rawText.slice(start, end + 1)));
      onChunk?.(story);
      return this.validateComedyStory({
        ...story,
        workflow: 'animated-visual-comedy' as const,
      });
    }
    const runnable = model.withStructuredOutput(ProductionStorySchema, {
      name: 'develop_complete_story',
      method: 'functionCalling',
    });
    const stream = await runnable.streamEvents(messages, { version: 'v2' });
    let result: unknown;
    let rawArguments = '';
    let rawText = '';
    let streamedStory = '';
    for await (const chunk of stream) {
      if (chunk.event === 'on_chat_model_stream') {
        const parts = chunk.data.chunk.tool_call_chunks ?? [];
        for (const part of parts) {
          if (part.args) rawArguments += part.args;
        }
        rawText += chunk.data.chunk.text ?? '';
        const partialStory = this.partialJsonString(rawArguments, 'story');
        if (partialStory && partialStory !== streamedStory) {
          streamedStory = partialStory;
          onChunk?.({ story: partialStory });
        }
      } else if (chunk.event === 'on_chain_end' && chunk.data.output) {
        result = chunk.data.output;
        onChunk?.(result);
      }
    }
    let generated = result ?? (rawArguments ? JSON.parse(rawArguments) : undefined);
    if (!generated && rawText) {
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      generated = JSON.parse(rawText.slice(start, end + 1));
    }
    const story = ProductionStorySchema.parse(generated);
    return this.validateComedyStory({
      ...story,
      ...(input.includes('animated-visual-comedy') || input.includes('动漫视觉喜剧')
        ? { workflow: 'animated-visual-comedy' as const }
        : {}),
    });
  }

  async reviewStory(source: string, story: unknown, modelId?: string) {
    const comedyReview = source.includes('animated-visual-comedy') || source.includes('动漫视觉喜剧');
    const model = await this.model(modelId, {
      temperature: 0.2,
      maxTokens: comedyReview ? 1800 : 1200,
      timeout: 120_000,
      maxRetries: 0,
      disableReasoning: true,
    });
    const messages = [
      new SystemMessage(`你是独立故事审查者。只审查，不改写故事。对照原始输入、已确认需求、完整故事和故事行动链，找出影响演绎的具体问题。
逐项检查：原文事实与新增演绎是否混淆；人物目标、阻碍、行动、结果是否有可追溯因果；位置、时间、物件和数量是否自洽；结尾是否回应故事建立的期待；关键变化是否能在后续剧本中演绎。
每个 issue 必须引用输入或故事中的具体证据，说明问题和可执行的修法。只返回最重要的至多 5 个问题。只有与已给事实冲突、内部状态矛盾或关键因果断裂等可核对问题用 blocking；趣味、节奏、结尾气质及其他审美偏好只能用 suggestion。没有问题时返回 issues=[]，不为了凑数量编造问题。`),
      new SystemMessage(comedyReview
        ? `你是独立的视觉喜剧审查者，不因字段齐全就判定合格。逐个检查开场、每次 reversal 和 endingCallback，并引用故事正文证据。
开场若在环境和姿势介绍后才进入冲突，标记 blocking。每次反转分别核对：expectationEvidence 是否是此前真正展示过的画面，而非审查者替角色编造的预期；结果是否重新解释线索并改变优势；origin=strategy 是否确由角色主动策略造成。至少一次有效策略反转，最终胜利必须由获胜者此前行动促成，不能主要靠巧合。
结尾关键规则必须在故事前三分之一已经展示，不能在兑现时才介绍；回敬必须产生新结果，不能重复摔倒或得意。重复转圈、扑空、摔倒、炫耀若没有新信息，指出需要合并的段落。无对白项目不得靠字幕或旁白解释。
物理与巧合逐项审查：尺寸、重量和搬运方式必须符合角色身体能力；起点、轨迹和落点必须有空间依据；“正好、精准、碰巧”接住或命中若没有角色主动控制，category=physics 且 passed=false。只有主动踢一下机关、之后完全依赖幸运轨迹，不算完成结果控制。
除 issues 外必须返回 comedyChecks：开场一项、每个 reversal 各一项、endingCallback 一项、整体物理逻辑一项、表演时长一项，共“反转数+4”项。每项填写 target、category、passed、evidence、problem；通过时 problem 为空字符串，不得省略失败项或把失败项从 checks 中删除。
必须返回 comedyScore：overall、hook、agency、surprise、causality、callback、pacing、physics 各 1-10 分。9 分表示可直接进入分镜的精炼成品，不靠鼓励给高分；存在任何 blocking 时 overall 必须低于 9。还要核对 performanceBudget 的状态承接与总秒数，任何机关状态凭空改变、角色动机断裂、同类击中重复或时长无法演完都要 blocking。
上述可核对缺陷均用 blocking；个人是否觉得好笑只作 suggestion。即使 storyReview 的其他项目通过，也不能漏报伪反转、迟铺垫、被动获胜和重复表演。
blocking 必须有正文中的直接矛盾或动作缺失，不得把“可能被余光看见、理论上也许能察觉、路径未充分证明绝不相交”等假设当成事实。角色已明确低头、转身或视线被遮挡时，可接受对手利用该视线盲区；位置、先后顺序和移动方向已写清时，不要求穷举证明所有理论路径。假设性风险最多列为 suggestion，不能因此压低 overall 到 9 以下。
overall 必须与证据一致：全部 comedyChecks 通过、issues 中没有 blocking 且没有需要返工的具体建议时，overall 应为 9-10，表示可以进入分镜；允许个别维度为 8，不得据此机械压低 overall。只有指出具体缺陷和返工理由时 overall 才能低于 9。`
        : '只检查通用故事因果、事实和连续性，不额外审查喜剧机制。'),
      new HumanMessage(JSON.stringify({ source, story })),
    ];
    const reviewSchema = comedyReview ? ProductionComedyStoryReviewSchema : ProductionStoryReviewSchema;
    const result = await model
      .withStructuredOutput(comedyReview ? ProductionComedyStoryReviewSchema : ProductionStoryReviewSchema, {
        name: 'review_complete_story',
        method: 'functionCalling',
      })
      .invoke(messages);
    let parsed = reviewSchema.safeParse(result);
    if (!parsed.success && comedyReview) {
      const fallback = await model.invoke([
        ...messages,
        new HumanMessage('结构化调用未返回有效结果。请只输出一个完整 JSON 对象，不要 Markdown：必须含 issues、comedyChecks、comedyScore；严格逐项审查，不得省略评分。'),
      ]);
      const content = typeof fallback.content === 'string'
        ? fallback.content
        : fallback.content.map((part) => 'text' in part ? part.text : '').join('');
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      parsed = reviewSchema.safeParse(JSON.parse(content.slice(start, end + 1)));
    }
    if (!parsed.success) throw parsed.error;
    const review = parsed.data;
    if (!comedyReview) return review;
    if (!review.comedyScore)
      throw new Error('喜剧审查必须返回综合评分及各维度评分');
    const reversalCount = (story as any)?.comedyDesign?.reversals?.length ?? 0;
    if (!review.comedyChecks || review.comedyChecks.length < reversalCount + 4)
      throw new Error('喜剧审查必须逐项覆盖开场、每个反转、结尾回敬、物理逻辑和表演时长');
    const issues = [...review.issues];
    review.comedyChecks.filter((check) => !check.passed).forEach((check) => {
      if (issues.some((issue) => issue.problem === check.problem || issue.evidence === check.evidence)) return;
      issues.push({
        severity: 'blocking',
        category: check.category === 'physics'
          ? 'continuity'
          : check.category === 'pacing'
            ? 'adaptation'
            : 'causality',
        evidence: check.evidence,
        problem: check.problem || `${check.target} 未通过喜剧审查`,
        suggestion: '返回故事阶段修复该喜剧节拍，再重新审查',
      });
    });
    if (review.comedyScore.overall < 9 && !issues.some((issue) => issue.problem.includes('综合评分低于 9')))
      issues.push({
        severity: 'blocking',
        category: 'adaptation',
        evidence: `当前综合评分 ${review.comedyScore.overall}/10`,
        problem: '动漫喜剧综合评分低于 9，尚不能进入分镜',
        suggestion: '根据各项审查修复弱点后重新生成并评分',
      });
    Object.entries(review.comedyScore).forEach(([dimension, score]) => {
      if (dimension === 'overall' || score >= 8) return;
      issues.push({
        severity: 'blocking',
        category: dimension === 'physics' ? 'continuity' : 'adaptation',
        evidence: `${dimension} 评分 ${score}/10`,
        problem: `动漫喜剧 ${dimension} 维度低于 8，存在明显短板`,
        suggestion: '优先重写该维度对应的故事节拍',
      });
    });
    return { ...review, issues };
  }

  async script(idea: string, modelId?: string, onChunk?: ProductionChunk) {
    const model = await this.model(modelId);
    const stream = await model
      .withStructuredOutput(ProductionScriptSchema, {
        name: 'write_script',
        method: 'functionCalling',
      })
      .stream([
        new SystemMessage(`你是编剧 Agent。将已确认的完整故事改编为可拍摄的场景剧本；旧项目只有创意输入时仍可从创意写剧本。
只完成剧本，不设计角色参考图或分镜。场景 ID 使用 scene-1、scene-2 的稳定格式。
targetDuration 填写用户要求的目标总时长（秒）；用户未指定时可省略，后续不得把单场景时长误当成全片时长。
完整故事已确认时，保留其关键人物、行动、因果和结局，不自行替换故事；将心理与叙述转为动作、对白和声音。目标时长不足以容纳必要转折时，不静默删改故事，在 adaptationNote 中明确说明时长冲突及需要延长或缩小演绎范围；没有冲突时省略该字段。
动漫视觉喜剧必须无对白，保留已确认故事的 comedyDesign；旧项目没有该字段时，按相同结构补齐视觉钩子、有效反转和结尾回敬。
剧本包含对白、动作、时间和地点，所有文本使用用户输入的语言。`),
        new SystemMessage(
          this.guidanceFor(idea, 'short-drama-develop', 'short-drama-write'),
        ),
        new HumanMessage(idea),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    const script = ProductionScriptSchema.parse(result);
    return this.validateComedyStory({
      ...script,
      ...(idea.includes('animated-visual-comedy') || idea.includes('动漫视觉喜剧')
        ? { workflow: 'animated-visual-comedy' as const }
        : {}),
    });
  }

  async characters(
    script: unknown,
    modelId?: string,
    onChunk?: ProductionChunk,
  ) {
    const model = await this.model(modelId);
    const stream = await model
      .withStructuredOutput(ProductionCharactersSchema, {
        name: 'design_characters',
        method: 'functionCalling',
      })
      .stream([
        new SystemMessage(`你是角色与关键道具设计师 Agent。根据已确认剧本提取并统一所有主要角色和推动剧情的关键道具。
只生成角色与道具设定，不生成分镜。角色 ID 使用 character-1、character-2，道具 ID 使用 prop-1、prop-2 的稳定格式。
描述必须锁定外貌、年龄、体型、服装和标志性配饰；referencePrompt 用于直接生成一致的全身角色三视图，不生成角色环境图。
所有输出必须使用用户输入和剧本的语言；中文项目必须使用中文，包括 referencePrompt，不得翻译成英文。技术专有名词可保留原文。
props 只收录会跨镜头出现、影响剧情或必须保持一致的道具，不收录普通陈设。道具描述锁定材质、颜色、形状、磨损、标记和文字排版；referencePrompt 用于直接生成道具正面、侧面、背面三视图，只描述道具自身及固定连接组件，禁止描述任何角色、角色操作、剧情动作或环境。
书信、文件、屏幕、招牌等包含关键可见文字时，textContent 必须逐字保存剧本规定的文字；referencePrompt 描述道具本身，不依赖每次生成重新创作文字。
所有文本使用剧本语言。若输入包含 revisionFeedback，优先执行该修改意见，并保留未涉及角色的稳定 ID。`),
        new SystemMessage(
          this.guidanceFor(
            script,
            'short-drama-assets',
            'short-drama-image-prompts',
          ),
        ),
        new HumanMessage(JSON.stringify(script)),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    return ProductionCharactersSchema.parse(result);
  }

  async storyboard(
    plan: unknown,
    modelId?: string,
    onChunk?: ProductionChunk,
  ): Promise<ProductionPlan> {
    const model = await this.model(modelId);
    const stream = await model
      .withStructuredOutput(ProductionStoryboardSchema, {
        name: 'design_storyboard',
        method: 'functionCalling',
      })
      .stream([
        new SystemMessage(`你是场景师和分镜师 Agent。根据已确认剧本、角色与关键道具设计场景资产和完整分镜。
先独立规划 sceneAssets，再把分场剧本映射到场景资产。场景资产不是分场剧本的下级内容：多个分场剧本只要拍摄场地和环境状态相同，就必须复用同一个 sceneAssetId；只有地点不同，或时间、天气、光照、陈设、破坏程度等环境差别明显时才新建资产。不得按剧情节拍、角色动作或镜头数量重复创建场景资产。
场景资产 ID 使用 scene-asset-1、scene-asset-2 的稳定格式，title 使用地点及必要的环境状态命名，不使用“第一次扑击”等剧情名称。保留输入分场剧本 ID，并为每个分场剧本填写 sceneAssetId。镜头 ID 使用 shot-1、shot-2 的全局唯一格式；没有独立叙事增量的分场剧本应返回 shots=[]，把完整表演合并到同空间的其他镜头。
场景资产的 referencePrompt 只能描述无人环境：空间布局、建筑风格、自然地貌、陈设、光线与色彩。明确禁止人物、角色、人影、人体局部、故事动物和角色倒影，不描述任何角色动作或剧情表演；角色与表演只写入具体镜头。
characterIds 只能填写输入角色的 ID，propIds 只能填写输入道具的 ID，不得填写名称；只要镜头中出现关键道具就必须引用，不得仅靠文字描述。
description 描述镜头的画面与表演，movement 描述动作和运镜；本阶段不要生成图片或视频提示词。
每个镜头必须完成一个不可分割的动作因果或叙事节拍，不把同一动作的准备、发生、结果和反应机械拆成多个镜头；没有新信息、动作推进或关系变化的重复镜头必须合并。
narrativeBeat 用一句话记录本镜在故事主线中新增的独立剧情节点。先按“起因→行动→阻碍→应对→结果→收束”梳理故事，再为不同剧情节点安排镜头；后续镜头必须发生在此前结果之上，不得从另一个角度重复讲述已经交代过的同一事情。
动漫视觉喜剧的每镜必须填写 comedyRole：第一镜为 hook，最后一个剧情镜头为 callback，中间按实际功能选择 setup、escalation、reversal 或 reaction。reversal 镜头数量必须覆盖 comedyDesign.reversals，并让铺垫、明确预期、反向结果和局势变化都能被看见；不能用更多事故或更夸张表情冒充反转。无对白，不用字幕解释笑点。
continuityGroupId 标识同一时空、同一连续动作因果的叙事单元，同一单元使用相同 ID；时间跳跃、地点更换或新叙事必须使用新 ID。同组相邻镜头继承人物位置、朝向、视线、持物手、道具状态和运动方向，不同组不继承这些临时状态。
startState 和 endState 分别记录镜头开始与结束时的必要人物、道具和空间状态；同组下一镜 startState 必须承接上一镜 endState。角色身份、服装与关键物体结构在全片始终一致，不受分组影响。
duration 必须覆盖完整动作、运镜和情绪停留：单一简单动作通常 4-6 秒，两个动作节拍通常 6-9 秒，复杂表演或情绪转折通常 8-12 秒。
禁止在动作、书写、阅读、对视或运镜尚未完成时结束。若一个镜头无法在自然节奏内交代完整，应拆成多个镜头，而不是压缩表演。
targetDuration 存在时，全片镜头时长总和必须处于目标时长的 90%-110%，镜头总数不得超过“目标秒数 ÷ 5”向上取整；30 秒短片优先 4-5 镜，45 秒优先 5-7 镜。不得先按每个场景 4-10 镜展开再超额累计。
所有镜头继承统一视觉风格，所有文本使用剧本语言。若输入包含 revisionFeedback，优先执行该修改意见，并保留未涉及场景和镜头的稳定 ID。`),
        new SystemMessage('语言要求：所有输出与用户输入语言一致。中文项目的场景、动作、运镜及 referencePrompt 必须全部使用中文，即使输入中包含英文提示词也要改为中文。'),
        new SystemMessage(
          this.guidanceFor(plan, 'short-drama-storyboard', 'storyboard'),
        ),
        new HumanMessage(JSON.stringify(plan)),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    const storyboard = ProductionStoryboardSchema.parse({
      ...(result as any),
      scenes: (result as any).scenes.map((scene: any) => ({
        ...scene,
        shots: scene.shots ?? [],
      })),
    });
    const source = plan as any;
    const byId = new Map(storyboard.scenes.map((scene) => [scene.id, scene]));
    const usedShotIds = new Set<string>();
    let shotSequence = 1;
    const uniqueShotId = (preferred: string) => {
      if (!usedShotIds.has(preferred)) {
        usedShotIds.add(preferred);
        return preferred;
      }
      while (usedShotIds.has(`shot-${shotSequence}`)) shotSequence += 1;
      const id = `shot-${shotSequence}`;
      usedShotIds.add(id);
      return id;
    };
    const resolveEntityIds = (
      ids: string[],
      entities: { id: string; name: string }[],
      description: string,
    ) => {
      const resolved = ids
        .flatMap((id) => id.split(/[,，、]/))
        .map((id) => entities.find((entity) => entity.id === id.trim() || entity.name === id.trim())?.id)
        .filter((id): id is string => Boolean(id));
      entities.forEach((entity) => {
        if (description.includes(entity.name)) resolved.push(entity.id);
      });
      return [...new Set(resolved)];
    };
    const merged = {
      ...source,
      sceneAssets: storyboard.sceneAssets,
      scenes: source.scenes.map((scene: any, index: number) => {
        const generated = byId.get(scene.id) ?? storyboard.scenes[index];
        return {
          ...scene,
          ...generated,
          id: scene.id,
          shots: generated?.shots.map((shot: any) => ({
            ...shot,
            id: uniqueShotId(shot.id),
            characterIds: resolveEntityIds(shot.characterIds, source.characters, shot.description),
            propIds: resolveEntityIds(shot.propIds ?? [], source.props ?? [], shot.description),
          })),
        };
      }),
    };
    const finalPlan = ProductionPlanSchema.parse(merged);
    finalPlan.scenes.forEach((scene) => scene.shots.forEach((shot) => {
      shot.narrativeBeat ||= shot.title;
      shot.continuityGroupId ||= scene.id;
      shot.startState ||= shot.description;
      shot.endState ||= shot.description;
    }));
    if (source.targetDuration) {
      const shots = finalPlan.scenes.flatMap((scene) => scene.shots);
      const duration = shots.reduce((total, shot) => total + shot.duration, 0);
      const maxShots = Math.ceil(source.targetDuration / 5);
      if (
        shots.length > maxShots ||
        duration < source.targetDuration * 0.9 ||
        duration > source.targetDuration * 1.1
      ) {
        throw new Error(`分镜需要按完整叙事节拍合并：目标 ${source.targetDuration} 秒，当前 ${shots.length} 镜、${duration} 秒；最多 ${maxShots} 镜且总时长需在目标的 90%-110% 内`);
      }
    }
    if (!finalPlan.scenes.some((scene) => scene.shots.length > 0))
      throw new Error('分镜至少需要一个完整叙事镜头，请重试');
    const narrativeBeats = finalPlan.scenes.flatMap((scene) => scene.shots.map((shot) => shot.narrativeBeat?.trim()).filter(Boolean));
    if (new Set(narrativeBeats).size !== narrativeBeats.length)
      throw new Error('多个镜头重复承担同一剧情节点，请按故事主线合并后再试');
    if (source.workflow === 'animated-visual-comedy') {
      const shots = finalPlan.scenes.flatMap((scene) => scene.shots);
      const minimum = comedyReversalMinimum(source.targetDuration);
      if (shots.some((shot) => !shot.comedyRole))
        throw new Error('动漫喜剧的每个镜头都需要标记喜剧功能，请重试');
      if (shots[0]?.comedyRole !== 'hook')
        throw new Error('动漫喜剧第一镜必须直接呈现视觉钩子');
      if (shots.filter((shot) => shot.comedyRole === 'reversal').length < minimum)
        throw new Error(`动漫喜剧分镜至少需要 ${minimum} 个有效反转镜头`);
      if (shots.at(-1)?.comedyRole !== 'callback')
        throw new Error('动漫喜剧最后一镜必须复用前文线索完成结尾回敬');
    }
    const characterIds = new Set(
      finalPlan.characters.map((character) => character.id),
    );
    const propIds = new Set((finalPlan.props ?? []).map((prop) => prop.id));
    const sceneAssetIds = new Set(finalPlan.sceneAssets?.map((scene) => scene.id));
    const entityIds = [
      ...finalPlan.characters.map((character) => character.id),
      ...(finalPlan.props ?? []).map((prop) => prop.id),
      ...(finalPlan.sceneAssets ?? []).map((scene) => scene.id),
      ...finalPlan.scenes.map((scene) => scene.id),
      ...finalPlan.scenes.flatMap((scene) =>
        scene.shots.map((shot) => shot.id),
      ),
    ];
    if (
      byId.size !== source.scenes.length ||
      new Set(entityIds).size !== entityIds.length ||
      finalPlan.scenes.some((scene) =>
        !sceneAssetIds.has(scene.sceneAssetId ?? '') ||
        scene.shots.some((shot) =>
          shot.characterIds.some((id) => !characterIds.has(id)) ||
          shot.propIds?.some((id) => !propIds.has(id)),
        ),
      )
    ) {
      throw new Error('分镜包含缺失场景、重复 ID 或无效场景、角色与道具引用，请重试');
    }
    return finalPlan;
  }

  async imagePrompts(
    plan: ProductionPlan,
    modelId?: string,
    onChunk?: ProductionChunk,
  ): Promise<ProductionPlan> {
    const model = await this.model(modelId);
    const stream = await model
      .withStructuredOutput(ProductionImagePromptsSchema, {
        name: 'design_storyboard_image_prompts',
        method: 'functionCalling',
      })
      .stream([
        new SystemMessage(`你是分镜图提示词 Agent。根据已确认分镜逐镜设计静态关键帧图片提示词。
保留所有场景 ID 和镜头 ID，不修改分镜内容，不生成视频提示词。提示词需要明确角色、场景、构图、景别、光线和统一视觉风格。存在 comedyRole 时，画面必须让 hook、reversal 或 callback 的关键因果可见，不能只写搞笑或夸张。
visualPrompt 中每次出现角色名称或当前场景名称时，都必须写成纯文本标记“[名称]”，例如“[长颈鹿]弯下腰，[青蛙]在[非洲草原]呱呱叫”。只标记角色和场景，不标记道具，不使用 @ 符号。
sceneAssets.referencePrompt 只用于生成独立场景资产，不得复制到 visualPrompt；尤其不得继承其中的无人、无动物、空景、禁止角色动作、固定机位或固定构图等约束。分镜只复用场景地点与环境设定，角色、动作、机位和构图以当前镜头为准。
相邻镜头的叙事动作和视觉表达必须有明显增量：根据内容选择全景、中景、近景、特写、俯拍或主观视角，避免连续使用相同机位、相同人物站位、相同采莲或追逐姿势。相同场景不等于重复画面，每镜只选最能代表完整叙事节拍的关键瞬间。
continuityGroupId 相同的相邻镜头必须承接 startState、endState 中的人物位置、朝向、持物手、道具状态和空间关系；不同组只保持角色身份和关键物体设计，不强行继承临时位置与动作。
propIds 引用的关键道具必须继承输入道具的材质、形状、磨损、标记和文字内容，不得重新设计；引用图与固定文字资产优先级高于自由创作。`),
        new SystemMessage('语言要求：visualPrompt 必须使用用户输入和剧本的语言。中文项目必须输出完整中文提示词，不得输出英文或中英混杂；仅模型参数等专有名词可保留英文。'),
        new SystemMessage(this.guidanceFor(plan, 'short-drama-image-prompts')),
        new HumanMessage(JSON.stringify(plan)),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    const prompts = ProductionImagePromptsSchema.parse(result);
    const finalPlan = ProductionPlanSchema.parse({
      ...plan,
      scenes: plan.scenes.map((scene, sceneIndex) => {
        const generatedScene = matchByIdOrOrder(prompts.scenes, scene.id, sceneIndex);
        return {
          ...scene,
          shots: scene.shots.map((shot, shotIndex) => {
            const visualPrompt = generatedScene
              ? matchByIdOrOrder(generatedScene.shots, shot.id, shotIndex)?.visualPrompt
                || `${shot.description}。${plan.visualStyle}，静态关键帧，保持角色、道具和场景设定一致。`
              : `${shot.description}。${plan.visualStyle}，静态关键帧，保持角色、道具和场景设定一致。`;
            return {
              ...shot,
              visualPrompt: markProductionPromptAssets(visualPrompt, plan, scene),
            };
          }),
        };
      }),
    });
    if (
      finalPlan.scenes.some((scene) =>
        scene.shots.some((shot) => !shot.visualPrompt),
      )
    )
      throw new Error('分镜图提示词缺少场景或镜头，请重试');
    return finalPlan;
  }

  async videoPrompts(
    plan: ProductionPlan,
    modelId?: string,
    onChunk?: ProductionChunk,
  ): Promise<ProductionPlan> {
    const model = await this.model(modelId);
    const stream = await model
      .withStructuredOutput(ProductionVideoPromptsSchema, {
        name: 'design_video_prompts',
        method: 'functionCalling',
      })
      .stream([
        new SystemMessage(`你是导演与视频拍摄提示词 Agent。结合剧本语境、已确认分镜和分镜图提示词，逐镜设计视频提示词，并逐对设计相邻镜头的转场。
保留所有场景 ID 和镜头 ID，不修改分镜，不重新生成图片提示词。
motionPrompt 中每次出现角色名称或当前场景名称时，都必须写成纯文本标记“[名称]”，例如“0:00-0:04 [长颈鹿]弯下腰，[青蛙]在[非洲草原]呱呱叫”。只标记角色和场景，不标记道具，不使用 @ 符号。
每对相邻镜头（包括跨场景）都要根据具体内容动态创作 transitionFromPrevious，不得套用固定模板。只有 continuityGroupId 相同且画面确实可接时才可选择 continuous，并继承 endState 到 startState；不同组必须选择 cut，不继承人物位置、持物手、道具临时状态或运动方向。综合剧情、情绪、时空、构图、景别、人物动作、环境元素、光线和相机运动，决定具体衔接，不得强行无缝。
bridge 描述本对镜头特有的视觉桥梁；previousOutro 与 currentIntro 必须共同设计，明确上一镜如何出场、当前镜如何入场；cameraPath 描述跨镜头相机路径；consistency 锁定运动方向、速度、主体状态、光线、色彩和节奏；rationale 简述创作理由。允许新增合理过渡元素，但不得改变剧情。
motionPrompt 描述可拍摄的完整过程，必须使用连续时间轴：首行固定为“画面内容及运镜：”，随后按动作节拍划分为 1～4 个时段，每行以“0:00-0:04”这类“开始秒-结束秒”时间范围开头。时段必须从 0:00 开始，连续、不重叠、不留空，并结束于该镜头的 duration；不要机械按固定秒数切分。
存在 comedyRole 时，按对应喜剧功能完整呈现铺垫、预期、反向结果和反应；无对白项目禁止通过对白、字幕或旁白解释笑点。
每个时段都要同时写清画面内容和运镜：角色动作、表情、位置变化、关键道具状态、环境反馈，以及机位、景别、构图和相机运动如何变化。有连续上一镜时，把入场承接放在第一时间段；存在下一镜时，把与下一镜配合的出场设计放在最后时间段。首镜没有入场承接，末镜不强制安排出场。每镜必须保留足够主体表演时间，不能整段只有转场。
关键道具在全片中保持同一材质、形状、磨损、标记与文字，禁止改写书信内容、增减文字或让文字随动作变形。镜头必须在主要动作和运镜完成后再结束。`),
        new SystemMessage('语言要求：motionPrompt 与全部转场字段必须使用用户输入和剧本的语言。中文项目必须输出完整中文提示词，不得输出英文或中英混杂；对白和固定文字资产必须逐字保留。'),
        new SystemMessage(this.guidanceFor(plan, 'short-drama-video-prompts')),
        new HumanMessage(JSON.stringify(plan)),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    const prompts = ProductionVideoPromptsSchema.parse(result);
    const finalPlan = ProductionPlanSchema.parse({
      ...plan,
      scenes: plan.scenes.map((scene, sceneIndex) => {
        const generatedScene = matchByIdOrOrder(prompts.scenes, scene.id, sceneIndex);
        return {
          ...scene,
          shots: scene.shots.map((shot, shotIndex) => {
            const generatedShot = generatedScene
              ? matchByIdOrOrder(generatedScene.shots, shot.id, shotIndex)
              : undefined;
            return {
              ...shot,
              motionPrompt: markProductionPromptAssets(
                generatedShot?.motionPrompt
                  || `画面内容及运镜：\n0:00-0:${String(shot.duration).padStart(2, '0')} ${shot.description}；运镜：${shot.movement}；完整呈现动作后再结束。`,
                plan,
                scene,
              ),
              transitionFromPrevious: generatedShot?.transitionFromPrevious,
            };
          }),
        };
      }),
    });
    const shots = finalPlan.scenes.flatMap((scene) => scene.shots);
    shots.slice(1).forEach((shot, index) => {
      const previousShot = shots[index];
      const sameNarrative = shot.continuityGroupId === previousShot.continuityGroupId;
      if (!sameNarrative) {
        shot.transitionFromPrevious = {
          mode: 'cut',
          rationale: '不同连续叙事单元，重新建立时空关系',
          bridge: '直接切换至新的叙事单元',
          previousOutro: '上一叙事单元完成当前动作后结束',
          currentIntro: `从“${shot.title}”的新时空画面开始`,
          cameraPath: shot.movement,
          consistency: '仅保持角色身份、关键物体设计与统一视觉风格，不继承临时动作和空间状态',
        };
        return;
      }
      if (shot.transitionFromPrevious?.mode === 'continuous') return;
      shot.transitionFromPrevious = {
        ...shot.transitionFromPrevious,
        mode: 'cut',
        rationale: '保留镜头独立性，采用直接切镜',
        bridge: '直接切换画面',
        previousOutro: '上一镜完成主要动作后结束',
        currentIntro: `从“${shot.title}”的第一个画面开始`,
        cameraPath: shot.movement,
        consistency: '保持角色、道具、光线和统一视觉风格一致',
      };
    });
    return finalPlan;
  }
}
