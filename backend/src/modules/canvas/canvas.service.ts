import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeAgentCanvas } from './agent-canvas.service';

export type CanvasSnapshot = {
  revision?: number;
  viewport?: { x: number; y: number; zoom: number };
  nodes: unknown[];
  edges: unknown[];
  past: { nodes: unknown[]; edges: unknown[] }[];
  future: { nodes: unknown[]; edges: unknown[] }[];
};

export type GenerationInput = {
  nodeId: string;
  nodeType: string;
  title: string;
  model?: string;
  url: string;
};

@Injectable()
export class CanvasService {
  constructor(private readonly prisma: PrismaService) {}

  private summary(state: {
    id: string;
    title: string;
    nodes: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const nodes = JSON.parse(state.nodes) as {
      id?: string;
      type?: string;
      data?: { url?: string; canvasCover?: boolean };
    }[];
    const cover = nodes.find(
      (node) =>
        node.type === 'imageNode' && node.data?.canvasCover && node.data?.url,
    );
    const preview =
      cover ??
      [...nodes]
        .reverse()
        .find(
          (node) =>
            (node.type === 'imageNode' || node.type === 'videoNode') &&
            node.data?.url,
        );
    return {
      id: state.id,
      title: state.title,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      previewUrl: preview?.data?.url,
      previewType:
        preview?.type === 'videoNode' ? 'video' : preview ? 'image' : undefined,
      nodeCount: nodes.length,
    };
  }

  async list() {
    const states = await this.prisma.canvasState.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return states.map((state) => this.summary(state));
  }

  async create(title?: string) {
    const state = await this.prisma.canvasState.create({
      data: {
        title: title?.trim() || '未命名画布',
        nodes: '[]',
        edges: '[]',
        past: '[]',
        future: '[]',
      },
    });
    return this.summary(state);
  }

  async get(id = 'default') {
    const state = await this.prisma.canvasState.findUnique({ where: { id } });
    if (!state) return null;
    const nodes = JSON.parse(state.nodes) as Parameters<typeof normalizeAgentCanvas>[0];
    const edges = JSON.parse(state.edges) as Parameters<typeof normalizeAgentCanvas>[1];
    const isAgentCanvas = nodes.some((node) => node.type === 'group');
    const graph = isAgentCanvas ? normalizeAgentCanvas(nodes, edges) : { nodes, edges };
    return {
      nodes: graph.nodes,
      edges: graph.edges,
      past: JSON.parse(state.past),
      future: JSON.parse(state.future),
      revision: state.revision ?? 0,
      viewport: state.viewport ? JSON.parse(state.viewport) : undefined,
    };
  }

  async save(id: string, body: CanvasSnapshot) {
    if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      throw new BadRequestException('Invalid canvas snapshot');
    }
    if (
      body.viewport &&
      ![body.viewport.x, body.viewport.y, body.viewport.zoom].every(
        Number.isFinite,
      )
    ) {
      throw new BadRequestException('Invalid canvas viewport');
    }
    const values = {
      nodes: JSON.stringify(body.nodes),
      edges: JSON.stringify(body.edges),
      past: JSON.stringify((body.past ?? []).slice(-50)),
      future: JSON.stringify((body.future ?? []).slice(-50)),
      ...(body.viewport ? { viewport: JSON.stringify(body.viewport) } : {}),
    };
    if (body.revision === undefined) {
      await this.prisma.canvasState.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      });
      return { success: true };
    }
    const updated = await this.prisma.canvasState.updateMany({
      where: { id, revision: body.revision },
      data: { ...values, revision: { increment: 1 } },
    });
    if (updated.count) return { success: true, revision: body.revision + 1 };
    const existing = await this.prisma.canvasState.findUnique({
      where: { id },
    });
    if (existing)
      throw new ConflictException('画布已在其他位置更新，请刷新后重试');
    await this.prisma.canvasState.create({ data: { id, ...values } });
    return { success: true, revision: 0 };
  }

  async saveViewport(
    id: string,
    viewport: { x: number; y: number; zoom: number },
  ) {
    if (![viewport.x, viewport.y, viewport.zoom].every(Number.isFinite)) {
      throw new BadRequestException('Invalid canvas viewport');
    }
    await this.prisma.canvasState.updateMany({
      where: { id },
      data: { viewport: JSON.stringify(viewport) },
    });
    return { success: true };
  }

  async rename(id: string, title: string) {
    const value = title?.trim();
    if (!value) throw new BadRequestException('画布名称不能为空');
    const state = await this.prisma.canvasState.update({
      where: { id },
      data: { title: value },
    });
    return this.summary(state);
  }

  async duplicate(id: string) {
    const state = await this.prisma.canvasState.findUnique({ where: { id } });
    if (!state) throw new NotFoundException('画布不存在');
    const [generations, productions, sessions] = await Promise.all([
      this.prisma.generationRecord.findMany({ where: { canvasId: id } }),
      this.prisma.productionProject.findMany({ where: { canvasId: id } }),
      this.prisma.agentSession.findMany({
        where: { canvasId: id },
        include: { messages: true },
      }),
    ]);

    return this.prisma.$transaction(async (transaction) => {
      const canvas = await transaction.canvasState.create({
        data: {
          title: `${state.title} 副本`,
          viewport: state.viewport,
          nodes: state.nodes,
          edges: state.edges,
          past: state.past,
          future: state.future,
        },
      });
      if (generations.length) {
        await transaction.generationRecord.createMany({
          data: generations.map(({ id: recordId, canvasId, ...record }) => ({
            ...record,
            canvasId: canvas.id,
          })),
        });
      }
      if (productions.length) {
        await transaction.productionProject.createMany({
          data: productions.map(({ id: projectId, canvasId, ...project }) => ({
            ...project,
            id: randomUUID(),
            canvasId: canvas.id,
          })),
        });
      }
      for (const session of sessions) {
        await transaction.agentSession.create({
          data: {
            id: randomUUID(),
            title: session.title,
            canvasId: canvas.id,
            createdAt: session.createdAt,
            messages: {
              create: session.messages.map(
                ({ id: messageId, sessionId, ...message }) => message,
              ),
            },
          },
        });
      }
      return this.summary(canvas);
    });
  }

  async remove(id: string) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.agentMessage.deleteMany({
        where: { session: { canvasId: id } },
      });
      await transaction.agentSession.deleteMany({ where: { canvasId: id } });
      await transaction.generationRecord.deleteMany({
        where: { canvasId: id },
      });
      await transaction.productionProject.deleteMany({
        where: { canvasId: id },
      });
      await transaction.canvasState.delete({ where: { id } });
    });
    return { success: true };
  }

  generations(canvasId = 'default') {
    return this.prisma.generationRecord.findMany({
      where: { canvasId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async allGenerations() {
    const [records, canvases] = await Promise.all([
      this.prisma.generationRecord.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.canvasState.findMany({
        select: { id: true, nodes: true },
      }),
    ]);
    const nodeTitles = new Map(
      canvases.map((canvas) => [
        canvas.id,
        new Map(
          (JSON.parse(canvas.nodes) as { id?: string; data?: { title?: string } }[])
            .filter((node) => node.id && node.data?.title)
            .map((node) => [node.id, node.data!.title!]),
        ),
      ]),
    );
    return records.map((record) => ({
      ...record,
      title: nodeTitles.get(record.canvasId)?.get(record.nodeId) || record.title,
    }));
  }

  async deleteGenerations(ids: string[]) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some((id) => typeof id !== 'string')) {
      throw new BadRequestException('请选择要删除的生成记录');
    }
    const uniqueIds = [...new Set(ids.map((id) => id.trim()))];
    if (uniqueIds.some((id) => !id)) {
      throw new BadRequestException('生成记录 ID 无效');
    }
    const result = await this.prisma.generationRecord.deleteMany({
      where: { id: { in: uniqueIds } },
    });
    return { success: true, deleted: result.count };
  }

  createGeneration(canvasId: string, body: GenerationInput) {
    if (!body.nodeId || !body.nodeType || !body.url) {
      throw new BadRequestException('Invalid generation record');
    }
    return this.prisma.generationRecord.create({
      data: {
        nodeId: body.nodeId,
        nodeType: body.nodeType,
        title: body.title || body.nodeId,
        model: body.model,
        url: body.url,
        canvasId,
      },
    });
  }
}
