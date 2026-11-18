import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const dataSchema = z
  .object({
    title: z.string().max(200).optional(),
    text: z.string().max(100_000).optional(),
    url: z.string().max(2_000_000).optional(),
    voiceUrl: z.string().max(2_000_000).optional(),
    name: z.string().max(200).optional(),
    description: z.string().max(20_000).optional(),
    status: z.string().max(100).optional(),
    error: z.string().max(20_000).optional(),
    draftText: z.string().max(100_000).optional(),
    draftState: z.string().max(200_000).optional(),
    bg: z.string().max(100).optional(),
    labelColor: z.string().max(100).optional(),
    canvasCover: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    production: z.record(z.string(), z.unknown()).optional(),
    shots: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  })
  .strict();

const nodeTypes = [
  'textNode',
  'imageNode',
  'videoNode',
  'audioNode',
  'timelineNode',
  'subjectNode',
  'cameraNode',
  'paletteNode',
  'styleNode',
  'movementNode',
  'stageNode',
  'shotTableNode',
  'group',
] as const;

const defaults: Record<string, {
  config?: Record<string, unknown>;
  [key: string]: unknown;
}> = {
  textNode: { text: '' },
  imageNode: { url: '', config: { ratio: '1:1', resolution: '2K', count: 1 } },
  videoNode: {
    url: '',
    config: {
      videoMode: 'textToVideo',
      ratio: '1:1',
      duration: 4,
      resolution: '720P',
      count: 1,
    },
  },
  audioNode: { url: '', config: {} },
  timelineNode: {},
  subjectNode: { name: '主体 1' },
  cameraNode: {},
  paletteNode: {},
  styleNode: {},
  movementNode: {},
  stageNode: {},
  shotTableNode: { shots: [] },
  group: {},
};

const labels: Record<string, string> = {
  textNode: '文本',
  imageNode: '图片',
  videoNode: '视频',
  audioNode: '音频',
  timelineNode: '时间线',
  subjectNode: '主体',
  cameraNode: '相机',
  paletteNode: '配色',
  styleNode: '风格',
  movementNode: '运镜',
  stageNode: '导演台',
  shotTableNode: '分镜表',
  group: '节点组',
};

const operationSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create_node'),
      node: z
        .object({
          id: z.string().min(1).max(100).optional(),
          type: z.enum(nodeTypes),
          position: positionSchema.optional(),
          parentId: z.string().min(1).max(100).optional(),
          width: z.number().positive().max(20_000).optional(),
          height: z.number().positive().max(20_000).optional(),
          zIndex: z.number().int().min(-10_000).max(10_000).optional(),
          data: dataSchema.default({}),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal('update_node'),
      id: z.string().min(1),
      position: positionSchema.optional(),
      data: dataSchema.optional(),
    })
    .strict()
    .refine(
      (value) => value.position || value.data,
      '更新节点需要 position 或 data',
    ),
  z
    .object({
      action: z.literal('delete_node'),
      id: z.string().min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal('connect'),
      id: z.string().min(1).max(100).optional(),
      source: z.string().min(1),
      target: z.string().min(1),
      sourceHandle: z.string().min(1).optional(),
      targetHandle: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('disconnect'),
      id: z.string().min(1),
    })
    .strict(),
]);

export const canvasOperationsSchema = z.array(operationSchema).min(1).max(100);
export const canvasArrangeSchema = z
  .object({
    mode: z.enum(['flow', 'row', 'column', 'grid']).default('flow'),
    nodeIds: z.array(z.string().min(1)).max(500).optional(),
    columns: z.number().int().min(1).max(20).optional(),
  })
  .strict();

type CanvasNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  selected?: boolean;
  [key: string]: any;
};

type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  [key: string]: any;
};

type StoredState = {
  nodes: string;
  edges: string;
  past: string;
  future: string;
  viewport: string | null;
  revision: number;
};

const parse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const snapshotNodes = (nodes: CanvasNode[]) =>
  nodes.map((node) => ({
    ...node,
    selected: undefined,
    dragging: undefined,
    measured: undefined,
  }));

export const normalizeAgentEdges = (nodes: CanvasNode[], edges: CanvasEdge[]) => {
  const scriptIds = new Set(nodes.filter((node) => node.type === 'textNode').map((node) => node.id));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const flowRank = (node?: CanvasNode) => {
    if (!node) return 0;
    const kind = node.data?.production?.kind;
    if (node.type === 'videoNode' || kind === 'video') return 3;
    if (
      kind === 'storyboard' ||
      kind === 'storyboardPreviz' ||
      String(node.data?.title || '').includes('分镜图')
    ) return 2;
    if (['imageNode', 'subjectNode', 'audioNode'].includes(node.type)) return 1;
    return 0;
  };
  return edges
    .filter((edge) => !scriptIds.has(edge.source) && !scriptIds.has(edge.target))
    .map((edge) => {
      const sourceRank = flowRank(nodeMap.get(edge.source));
      const targetRank = flowRank(nodeMap.get(edge.target));
      const reversed = targetRank > 0 && sourceRank > targetRank;
      return {
        ...edge,
        source: reversed ? edge.target : edge.source,
        target: reversed ? edge.source : edge.target,
        sourceHandle: 'source-anchor',
        targetHandle: 'target-anchor',
      };
    });
};

export const normalizeAgentCanvas = (nodes: CanvasNode[], edges: CanvasEdge[]) => {
  const storyboards = new Map<string, CanvasNode>();
  for (const node of nodes) {
    if (node.parentId && String(node.data?.title || '').includes('分镜图')) {
      storyboards.set(node.parentId, node);
    }
  }
  const normalizedNodes = nodes.map((node) => {
    const defaultConfig = defaults[node.type]?.config;
    return defaultConfig
      ? { ...node, data: { ...node.data, config: { ...defaultConfig, ...node.data?.config } } }
      : node;
  }).map((node) => {
    const storyboard = node.parentId ? storyboards.get(node.parentId) : undefined;
    const title = String(node.data?.title || '');
    const isVideoPrompt = node.type === 'textNode' && title.includes('视频提示词');
    const isGroupedVideo = node.type === 'videoNode' && title.includes('视频');
    if (!storyboard || (!isVideoPrompt && !isGroupedVideo)) return node;
    const storyboardTitle = String(storyboard.data?.title || '分镜图');
    const prompt = String(node.data?.draftText || node.data?.text || '');
    const promptWithoutFirstFramePrefix = prompt.replace(/^(?:参考首帧画面[^，,]*[，,]?\s*)+/, '');
    const nextPrompt = prompt
      ? `参考首帧画面${storyboardTitle}，${promptWithoutFirstFramePrefix}`
      : prompt;
    if (isVideoPrompt) {
      return {
        ...node,
        type: 'videoNode',
        data: {
          ...node.data,
          title: title.replace('视频提示词', '视频'),
          text: nextPrompt,
          draftText: nextPrompt,
          draftState: undefined,
          url: node.data?.url || '',
          config: {
            videoMode: 'imageToVideo',
            ratio: '1:1',
            duration: 4,
            resolution: '720P',
            count: 1,
            ...node.data?.config,
          },
        },
      };
    }
    if (nextPrompt === prompt) return node;
    return {
      ...node,
      data: { ...node.data, text: nextPrompt, draftText: nextPrompt, draftState: undefined },
    };
  });
  const normalizedEdges = normalizeAgentEdges(normalizedNodes, edges);
  for (const node of normalizedNodes) {
    if (node.type !== 'videoNode' || !node.parentId) continue;
    const storyboard = storyboards.get(node.parentId);
    if (!storyboard || normalizedEdges.some((edge) =>
      (edge.source === storyboard.id && edge.target === node.id) ||
      (edge.source === node.id && edge.target === storyboard.id),
    )) continue;
    normalizedEdges.push({
      id: `agent-shot-video-${storyboard.id}-${node.id}`,
      source: storyboard.id,
      target: node.id,
      sourceHandle: 'source-anchor',
      targetHandle: 'target-anchor',
    });
  }
  return { nodes: normalizedNodes, edges: normalizedEdges };
};

@Injectable()
export class AgentCanvasService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(canvasId: string, nodeIds: string[] = []) {
    const state = await this.prisma.canvasState.findUnique({
      where: { id: canvasId },
    });
    if (!state) {
      return {
        canvasId,
        revision: 0,
        nodes: [],
        edges: [],
        selectedNodeIds: [],
      };
    }
    const graph = normalizeAgentCanvas(
      parse<CanvasNode[]>(state.nodes, []),
      parse<CanvasEdge[]>(state.edges, []),
    );
    const allNodes = graph.nodes;
    const requested = new Set(nodeIds);
    const nodes = allNodes
      .filter((node) => !requested.size || requested.has(node.id))
      .map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        ...(node.parentId ? { parentId: node.parentId } : {}),
        ...(node.width ? { width: node.width } : {}),
        ...(node.height ? { height: node.height } : {}),
        ...(node.zIndex !== undefined ? { zIndex: node.zIndex } : {}),
        data: node.data,
      }));
    const visibleIds = new Set(nodes.map((node) => node.id));
    return {
      canvasId,
      revision: state.revision ?? 0,
      viewport: parse(state.viewport, undefined),
      nodes,
      edges: graph.edges.filter(
        (edge) =>
          !requested.size ||
          (visibleIds.has(edge.source) && visibleIds.has(edge.target)),
      ),
      selectedNodeIds: allNodes
        .filter((node) => node.selected)
        .map((node) => node.id),
    };
  }

  applyOps(
    canvasId: string,
    runId: string,
    input: unknown,
    expectedRevision?: number,
  ) {
    const operations = this.validate(canvasOperationsSchema, input);
    return this.mutate(
      canvasId,
      runId,
      (nodes, edges) => {
        for (const operation of operations) {
          if (operation.action === 'create_node') {
            const id = operation.node.id ?? randomUUID();
            if (nodes.some((node) => node.id === id))
              throw new BadRequestException(`节点已存在：${id}`);
            const type = operation.node.type;
            const count = nodes.filter((node) => node.type === type).length;
            nodes.push({
              id,
              type,
              position: operation.node.position ?? { x: 0, y: 0 },
              ...(operation.node.parentId ? { parentId: operation.node.parentId } : {}),
              ...(type === 'group' ? {
                width: operation.node.width ?? 1240,
                height: operation.node.height ?? 560,
                zIndex: operation.node.zIndex ?? -2000,
              } : {}),
              data: {
                ...structuredClone(defaults[type]),
                title: `${labels[type]} ${count + 1}`,
                ...operation.node.data,
                ...(defaults[type].config || operation.node.data.config ? {
                  config: {
                    ...defaults[type].config,
                    ...operation.node.data.config,
                  },
                } : {}),
              },
            });
          } else if (operation.action === 'update_node') {
            const node = this.requireNode(nodes, operation.id);
            if (operation.position) node.position = operation.position;
            if (operation.data) node.data = { ...node.data, ...operation.data };
          } else if (operation.action === 'delete_node') {
            this.requireNode(nodes, operation.id);
            nodes = nodes.filter((node) => node.id !== operation.id);
            edges = edges.filter(
              (edge) =>
                edge.source !== operation.id && edge.target !== operation.id,
            );
          } else if (operation.action === 'connect') {
            if (operation.source === operation.target)
              throw new BadRequestException('节点不能连接自身');
            this.requireNode(nodes, operation.source);
            this.requireNode(nodes, operation.target);
            if (
              edges.some(
                (edge) =>
                  edge.source === operation.source &&
                  edge.target === operation.target,
              )
            ) {
              throw new BadRequestException('这两个节点已经连接');
            }
            edges.push({
              id: operation.id ?? randomUUID(),
              source: operation.source,
              target: operation.target,
              sourceHandle: operation.sourceHandle ?? 'source-anchor',
              targetHandle: operation.targetHandle ?? 'target-anchor',
            });
          } else {
            const edge = edges.find((item) => item.id === operation.id);
            if (!edge)
              throw new BadRequestException(`连线不存在：${operation.id}`);
            edges = edges.filter((item) => item.id !== operation.id);
          }
        }
        return {
          nodes: [...nodes.filter((node) => node.type === 'group'), ...nodes.filter((node) => node.type !== 'group')],
          edges,
          changed: operations.length,
        };
      },
      expectedRevision,
    );
  }

  deleteNodes(
    canvasId: string,
    runId: string,
    nodeIds: string[],
    expectedRevision?: number,
  ) {
    if (!nodeIds.length) throw new BadRequestException('请选择要删除的节点');
    return this.mutate(
      canvasId,
      runId,
      (nodes, edges) => {
        const ids = new Set(nodeIds);
        for (const id of ids) this.requireNode(nodes, id);
        return {
          nodes: nodes.filter((node) => !ids.has(node.id)),
          edges: edges.filter(
            (edge) => !ids.has(edge.source) && !ids.has(edge.target),
          ),
          changed: ids.size,
        };
      },
      expectedRevision,
    );
  }

  arrange(
    canvasId: string,
    runId: string,
    input: unknown,
    expectedRevision?: number,
  ) {
    const options = this.validate(canvasArrangeSchema, input);
    return this.mutate(
      canvasId,
      runId,
      (nodes, edges) => {
        const ids = new Set(
          options.nodeIds?.length
            ? options.nodeIds
            : nodes.map((node) => node.id),
        );
        for (const id of ids) this.requireNode(nodes, id);
        const selected = nodes.filter((node) => ids.has(node.id));
        const positions = options.mode === 'grid'
          ? this.gridPositions(selected, options.columns)
          : options.mode === 'row' || options.mode === 'column'
            ? new Map(selected.map((node, index) => [node.id, {
              x: options.mode === 'row' ? index * 360 : 0,
              y: options.mode === 'column' ? index * 320 : 0,
            }]))
            : this.flowPositions(selected, edges);
        return {
          nodes: nodes.map((node) =>
            positions.has(node.id)
              ? { ...node, position: positions.get(node.id)! }
              : node,
          ),
          edges,
          changed: selected.length,
        };
      },
      expectedRevision,
    );
  }

  private async mutate(
    canvasId: string,
    runId: string,
    change: (
      nodes: CanvasNode[],
      edges: CanvasEdge[],
    ) => { nodes: CanvasNode[]; edges: CanvasEdge[]; changed: number },
    expectedRevision?: number,
  ) {
    if (!runId) throw new BadRequestException('缺少 Agent 运行 ID');
    return this.prisma.$transaction(async (transaction) => {
      let state = (await transaction.canvasState.findUnique({
        where: { id: canvasId },
      })) as StoredState | null;
      if (!state) {
        state = (await transaction.canvasState.create({
          data: {
            id: canvasId,
            nodes: '[]',
            edges: '[]',
            past: '[]',
            future: '[]',
          },
        })) as StoredState;
      }
      const graph = normalizeAgentCanvas(
        parse<CanvasNode[]>(state.nodes, []),
        parse<CanvasEdge[]>(state.edges, []),
      );
      const nodes = graph.nodes;
      const edges = graph.edges;
      const past = parse<Record<string, unknown>[]>(state.past, []);
      if (
        expectedRevision !== undefined &&
        past.at(-1)?.agentRunId !== runId &&
        (state.revision ?? 0) !== expectedRevision
      ) {
        throw new ConflictException(
          '画布在 Agent 运行期间已变化，请重新读取后重试',
        );
      }
      const result = change(structuredClone(nodes), structuredClone(edges));
      const resultGraph = normalizeAgentCanvas(result.nodes, result.edges);
      if (past.at(-1)?.agentRunId !== runId) {
        past.push({ nodes: snapshotNodes(nodes), edges, agentRunId: runId });
      }
      const revision = state.revision ?? 0;
      const updated = await transaction.canvasState.updateMany({
        where: { id: canvasId, revision },
        data: {
          nodes: JSON.stringify(resultGraph.nodes),
          edges: JSON.stringify(resultGraph.edges),
          past: JSON.stringify(past.slice(-50)),
          future: '[]',
          revision: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new ConflictException('画布已被其他操作修改，请重新读取后重试');
      return { success: true, revision: revision + 1, changed: result.changed };
    });
  }

  private requireNode(nodes: CanvasNode[], id: string) {
    const node = nodes.find((item) => item.id === id);
    if (!node) throw new BadRequestException(`节点不存在：${id}`);
    return node;
  }

  private validate<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues[0]?.message ?? '画布操作参数无效',
      );
    }
    return result.data;
  }

  private gridPositions(nodes: CanvasNode[], columns?: number) {
    const count = columns ?? Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    return new Map(
      nodes.map((node, index) => [
        node.id,
        {
          x: (index % count) * 360,
          y: Math.floor(index / count) * 320,
        },
      ]),
    );
  }

  private flowPositions(nodes: CanvasNode[], edges: CanvasEdge[]) {
    const ids = new Set(nodes.map((node) => node.id));
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
    for (const edge of edges) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
      outgoing.get(edge.source)?.push(edge.target);
    }
    let frontier = nodes
      .filter((node) => !incoming.get(node.id))
      .map((node) => node.id);
    if (!frontier.length) frontier = nodes.slice(0, 1).map((node) => node.id);
    const positions = new Map<string, { x: number; y: number }>();
    const visited = new Set<string>();
    let depth = 0;
    while (frontier.length) {
      frontier.forEach((id, index) => {
        if (visited.has(id)) return;
        visited.add(id);
        positions.set(id, { x: depth * 420, y: index * 320 });
      });
      const next = [
        ...new Set(frontier.flatMap((id) => outgoing.get(id) ?? [])),
      ].filter((id) => !visited.has(id));
      if (!next.length && visited.size < nodes.length) {
        next.push(
          ...nodes
            .filter((node) => !visited.has(node.id))
            .slice(0, 1)
            .map((node) => node.id),
        );
      }
      frontier = next;
      depth += 1;
    }
    return positions;
  }
}
