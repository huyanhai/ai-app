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

  async get() {
    const state = await this.prisma.canvasState.findUnique({ where: { id: 'default' } });
    if (!state) return null;
    return {
      nodes: JSON.parse(state.nodes),
      edges: JSON.parse(state.edges),
      past: JSON.parse(state.past),
      future: JSON.parse(state.future),
    };
  }

  async save(body: CanvasSnapshot) {
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
      where: { id: 'default' },
      create: { id: 'default', ...values },
      update: values,
    });
    return { success: true };
  }

  generations() {
    return this.prisma.generationRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  createGeneration(body: GenerationInput) {
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
      },
    });
  }
}
