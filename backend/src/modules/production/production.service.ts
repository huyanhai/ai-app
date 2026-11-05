import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ModelsService } from '../models/models.service';
import { ImageStorageService } from '../canvas/image-storage.service';
import { genImage } from '@/common/llm/tools/gen-image';
import { genVideo, queryVideoTask } from '@/common/llm/tools/gen-video';
import { ChunkStatus } from '@/common/utils/ai-stream-utils';
import { ProductionPlanner } from './production.planner';
import { buildProductionGraph } from './production.graph';
import {
  ConfirmProductionDto,
  ConfirmStageDto,
  CreateProductionDto,
  ReviseStageDto,
  RetryProductionNodeDto,
  StartMediaPhaseDto,
} from './dto/production.dto';
import {
  ProductionNode,
  ProductionStreamEvent,
  PRODUCTION_PHASE,
} from './production.types';

const ACTIVE_PHASES = [
  PRODUCTION_PHASE.character,
  PRODUCTION_PHASE.scene,
  PRODUCTION_PHASE.storyboard,
  PRODUCTION_PHASE.video,
];

@Injectable()
export class ProductionService {
  private readonly active = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: ProductionPlanner,
    private readonly models: ModelsService,
    private readonly images: ImageStorageService,
  ) {}

  async create(
    input: CreateProductionDto,
    onEvent?: (event: ProductionStreamEvent) => void,
  ) {
    const started = this.event('requirements', '导演 Agent 正在分析创作需求');
    const project = await this.prisma.productionProject.create({
      data: {
        id: randomUUID(),
        idea: input.idea,
        modelId: input.modelId,
        status: 'requirements_pending',
        plan: '{}',
        nodes: '[]',
        edges: '[]',
        events: JSON.stringify([started]),
      },
    });
    onEvent?.({ type: 'start', projectId: project.id, stage: 'requirements' });
    try {
      const idea = input.style
        ? `${input.idea}\n\n用户已明确指定全片视频风格：${input.style}。这是用户的硬性创作要求，请纳入需求摘要，后续剧本、角色、分镜、图片提示词和视频提示词必须统一继承，不要再次询问风格。`
        : input.idea;
      const requirements = await this.planner.requirements(
        idea,
        input.modelId,
        (data) =>
          onEvent?.({
            type: 'chunk',
            projectId: project.id,
            stage: 'requirements',
            data,
          }),
      );
      if (input.style)
        requirements.brief += `\n\n全片视频风格（用户指定，必须统一继承）：${input.style}`;
      const events = [
        started,
        this.event(
          'requirements',
          requirements.status === 'questions'
            ? '需求仍需补充，等待用户回答'
            : '需求摘要已生成，等待用户确认',
        ),
      ];
      const updated = await this.prisma.productionProject.update({
        where: { id: project.id },
        data: {
          status:
            requirements.status === 'questions'
              ? 'requirements_clarifying'
              : 'requirements_review',
          requirements: JSON.stringify(requirements),
          events: JSON.stringify(events),
        },
      });
      const result = this.serialize(updated);
      onEvent?.({ type: 'result', project: result });
      return result;
    } catch (error) {
      await this.prisma.productionProject.update({
        where: { id: project.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  async get(id: string) {
    const project = await this.find(id);
    const plan = JSON.parse(project.plan);
    const nodes = this.parseNodes(project.nodes);
    const tableIndex = nodes.findIndex(
      (node) => node.id === 'production-shot-table',
    );
    if (plan.scenes && tableIndex >= 0) {
      const continuity = this.parseEdges(project.edges).some(
        (edge) => edge.data?.kind === 'continuity',
      );
      const merged = this.mergeLayout(
        buildProductionGraph(plan, 'storyboard', continuity),
        nodes,
      );
      if (JSON.stringify(nodes) !== JSON.stringify(merged.nodes)) {
        nodes.splice(0, nodes.length, ...merged.nodes);
        project.nodes = JSON.stringify(nodes);
        await this.prisma.productionProject.update({
          where: { id },
          data: { nodes: project.nodes },
        });
        await this.syncCanvas(nodes, this.parseEdges(project.edges));
      }
    }
    const stage = this.mediaStage(project.status);
    if (stage && project.status.endsWith('_running'))
      this.schedule(id, this.phaseList(stage));
    return this.serialize(project);
  }

  async confirmStage(
    id: string,
    input: ConfirmStageDto,
    onEvent?: (event: ProductionStreamEvent) => void,
  ) {
    const project = await this.find(id);
    const allowedStages = [
      'requirements_review',
      'script_review',
      'script_pending',
      'characters_review',
      'characters_pending',
      'storyboard_review',
      'storyboard_pending',
      'image_prompts_review',
      'image_prompts_pending',
      'video_prompts_review',
      'video_prompts_pending',
      'references_review',
      'storyboards_review',
      'videos_review',
    ];
    if (!allowedStages.includes(project.status)) {
      throw new BadRequestException('当前阶段不能确认');
    }
    const currentNodes = input.nodes as ProductionNode[];
    let plan = this.mergePlanWithCanvas(
      JSON.parse(project.plan),
      currentNodes,
    );
    const events = this.parseEvents(project.events);
    if (!project.status.endsWith('_pending'))
      events.push(
        this.event(project.status.split('_')[0], '用户已确认当前阶段'),
      );

    if (
      ['references_review', 'storyboards_review', 'videos_review'].includes(
        project.status,
      )
    ) {
      const nextStatus = {
        references_review:
          project.mediaMode === 'manual'
            ? 'storyboards_ready'
            : 'storyboards_running',
        storyboards_review:
          project.mediaMode === 'manual' ? 'videos_ready' : 'videos_running',
        videos_review: 'media_completed',
      }[project.status];
      const updated = await this.prisma.productionProject.update({
        where: { id },
        data: { status: nextStatus, events: JSON.stringify(events) },
      });
      if (
        project.status === 'references_review' &&
        nextStatus === 'storyboards_running'
      )
        this.schedule(id, [PRODUCTION_PHASE.storyboard]);
      if (
        project.status === 'storyboards_review' &&
        nextStatus === 'videos_running'
      )
        this.schedule(id, [PRODUCTION_PHASE.video]);
      const result = this.serialize(updated);
      onEvent?.({ type: 'result', project: result });
      return result;
    }

    if (project.status === 'video_prompts_review') {
      if (!['auto', 'manual'].includes(input.mediaMode)) {
        throw new BadRequestException('请选择自动或手动媒体模式');
      }
      const auto = input.mediaMode === 'auto';
      const shots = plan.scenes.flatMap((scene) => scene.shots);
      if (
        input.continuity &&
        shots.slice(1).some((shot) => !shot.transitionFromPrevious)
      ) {
        onEvent?.({ type: 'start', projectId: id, stage: 'videoPrompts' });
        events.push(this.event('videoPrompts', '导演 Agent 正在补齐相邻镜头转场设计'));
        plan = await this.planner.videoPrompts(
          plan,
          project.modelId,
          (data) => onEvent?.({ type: 'chunk', projectId: id, stage: 'videoPrompts', data }),
        );
      }
      const graph = this.mergeLayout(
        buildProductionGraph(plan, 'storyboard', input.continuity),
        currentNodes,
      );
      events.push(
        this.event(
          'references',
          auto
            ? '开始生成角色与场景参考图'
            : input.continuity
              ? '已创建连续衔接节点，等待逐镜手动生成'
              : '等待手动生成角色与场景参考图',
        ),
      );
      const updated = await this.prisma.productionProject.update({
        where: { id },
        data: {
          plan: JSON.stringify(plan),
          nodes: JSON.stringify(graph.nodes),
          edges: JSON.stringify(graph.edges),
          mediaMode: input.mediaMode,
          status: auto ? 'references_running' : 'references_ready',
          events: JSON.stringify(events),
        },
      });
      await this.syncCanvas(graph.nodes, graph.edges);
      if (auto)
        this.schedule(id, [PRODUCTION_PHASE.character, PRODUCTION_PHASE.scene]);
      const result = this.serialize(updated);
      onEvent?.({ type: 'result', project: result });
      return result;
    }

    const nextStage = {
      requirements_review: 'script',
      script_review: 'characters',
      script_pending: 'script',
      characters_review: 'storyboard',
      characters_pending: 'characters',
      storyboard_review: 'imagePrompts',
      storyboard_pending: 'storyboard',
      image_prompts_review: 'videoPrompts',
      image_prompts_pending: 'imagePrompts',
      video_prompts_pending: 'videoPrompts',
    }[project.status];
    const statusStage =
      nextStage === 'imagePrompts'
        ? 'image_prompts'
        : nextStage === 'videoPrompts'
          ? 'video_prompts'
          : nextStage;
    onEvent?.({ type: 'start', projectId: id, stage: nextStage });
    events.push(
      this.event(
        nextStage,
        {
          script: '编剧 Agent 开始生成故事和场景剧本',
          characters: '角色设计师 Agent 开始生成角色设定',
          storyboard: '场景师和分镜师 Agent 开始生成分镜',
          imagePrompts: '分镜图提示词 Agent 开始生成图片提示词',
          videoPrompts: '视频提示词 Agent 开始生成拍摄提示词',
        }[nextStage],
      ),
    );
    await this.prisma.productionProject.update({
      where: { id },
      data: {
        plan: JSON.stringify(plan),
        status: `${statusStage}_pending`,
        events: JSON.stringify(events),
      },
    });
    try {
      const onChunk = (data: unknown) =>
        onEvent?.({ type: 'chunk', projectId: id, stage: nextStage, data });
      const nextPlan = await (async () => {
        if (nextStage === 'script') {
          const brief = project.requirements
            ? JSON.parse(project.requirements).brief
            : project.idea;
          return {
            ...(await this.planner.script(brief, project.modelId, onChunk)),
            characters: [],
          };
        }
        if (nextStage === 'characters')
          return {
            ...plan,
            characters: await this.planner.characters(
              plan,
              project.modelId,
              onChunk,
            ),
          };
        if (nextStage === 'storyboard')
          return this.planner.storyboard(plan, project.modelId, onChunk);
        if (nextStage === 'imagePrompts')
          return this.planner.imagePrompts(plan, project.modelId, onChunk);
        return this.planner.videoPrompts(plan, project.modelId, onChunk);
      })();
      const graph = this.mergeLayout(
        buildProductionGraph(
          nextPlan,
          nextStage === 'script' ||
            nextStage === 'characters' ||
            nextStage === 'storyboard'
            ? nextStage
            : 'storyboard',
        ),
        currentNodes,
      );
      events.push(this.event(nextStage, '阶段结果已生成，等待用户确认'));
      const updated = await this.prisma.productionProject.update({
        where: { id },
        data: {
          plan: JSON.stringify(nextPlan),
          nodes: JSON.stringify(graph.nodes),
          edges: JSON.stringify(graph.edges),
          status: `${statusStage}_review`,
          events: JSON.stringify(events),
        },
      });
      await this.syncCanvas(graph.nodes, graph.edges);
      const result = this.serialize(updated);
      onEvent?.({ type: 'result', project: result });
      return result;
    } catch (error) {
      events.push(
        this.event(
          nextStage,
          `执行失败：${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      await this.prisma.productionProject.update({
        where: { id },
        data: { status: project.status, events: JSON.stringify(events) },
      });
      throw error;
    }
  }

  async startMediaPhase(id: string, input: StartMediaPhaseDto) {
    const project = await this.find(id);
    if (project.status !== `${input.phase}_ready`)
      throw new BadRequestException('当前阶段不能手动执行');
    const phases = this.phaseList(input.phase);
    const updated = await this.prisma.productionProject.update({
      where: { id },
      data: { status: `${input.phase}_running` },
    });
    await this.appendEvent(
      id,
      input.phase,
      `手动启动${input.phase === 'references' ? '角色与场景参考图' : input.phase === 'storyboards' ? '分镜图' : '视频'}阶段`,
    );
    this.schedule(id, phases);
    return this.serialize(updated);
  }

  async reviseStage(
    id: string,
    input: ReviseStageDto,
    onEvent?: (event: ProductionStreamEvent) => void,
  ) {
    const project = await this.find(id);
    const statusStage =
      input.stage === 'imagePrompts'
        ? 'image_prompts'
        : input.stage === 'videoPrompts'
          ? 'video_prompts'
          : input.stage;
    const allowed =
      input.stage === 'requirements'
        ? ['requirements_clarifying', 'requirements_review']
        : [`${statusStage}_review`];
    if (!allowed.includes(project.status)) {
      throw new BadRequestException('当前阶段不能修改');
    }
    const currentNodes = input.nodes as ProductionNode[];
    const plan = this.mergePlanWithCanvas(
      JSON.parse(project.plan),
      currentNodes,
    );
    const events = this.parseEvents(project.events);
    const displayFeedback =
      input.stage === 'requirements' &&
      input.feedback.startsWith('我授权你根据已知需求自动补充')
        ? '让 Agent 帮我补充'
        : input.feedback;
    events.push(this.event(input.stage, `用户修改意见：${displayFeedback}`));
    events.push(this.event(input.stage, 'Agent 正在根据修改意见重新生成'));
    await this.prisma.productionProject.update({
      where: { id },
      data: {
        status: `${statusStage}_pending`,
        events: JSON.stringify(events),
      },
    });
    onEvent?.({ type: 'start', projectId: id, stage: input.stage });
    try {
      const onChunk = (data: unknown) =>
        onEvent?.({ type: 'chunk', projectId: id, stage: input.stage, data });
      if (input.stage === 'requirements') {
        const previous = project.requirements
          ? JSON.parse(project.requirements)
          : null;
        const requirements = await this.planner.requirements(
          `原始需求：${project.idea}\n已有需求摘要：${previous?.brief ?? '无'}\n用户补充：${input.feedback}`,
          project.modelId,
          onChunk,
        );
        events.push(
          this.event(
            'requirements',
            requirements.status === 'questions'
              ? '仍需补充关键需求'
              : '需求摘要已更新，等待用户确认',
          ),
        );
        const updated = await this.prisma.productionProject.update({
          where: { id },
          data: {
            requirements: JSON.stringify(requirements),
            status:
              requirements.status === 'questions'
                ? 'requirements_clarifying'
                : 'requirements_review',
            events: JSON.stringify(events),
          },
        });
        const result = this.serialize(updated);
        onEvent?.({ type: 'result', project: result });
        return result;
      }
      const nextPlan =
        input.stage === 'script'
          ? {
              ...(await this.planner.script(
                `原始创意：${project.idea}\n当前剧本：${JSON.stringify(plan)}\n用户修改意见：${input.feedback}\n保留未要求修改的场景 ID。`,
                project.modelId,
                (data) =>
                  onEvent?.({
                    type: 'chunk',
                    projectId: id,
                    stage: input.stage,
                    data,
                  }),
              )),
              characters: [],
            }
          : input.stage === 'characters'
            ? {
                ...plan,
                characters: await this.planner.characters(
                  { ...plan, revisionFeedback: input.feedback },
                  project.modelId,
                  (data) =>
                    onEvent?.({
                      type: 'chunk',
                      projectId: id,
                      stage: input.stage,
                      data,
                    }),
                ),
              }
            : input.stage === 'storyboard'
              ? await this.planner.storyboard(
                  { ...plan, revisionFeedback: input.feedback },
                  project.modelId,
                  onChunk,
                )
              : input.stage === 'imagePrompts'
                ? await this.planner.imagePrompts(
                    { ...plan, revisionFeedback: input.feedback },
                    project.modelId,
                    onChunk,
                  )
                : await this.planner.videoPrompts(
                    { ...plan, revisionFeedback: input.feedback },
                    project.modelId,
                    onChunk,
                  );
      const graph = this.mergeLayout(
        buildProductionGraph(
          nextPlan,
          ['script', 'characters', 'storyboard'].includes(input.stage)
            ? input.stage
            : 'storyboard',
        ),
        currentNodes,
      );
      events.push(this.event(input.stage, '修改结果已生成，等待用户再次确认'));
      const updated = await this.prisma.productionProject.update({
        where: { id },
        data: {
          plan: JSON.stringify(nextPlan),
          nodes: JSON.stringify(graph.nodes),
          edges: JSON.stringify(graph.edges),
          status: `${statusStage}_review`,
          events: JSON.stringify(events),
          error: null,
        },
      });
      await this.syncCanvas(graph.nodes, graph.edges);
      const result = this.serialize(updated);
      onEvent?.({ type: 'result', project: result });
      return result;
    } catch (error) {
      events.push(
        this.event(
          input.stage,
          `修改失败：${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      await this.prisma.productionProject.update({
        where: { id },
        data: { status: project.status, events: JSON.stringify(events) },
      });
      throw error;
    }
  }

  async confirm(id: string, input: ConfirmProductionDto) {
    const project = await this.find(id);
    if (
      ![
        'media_ready',
        'media_paused',
        'media_completed',
        'completed_with_errors',
        'references_ready',
        'references_paused',
        'storyboards_ready',
        'storyboards_paused',
        'videos_ready',
        'videos_paused',
      ].includes(project.status)
    ) {
      throw new BadRequestException('请先完成并确认剧本、角色和分镜');
    }
    if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
      throw new BadRequestException('画布数据无效');
    }
    const nodes = input.nodes.map((node) => ({
      ...node,
      data: { ...node.data },
    })) as ProductionNode[];
    nodes.forEach((node) => {
      if (!this.isMediaNode(node)) return;
      const sourceHash = this.sourceHash(node.id, nodes, input.edges);
      if (
        node.data.status === ChunkStatus.SUCCESS &&
        node.data.production?.sourceHash &&
        node.data.production.sourceHash !== sourceHash
      ) {
        node.data.production.stale = true;
        delete node.data.status;
        delete node.data.production.taskId;
      } else if (node.data.status !== ChunkStatus.SUCCESS) {
        delete node.data.status;
        delete node.data.error;
      }
    });
    const stage = this.mediaStage(project.status);
    const updated = await this.prisma.productionProject.update({
      where: { id: project.id },
      data: {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(input.edges),
        status: stage ? `${stage}_running` : 'media_running',
        error: null,
      },
    });
    await this.syncCanvas(nodes, input.edges);
    if (stage) this.schedule(id, this.phaseList(stage));
    else this.schedule(id);
    return this.serialize(updated);
  }

  async pause(id: string) {
    const current = await this.find(id);
    const stage = this.mediaStage(current.status);
    if (!stage || !current.status.endsWith('_running'))
      throw new BadRequestException('当前没有可暂停的媒体任务');
    const project = await this.prisma.productionProject.update({
      where: { id },
      data: { status: `${stage}_paused` },
    });
    return this.serialize(project);
  }

  async retry(
    id: string,
    nodeId: string,
    input: RetryProductionNodeDto = {},
  ) {
    const project = await this.find(id);
    if (
      !this.mediaStage(project.status) &&
      !project.status.startsWith('media_') &&
      project.status !== 'completed_with_errors'
    ) {
      throw new BadRequestException('当前阶段不能重试媒体任务');
    }
    const nodes = this.parseNodes(project.nodes);
    const node = nodes.find((item) => item.id === nodeId);
    if (!node || !this.isMediaNode(node))
      throw new NotFoundException('生成节点不存在');
    await this.appendEvent(
      id,
      this.mediaStage(project.status) ?? 'media',
      `开始生成：${node.data.title ?? node.id}`,
    );
    const stage =
      node.data.production.kind === PRODUCTION_PHASE.video
        ? 'videos'
        : node.data.production.kind === PRODUCTION_PHASE.storyboard
          ? 'storyboards'
          : 'references';
    delete node.data.status;
    delete node.data.error;
    delete node.data.url;
    if (node.data.production) {
      delete node.data.production.taskId;
      delete node.data.production.lastFrameUrl;
      delete node.data.production.continuityError;
    }
    const edges = this.parseEdges(project.edges).filter(
      (edge) =>
        !input.independent ||
        edge.target !== nodeId ||
        edge.data?.kind !== 'continuity',
    );
    if (input.independent) delete node.data.production.continuity;
    const updated = await this.prisma.productionProject.update({
      where: { id },
      data: {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        status: `${stage}_running`,
        error: null,
      },
    });
    await this.syncCanvas(nodes, edges);
    this.schedule(id, [node.data.production.kind], nodeId);
    return this.serialize(updated);
  }

  private async find(id: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id },
    });
    if (!project) throw new NotFoundException('制作项目不存在');
    return project;
  }

  private serialize(project: any) {
    return {
      ...project,
      plan: JSON.parse(project.plan),
      requirements: project.requirements
        ? JSON.parse(project.requirements)
        : null,
      events: this.parseEvents(project.events),
      nodes: this.parseNodes(project.nodes),
      edges: this.parseEdges(project.edges),
    };
  }

  private parseNodes(value: string): ProductionNode[] {
    return JSON.parse(value);
  }

  private parseEdges(value: string) {
    return JSON.parse(value) as Record<string, any>[];
  }

  private parseEvents(value?: string) {
    return value ? JSON.parse(value) : [];
  }

  private event(stage: string, message: string) {
    return {
      id: randomUUID(),
      stage,
      message,
      createdAt: new Date().toISOString(),
    };
  }

  private async appendEvent(id: string, stage: string, message: string) {
    const project = await this.find(id);
    const events = [
      ...this.parseEvents(project.events),
      this.event(stage, message),
    ];
    await this.prisma.productionProject.update({
      where: { id },
      data: { events: JSON.stringify(events) },
    });
  }

  private mergePlanWithCanvas(plan: any, nodes: ProductionNode[]) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return {
      ...plan,
      characters: (plan.characters ?? []).map((character: any) => ({
        ...character,
        name: byId.get(`subject-${character.id}`)?.data.name ?? character.name,
        description:
          byId.get(`subject-${character.id}`)?.data.description ??
          character.description,
      })),
      scenes: (plan.scenes ?? []).map((scene: any) => ({
        ...scene,
        script: byId.get(`text-${scene.id}`)?.data.text ?? scene.script,
      })),
    };
  }

  private mergeLayout(
    graph: { nodes: ProductionNode[]; edges: any[] },
    currentNodes: ProductionNode[],
  ) {
    const current = new Map(currentNodes.map((node) => [node.id, node]));
    const addsTurnarounds =
      graph.nodes.some((node) => node.id.endsWith('-turnaround')) &&
      !currentNodes.some((node) => node.id.endsWith('-turnaround'));
    return {
      ...graph,
      nodes: graph.nodes.map((node) => {
        const existing = current.get(node.id);
        if (!existing) return node;
        const useMigratedPosition =
          addsTurnarounds &&
          existing.position.x >= 1120 &&
          existing.position.x === node.position.x - 360;
        const prompt = node.data.production?.prompt;
        const data =
          node.type === 'shotTableNode'
            ? node.data
            : prompt
              ? {
                  ...existing.data,
                  draftText: prompt,
                  production: {
                    ...existing.data.production,
                    ...node.data.production,
                    prompt,
                  },
                }
              : existing.data;
        return {
          ...node,
          position: useMigratedPosition ? node.position : existing.position,
          data,
        };
      }),
    };
  }

  private schedule(
    id: string,
    phases: string[] = ACTIVE_PHASES,
    targetNodeId?: string,
  ) {
    if (this.active.has(id)) return;
    this.active.add(id);
    setImmediate(() => {
      void this.run(id, phases, targetNodeId).finally(() =>
        this.active.delete(id),
      );
    });
  }

  private mediaStage(status: string) {
    return ['references', 'storyboards', 'videos'].find((stage) =>
      status.startsWith(`${stage}_`),
    );
  }

  private phaseList(stage: string) {
    return stage === 'references'
      ? [PRODUCTION_PHASE.character, PRODUCTION_PHASE.scene]
      : stage === 'storyboards'
        ? [PRODUCTION_PHASE.storyboard]
        : [PRODUCTION_PHASE.video];
  }

  private async run(id: string, phases: string[], targetNodeId?: string) {
    const initial = await this.find(id);
    const stage =
      this.mediaStage(initial.status) ??
      (phases.includes(PRODUCTION_PHASE.video)
        ? 'videos'
        : phases.includes(PRODUCTION_PHASE.storyboard)
          ? 'storyboards'
          : 'references');
    const running =
      initial.status === 'media_running' ? 'media_running' : `${stage}_running`;
    try {
      for (const phase of phases) {
        let project = await this.find(id);
        if (project.status !== running) return;
        const nodeIds = this.parseNodes(project.nodes)
          .filter(
            (node) =>
              node.data.production?.kind === phase &&
              (!targetNodeId || node.id === targetNodeId),
          )
          .map((node) => node.id);
        for (const nodeId of nodeIds) {
          project = await this.find(id);
          if (project.status !== running) return;
          const node = this.parseNodes(project.nodes).find(
            (item) => item.id === nodeId,
          );
          if (!node || node.data.status === ChunkStatus.SUCCESS) continue;
          if (!this.dependenciesReady(node, project.nodes, project.edges)) {
            await this.failNode(
              id,
              nodeId,
              node.data.production?.continuity
                ? '请先成功生成上一镜，或选择使用本分镜图独立生成'
                : '上游内容尚未生成成功',
            );
            continue;
          }
          try {
            if (phase === PRODUCTION_PHASE.video)
              await this.generateVideo(id, nodeId);
            else await this.generateImage(id, nodeId);
          } catch (error) {
            await this.failNode(
              id,
              nodeId,
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      }
      const project = await this.find(id);
      if (project.status !== running) return;
      const failed = this.parseNodes(project.nodes).some(
        (node) =>
          this.isMediaNode(node) && node.data.status === ChunkStatus.FAILED,
      );
      await this.prisma.productionProject.update({
        where: { id },
        data: { status: `${stage}_review` },
      });
      await this.appendEvent(
        id,
        stage,
        failed
          ? '当前媒体批次已结束，存在失败项，等待用户处理'
          : '当前媒体批次已生成，等待用户确认',
      );
    } catch (error) {
      await this.prisma.productionProject
        .update({
          where: { id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          },
        })
        .catch(() => undefined);
    }
  }

  private dependenciesReady(
    node: ProductionNode,
    rawNodes: string,
    rawEdges: string,
  ) {
    const nodes = this.parseNodes(rawNodes);
    const edges = this.parseEdges(rawEdges);
    return edges
      .filter((edge) => edge.target === node.id)
      .map((edge) => nodes.find((item) => item.id === edge.source))
      .filter((source) => source && this.isMediaNode(source))
      .every(
        (source) =>
          source.data.status === ChunkStatus.SUCCESS && source.data.url,
      );
  }

  private async generateImage(id: string, nodeId: string) {
    await this.patchNode(id, nodeId, {
      status: ChunkStatus.PROCESSING,
      error: null,
    });
    const project = await this.find(id);
    const nodes = this.parseNodes(project.nodes);
    const node = nodes.find((item) => item.id === nodeId);
    const incoming = this.parseEdges(project.edges)
      .filter((edge) => edge.target === nodeId)
      .map((edge) => nodes.find((item) => item.id === edge.source))
      .filter(Boolean) as ProductionNode[];
    const references = incoming.filter(
      (item) => this.isMediaNode(item) && item.data.url,
    );
    const context = incoming
      .flatMap((item) => {
        if (item.type === 'textNode') return [item.data.text];
        if (item.type === 'subjectNode')
          return [`${item.data.name}：${item.data.description}`];
        return [];
      })
      .filter(Boolean);
    const plan = JSON.parse(project.plan);
    const prompt = [
      node.data.draftText || node.data.production.prompt,
      ...context,
      `整体视觉风格：${plan.visualStyle}`,
      '保持所有参考角色外貌、年龄、服装和场景风格一致。',
    ].join('\n');
    const runtimeModel = await this.models.runtime(undefined, 'image');
    const result = await genImage({
      runtimeModel,
      message: [
        { type: 'text', text: prompt },
        ...references.map((item) => ({
          type: 'image_url',
          image_url: item.data.url,
        })),
      ] as any,
      textList: [],
      config: {
        ratio: node.data.config?.ratio || plan.ratio,
        count: 1,
        edit: references.length > 0,
      },
    });
    const image = result.content[0]?.image;
    if (!image) throw new Error('图片生成接口未返回结果');
    const url = image.startsWith('data:image/')
      ? await this.images.upload(image)
      : image;
    await this.patchNode(id, nodeId, {
      url,
      status: ChunkStatus.SUCCESS,
      error: null,
    });
    await this.patchProduction(id, nodeId, {
      sourceHash: this.sourceHash(
        nodeId,
        nodes,
        this.parseEdges(project.edges),
      ),
      stale: false,
    });
    await this.appendEvent(
      id,
      'media',
      `已完成：${node.data.title ?? node.id}`,
    );
  }

  private async generateVideo(id: string, nodeId: string) {
    let project = await this.find(id);
    const nodes = this.parseNodes(project.nodes);
    const node = nodes.find((item) => item.id === nodeId);
    const edges = this.parseEdges(project.edges);
    const firstFrame = edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => nodes.find((item) => item.id === edge.source))
      .find(
        (item) =>
          item?.type === 'imageNode' &&
          item.data.status === ChunkStatus.SUCCESS,
      );
    if (!firstFrame) throw new Error('缺少已完成的分镜图');
    const continuity = node.data.production.continuity;
    const previousVideo = continuity?.previousVideoId
      ? nodes.find((item) => item.id === continuity.previousVideoId)
      : undefined;
    if (
      continuity &&
      (!previousVideo ||
        previousVideo.data.status !== ChunkStatus.SUCCESS ||
        !previousVideo.data.url)
    )
      throw new Error('请先成功生成上一镜，或选择使用本分镜图独立生成');
    if (continuity && !previousVideo.data.production?.lastFrameUrl)
      throw new Error(
        previousVideo.data.production?.continuityError ||
          '上一镜尾帧尚未准备好，请重试或选择独立生成',
      );
    const firstFrameUrl = continuity
      ? previousVideo.data.production.lastFrameUrl
      : firstFrame.data.url;
    const lastFrameUrl = continuity
      ? undefined
      : node.data.config?.lastFrameUrl;
    const prompt = [
      node.data.draftText || node.data.production.prompt,
      continuity?.prompt,
      node.data.production.outgoingContinuity?.prompt,
    ]
      .filter(Boolean)
      .join('\n\n');
    const runtimeModel = await this.models.runtime(undefined, 'video');
    let taskId = node.data.production.taskId as string | undefined;
    await this.appendEvent(
      id,
      'media',
      `开始生成：${node.data.title ?? node.id}`,
    );
    await this.patchNode(id, nodeId, {
      status: ChunkStatus.PROCESSING,
      error: null,
      config: { ...node.data.config, firstFrameUrl, lastFrameUrl },
    });
    if (!taskId) {
      const task = await genVideo({
        runtimeModel,
        message: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        textList: [],
        config: {
          ...node.data.config,
          firstFrameUrl,
          lastFrameUrl,
          promptExtend: !(continuity || node.data.production.outgoingContinuity),
          videoMode: 'imageToVideo',
        },
      });
      taskId = task.task_id;
      await this.patchProduction(id, nodeId, { taskId });
    }
    while (true) {
      project = await this.find(id);
      if (
        project.status !== 'videos_running' &&
        project.status !== 'media_running'
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      const { output } = await queryVideoTask(taskId, runtimeModel);
      if (output?.task_status === 'SUCCEEDED') {
        await this.patchNode(id, nodeId, {
          url: output.video_url,
          status: ChunkStatus.SUCCESS,
          error: null,
        });
        await this.patchProduction(id, nodeId, {
          sourceHash: this.sourceHash(
            nodeId,
            nodes,
            this.parseEdges(project.edges),
          ),
          stale: false,
        });
        if (
          edges.some(
            (edge) =>
              edge.source === nodeId && edge.data?.kind === 'continuity',
          )
        ) {
          try {
            const lastFrameUrl = await this.images.extractLastFrame(
              output.video_url,
            );
            await this.patchProduction(id, nodeId, { lastFrameUrl });
          } catch (error) {
            const continuityError = `尾帧提取失败：${error instanceof Error ? error.message : String(error)}`;
            await this.patchProduction(id, nodeId, { continuityError });
            await this.appendEvent(id, 'media', continuityError);
          }
        }
        await this.appendEvent(
          id,
          'media',
          `已完成：${node.data.title ?? node.id}`,
        );
        return;
      }
      if (output?.task_status === 'FAILED') {
        throw new Error(output.message || '视频生成任务失败');
      }
    }
  }

  private async failNode(id: string, nodeId: string, error: string) {
    await this.patchNode(id, nodeId, { status: ChunkStatus.FAILED, error });
    await this.appendEvent(id, 'media', `生成失败：${error}`);
  }

  private async patchProduction(
    id: string,
    nodeId: string,
    production: Record<string, any>,
  ) {
    const project = await this.find(id);
    const nodes = this.parseNodes(project.nodes);
    const node = nodes.find((item) => item.id === nodeId);
    node.data.production = { ...node.data.production, ...production };
    await this.saveGraph(id, nodes, this.parseEdges(project.edges));
  }

  private async patchNode(
    id: string,
    nodeId: string,
    data: Record<string, any>,
  ) {
    const project = await this.find(id);
    const nodes = this.parseNodes(project.nodes);
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) throw new NotFoundException('生成节点不存在');
    node.data = { ...node.data, ...data };
    if (data.error === null) delete node.data.error;
    await this.saveGraph(id, nodes, this.parseEdges(project.edges));
  }

  private async saveGraph(
    id: string,
    nodes: ProductionNode[],
    edges: Record<string, any>[],
  ) {
    await this.prisma.productionProject.update({
      where: { id },
      data: { nodes: JSON.stringify(nodes), edges: JSON.stringify(edges) },
    });
    await this.syncCanvas(nodes, edges);
  }

  private async syncCanvas(nodes: any[], edges: any[]) {
    const values = {
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
    };
    await this.prisma.canvasState.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...values },
      update: values,
    });
  }

  private sourceHash(
    nodeId: string,
    nodes: ProductionNode[],
    edges: Record<string, any>[],
    seen = new Set<string>(),
  ): string {
    if (seen.has(nodeId)) return '';
    seen.add(nodeId);
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return '';
    const incoming = edges
      .filter((edge) => edge.target === nodeId)
      .sort((left, right) => left.source.localeCompare(right.source))
      .map((edge) => {
        const source = nodes.find((item) => item.id === edge.source);
        const continuationFrame = edge.data?.kind === 'continuity'
          ? source?.data.production?.lastFrameUrl
          : undefined;
        return `${this.sourceHash(edge.source, nodes, edges, new Set(seen))}:${continuationFrame ?? ''}`;
      });
    const config = { ...node.data.config };
    delete config.firstFrameUrl;
    delete config.lastFrameUrl;
    return JSON.stringify({
      text: node.data.text,
      name: node.data.name,
      description: node.data.description,
      prompt: node.data.draftText || node.data.production?.prompt,
      config,
      incoming,
    });
  }

  private isMediaNode(node: ProductionNode) {
    return node.type === 'imageNode' || node.type === 'videoNode';
  }
}
