import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type CanvasSnapshot = {
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
    const nodes = JSON.parse(state.nodes) as { type?: string; data?: { url?: string } }[];
    const preview = [...nodes].reverse().find((node) =>
      (node.type === 'imageNode' || node.type === 'videoNode') && node.data?.url,
    );
    return {
      id: state.id,
      title: state.title,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      previewUrl: preview?.data?.url,
      previewType: preview?.type === 'videoNode' ? 'video' : preview ? 'image' : undefined,
      nodeCount: nodes.length,
    };
  }

  async list() {
    const states = await this.prisma.canvasState.findMany({ orderBy: { updatedAt: 'desc' } });
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
    return {
      nodes: JSON.parse(state.nodes),
      edges: JSON.parse(state.edges),
      past: JSON.parse(state.past),
      future: JSON.parse(state.future),
    };
  }

  async save(id: string, body: CanvasSnapshot) {
    if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      throw new BadRequestException('Invalid canvas snapshot');
    }
    const values = {
      nodes: JSON.stringify(body.nodes),
      edges: JSON.stringify(body.edges),
      past: JSON.stringify((body.past ?? []).slice(-50)),
      future: JSON.stringify((body.future ?? []).slice(-50)),
    };
    await this.prisma.canvasState.upsert({
      where: { id },
      create: { id, ...values },
      update: values,
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
