import { Injectable } from '@nestjs/common';
import { HumanMessage, SystemMessage } from 'langchain';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createChatModel } from '@/common/llm';
import { ModelsService } from '../models/models.service';
import {
  ProductionCharactersSchema,
  ProductionImagePromptsSchema,
  ProductionPlan,
  ProductionPlanSchema,
  ProductionRequirementsSchema,
  ProductionScriptSchema,
  ProductionStoryboardSchema,
  ProductionVideoPromptsSchema,
} from './production.types';

type ProductionChunk = (data: unknown) => void;

@Injectable()
export class ProductionPlanner {
  private readonly skillCache = new Map<string, string>();

  constructor(private readonly models: ModelsService) {}

  private async model(modelId?: string) {
    const runtimeModel = await this.models.runtime(modelId, 'text');
    return createChatModel(runtimeModel, { temperature: 0.7 });
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

  async requirements(
    input: string,
    modelId?: string,
    onChunk?: ProductionChunk,
  ) {
    const model = await this.model(modelId);
    const stream = await model
      .withStructuredOutput(ProductionRequirementsSchema, {
        name: 'clarify_production_requirements',
        method: 'functionCalling',
      })
      .stream([
        new SystemMessage(`你是导演 Agent 的需求澄清助手。判断影视创作需求是否足以生成完整剧本。
只询问会实质改变主角、故事冲突、结局、改编边界、目标时长或视觉形式的关键缺项，最多 3 个问题，不重复已知信息。
信息足够时 status=ready 且 questions=[]；信息不足时 status=questions，brief 汇总已知需求，questions 给出最关键的问题。
用户明确表示“帮我补充”“由你决定”“不知道”或授权 Agent 创作时，必须根据已知偏好合理补齐缺失设定，status=ready 且 questions=[]，不得继续追问。
brief 需要完整写出主角、目标、核心冲突、场景、结局、时长和视觉形式，并区分用户要求与 Agent 创作补充。
brief 使用易读的 Markdown 格式：按“用户明确要求”“Agent 创作补充”“制作适配要点”分节，每项设定单独一行，不要把所有内容连成一段。
不得生成剧本、角色、分镜或媒体提示词。`),
        new SystemMessage(this.creativeGuidance('elicitation-skill')),
        new HumanMessage(input),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    return ProductionRequirementsSchema.parse(result);
  }

  async script(idea: string, modelId?: string, onChunk?: ProductionChunk) {
    const model = await this.model(modelId);
    const stream = await model
      .withStructuredOutput(ProductionScriptSchema, {
        name: 'write_script',
        method: 'functionCalling',
      })
      .stream([
        new SystemMessage(`你是编剧 Agent。把创意扩展为完整故事和可拍摄的场景剧本。
只完成剧本，不设计角色参考图或分镜。场景 ID 使用 scene-1、scene-2 的稳定格式。
剧本包含对白、动作、时间和地点，所有文本使用用户输入的语言。`),
        new SystemMessage(
          this.creativeGuidance('short-drama-develop', 'short-drama-write'),
        ),
        new HumanMessage(idea),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    return ProductionScriptSchema.parse(result);
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
        new SystemMessage(`你是角色设计师 Agent。根据已确认剧本提取并统一所有主要角色。
只生成角色设定，不生成分镜。角色 ID 使用 character-1、character-2 的稳定格式。
描述必须锁定外貌、年龄、体型、服装和标志性配饰；referencePrompt 用于生成一致的全身角色参考图。
所有文本使用剧本语言。若输入包含 revisionFeedback，优先执行该修改意见，并保留未涉及角色的稳定 ID。`),
        new SystemMessage(
          this.creativeGuidance(
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
    return ProductionCharactersSchema.parse(result).characters;
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
        new SystemMessage(`你是场景师和分镜师 Agent。根据已确认剧本与角色设计场景资产和完整分镜。
保留输入场景 ID，为每个场景提供 referencePrompt 和至少一个镜头。镜头 ID 使用 shot-1、shot-2 的全局唯一格式。
characterIds 只能引用输入角色。description 描述镜头的画面与表演，movement 描述动作和运镜；本阶段不要生成图片或视频提示词。
所有镜头继承统一视觉风格，所有文本使用剧本语言。若输入包含 revisionFeedback，优先执行该修改意见，并保留未涉及场景和镜头的稳定 ID。`),
        new SystemMessage(
          this.creativeGuidance('short-drama-storyboard', 'storyboard'),
        ),
        new HumanMessage(JSON.stringify(plan)),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    const storyboard = ProductionStoryboardSchema.parse(result);
    const source = plan as any;
    const byId = new Map(storyboard.scenes.map((scene) => [scene.id, scene]));
    const merged = {
      ...source,
      scenes: source.scenes.map((scene: any) => ({
        ...scene,
        ...byId.get(scene.id),
      })),
    };
    const finalPlan = ProductionPlanSchema.parse(merged);
    const characterIds = new Set(
      finalPlan.characters.map((character) => character.id),
    );
    const entityIds = [
      ...finalPlan.characters.map((character) => character.id),
      ...finalPlan.scenes.map((scene) => scene.id),
      ...finalPlan.scenes.flatMap((scene) =>
        scene.shots.map((shot) => shot.id),
      ),
    ];
    if (
      byId.size !== source.scenes.length ||
      new Set(entityIds).size !== entityIds.length ||
      finalPlan.scenes.some((scene) =>
        scene.shots.some((shot) =>
          shot.characterIds.some((id) => !characterIds.has(id)),
        ),
      )
    ) {
      throw new Error('分镜包含缺失场景、重复 ID 或无效角色引用，请重试');
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
保留所有场景 ID 和镜头 ID，不修改分镜内容，不生成视频提示词。提示词需要明确角色、场景、构图、景别、光线和统一视觉风格。`),
        new SystemMessage(this.creativeGuidance('short-drama-image-prompts')),
        new HumanMessage(JSON.stringify(plan)),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    const prompts = ProductionImagePromptsSchema.parse(result);
    const byScene = new Map(prompts.scenes.map((scene) => [scene.id, scene]));
    const finalPlan = ProductionPlanSchema.parse({
      ...plan,
      scenes: plan.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot) => ({
          ...shot,
          visualPrompt: byScene
            .get(scene.id)
            ?.shots.find((item) => item.id === shot.id)?.visualPrompt,
        })),
      })),
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
每对相邻镜头（包括跨场景）都要根据具体内容动态创作 transitionFromPrevious，不得套用固定模板。综合剧情、情绪、时空、构图、景别、人物动作、环境元素、光线和相机运动，决定 continuous 或 cut。不适合连续时必须选择 cut，不得强行无缝。
bridge 描述本对镜头特有的视觉桥梁；previousOutro 与 currentIntro 必须共同设计，明确上一镜如何出场、当前镜如何入场；cameraPath 描述跨镜头相机路径；consistency 锁定运动方向、速度、主体状态、光线、色彩和节奏；rationale 简述创作理由。允许新增合理过渡元素，但不得改变剧情。
motionPrompt 描述可拍摄的完整过程：有连续上一镜时先写入场承接，再写主体表演；存在下一镜时写出与下一镜配合的出场设计。首镜没有入场承接，末镜不强制安排出场。每镜必须保留足够主体表演时间，不能整段只有转场。`),
        new SystemMessage(this.creativeGuidance('short-drama-video-prompts')),
        new HumanMessage(JSON.stringify(plan)),
      ]);
    let result: unknown;
    for await (const chunk of stream) {
      result = chunk;
      onChunk?.(chunk);
    }
    const prompts = ProductionVideoPromptsSchema.parse(result);
    const byScene = new Map(prompts.scenes.map((scene) => [scene.id, scene]));
    const finalPlan = ProductionPlanSchema.parse({
      ...plan,
      scenes: plan.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot) => ({
          ...shot,
          motionPrompt: byScene
            .get(scene.id)
            ?.shots.find((item) => item.id === shot.id)?.motionPrompt,
          transitionFromPrevious: byScene
            .get(scene.id)
            ?.shots.find((item) => item.id === shot.id)
            ?.transitionFromPrevious,
        })),
      })),
    });
    const shots = finalPlan.scenes.flatMap((scene) => scene.shots);
    if (
      finalPlan.scenes.some((scene) =>
        scene.shots.some((shot) => !shot.motionPrompt),
      ) || shots.slice(1).some((shot) => !shot.transitionFromPrevious)
    )
      throw new Error('视频提示词或相邻镜头转场设计不完整，请重试');
    return finalPlan;
  }
}
