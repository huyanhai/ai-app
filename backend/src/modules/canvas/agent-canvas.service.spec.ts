import { BadRequestException, ConflictException } from '@nestjs/common';
import { AgentCanvasService } from './agent-canvas.service';

const textNode = {
  id: 'text-1',
  type: 'textNode',
  position: { x: 0, y: 0 },
  data: { title: '剧本', text: '第一场' },
  selected: true,
  measured: { width: 300, height: 200 },
};

const makePrisma = (
  initial = {
    id: 'canvas-1',
    nodes: JSON.stringify([textNode]),
    edges: '[]',
    past: '[]',
    future: '[]',
    viewport: JSON.stringify({ x: 10, y: 20, zoom: 0.8 }),
    revision: 3,
  },
) => {
  const state = { ...initial };
  const transaction = {
    canvasState: {
      findUnique: jest.fn(async () => ({ ...state })),
      updateMany: jest.fn(async ({ where, data }) => {
        if (where.revision !== state.revision) return { count: 0 };
        Object.assign(state, {
          nodes: data.nodes,
          edges: data.edges,
          past: data.past,
          future: data.future,
          revision: state.revision + data.revision.increment,
        });
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    canvasState: transaction.canvasState,
    $transaction: jest.fn((callback) => callback(transaction)),
  };
  return { prisma, state, transaction };
};

describe('AgentCanvasService', () => {
  it('returns a serializable canvas state with stable node ids and revision', async () => {
    const { prisma } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    await expect(service.getState('canvas-1')).resolves.toEqual({
      canvasId: 'canvas-1',
      revision: 3,
      viewport: { x: 10, y: 20, zoom: 0.8 },
      selectedNodeIds: ['text-1'],
      nodes: [
        {
          id: 'text-1',
          type: 'textNode',
          position: { x: 0, y: 0 },
          data: { title: '剧本', text: '第一场' },
        },
      ],
      edges: [],
    });
  });

  it('applies a batch atomically and records one undo snapshot per run', async () => {
    const { prisma, state, transaction } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    const first = await service.applyOps('canvas-1', 'run-1', [
      {
        action: 'create_node',
        node: {
          id: 'image-1',
          type: 'imageNode',
          position: { x: 420, y: 0 },
          data: { title: '首帧', draftText: '雪夜中的白熊' },
        },
      },
      { action: 'connect', source: 'text-1', target: 'image-1' },
      {
        action: 'update_node',
        id: 'text-1',
        data: { text: '第一场：吞币风波' },
      },
    ]);
    const second = await service.applyOps('canvas-1', 'run-1', [
      { action: 'update_node', id: 'image-1', position: { x: 460, y: 20 } },
    ]);

    expect(first).toEqual({ success: true, revision: 4, changed: 3 });
    expect(second).toEqual({ success: true, revision: 5, changed: 1 });
    expect(JSON.parse(state.nodes)).toEqual([
      expect.objectContaining({
        id: 'text-1',
        data: expect.objectContaining({ text: '第一场：吞币风波' }),
      }),
      expect.objectContaining({ id: 'image-1', position: { x: 460, y: 20 } }),
    ]);
    expect(JSON.parse(state.edges)).toEqual([
      expect.objectContaining({
        source: 'text-1',
        target: 'image-1',
        sourceHandle: 'source-anchor',
        targetHandle: 'target-anchor',
      }),
    ]);
    const past = JSON.parse(state.past);
    expect(past).toHaveLength(1);
    expect(past[0]).toEqual(expect.objectContaining({ agentRunId: 'run-1' }));
    expect(past[0].nodes[0]).not.toHaveProperty('measured');
    expect(JSON.parse(state.future)).toEqual([]);
    expect(transaction.canvasState.updateMany).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid batch without partially writing earlier operations', async () => {
    const { prisma, state, transaction } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    await expect(
      service.applyOps('canvas-1', 'run-1', [
        {
          action: 'create_node',
          node: { id: 'video-1', type: 'videoNode', data: {} },
        },
        { action: 'connect', source: 'video-1', target: 'missing' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.canvasState.updateMany).not.toHaveBeenCalled();
    expect(JSON.parse(state.nodes)).toEqual([textNode]);
  });

  it('deletes nodes with related edges and arranges only requested nodes', async () => {
    const initialNodes = [
      { ...textNode, selected: false },
      {
        id: 'image-1',
        type: 'imageNode',
        position: { x: 20, y: 30 },
        data: { url: '' },
      },
      {
        id: 'video-1',
        type: 'videoNode',
        position: { x: 900, y: 900 },
        data: { url: '' },
      },
    ];
    const { prisma, state } = makePrisma({
      id: 'canvas-1',
      nodes: JSON.stringify(initialNodes),
      edges: JSON.stringify([
        { id: 'edge-1', source: 'text-1', target: 'image-1' },
        { id: 'edge-2', source: 'image-1', target: 'video-1' },
      ]),
      past: '[]',
      future: '[]',
      viewport: null,
      revision: 0,
    });
    const service = new AgentCanvasService(prisma as any);

    await service.deleteNodes('canvas-1', 'run-delete', ['image-1']);
    expect(JSON.parse(state.nodes).map((node) => node.id)).toEqual([
      'text-1',
      'video-1',
    ]);
    expect(JSON.parse(state.edges)).toEqual([]);

    await service.arrange('canvas-1', 'run-layout', {
      mode: 'grid',
      nodeIds: ['text-1', 'video-1'],
      columns: 2,
    });
    const arranged = JSON.parse(state.nodes);
    expect(arranged[0].position).toEqual({ x: 0, y: 0 });
    expect(arranged[1].position).toEqual({ x: 360, y: 0 });
    expect(
      JSON.parse(state.past).map((snapshot) => snapshot.agentRunId),
    ).toEqual(['run-delete', 'run-layout']);
  });

  it('rejects a concurrent revision conflict', async () => {
    const { prisma, transaction } = makePrisma();
    transaction.canvasState.updateMany.mockResolvedValue({ count: 0 });
    const service = new AgentCanvasService(prisma as any);

    await expect(
      service.deleteNodes('canvas-1', 'run-1', ['text-1']),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
