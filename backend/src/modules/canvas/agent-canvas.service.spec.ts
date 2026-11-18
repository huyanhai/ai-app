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
    expect(JSON.parse(state.edges)).toEqual([]);
    const past = JSON.parse(state.past);
    expect(past).toHaveLength(1);
    expect(past[0]).toEqual(expect.objectContaining({ agentRunId: 'run-1' }));
    expect(past[0].nodes[0]).not.toHaveProperty('measured');
    expect(JSON.parse(state.future)).toEqual([]);
    expect(transaction.canvasState.updateMany).toHaveBeenCalledTimes(2);
  });

  it('removes existing script edges during agent canvas mutations', async () => {
    const imageNode = {
      id: 'image-1',
      type: 'imageNode',
      position: { x: 420, y: 0 },
      data: { url: '' },
    };
    const { prisma, state } = makePrisma({
      id: 'canvas-1',
      nodes: JSON.stringify([textNode, imageNode]),
      edges: JSON.stringify([{ id: 'script-edge', source: 'text-1', target: 'image-1' }]),
      past: '[]',
      future: '[]',
      viewport: null,
      revision: 3,
    });
    const service = new AgentCanvasService(prisma as any);

    await service.applyOps('canvas-1', 'run-1', [
      { action: 'update_node', id: 'image-1', data: { title: '首帧' } },
    ]);

    expect(JSON.parse(state.edges)).toEqual([]);
  });

  it('normalizes reversed connections to upstream right and downstream left', async () => {
    const { prisma, state } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    await service.applyOps('canvas-1', 'run-direction', [
      { action: 'create_node', node: { id: 'asset', type: 'imageNode', data: { title: '角色三视图' } } },
      { action: 'create_node', node: { id: 'storyboard', type: 'imageNode', data: { title: '镜头 01 · 分镜图' } } },
      { action: 'create_node', node: { id: 'video', type: 'videoNode', data: { title: '镜头 01 · 视频' } } },
      { action: 'connect', source: 'storyboard', target: 'asset' },
      { action: 'connect', source: 'video', target: 'storyboard' },
    ]);

    expect(JSON.parse(state.edges)).toEqual([
      expect.objectContaining({
        source: 'asset', target: 'storyboard',
        sourceHandle: 'source-anchor', targetHandle: 'target-anchor',
      }),
      expect.objectContaining({
        source: 'storyboard', target: 'video',
        sourceHandle: 'source-anchor', targetHandle: 'target-anchor',
      }),
    ]);
  });

  it('reads legacy reversed storyboard references in the corrected direction', async () => {
    const asset = {
      id: 'asset', type: 'imageNode', position: { x: 0, y: 0 },
      data: { title: '角色三视图', url: '/character.png' },
    };
    const storyboard = {
      id: 'storyboard', type: 'imageNode', position: { x: 400, y: 0 },
      data: { title: '镜头 01 · 分镜图', url: '' },
    };
    const { prisma } = makePrisma({
      id: 'canvas-1',
      nodes: JSON.stringify([asset, storyboard]),
      edges: JSON.stringify([{ id: 'edge-1', source: storyboard.id, target: asset.id }]),
      past: '[]', future: '[]', viewport: null, revision: 0,
    });
    const service = new AgentCanvasService(prisma as any);

    await expect(service.getState('canvas-1')).resolves.toMatchObject({
      edges: [{
        id: 'edge-1', source: asset.id, target: storyboard.id,
        sourceHandle: 'source-anchor', targetHandle: 'target-anchor',
      }],
    });
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

  it('persists generation status and error fields used by agent tasks', async () => {
    const { prisma, state } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    await service.applyOps('canvas-1', 'run-1', [
      { action: 'update_node', id: 'text-1', data: { status: 'processing', error: '生成失败' } },
    ]);

    expect(JSON.parse(state.nodes)[0].data).toMatchObject({ status: 'processing', error: '生成失败' });
  });

  it('persists subject media bindings', async () => {
    const { prisma, state } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    await service.applyOps('canvas-1', 'run-subject', [{
      action: 'create_node',
      node: {
        id: 'subject-1',
        type: 'subjectNode',
        data: {
          name: '主角',
          url: '/main.png',
          voiceUrl: '/voice.mp3',
        },
      },
    }]);

    expect(JSON.parse(state.nodes)).toContainEqual(expect.objectContaining({
      id: 'subject-1',
      data: expect.objectContaining({
        url: '/main.png',
        voiceUrl: '/voice.mp3',
      }),
    }));
  });

  it('creates shot groups before their members and preserves relative layout fields', async () => {
    const { prisma, state } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    await service.applyOps('canvas-1', 'run-group', [
      {
        action: 'create_node',
        node: {
          id: 'shot-image', type: 'imageNode', parentId: 'shot-group',
          position: { x: 440, y: 72 }, data: { title: '分镜图', text: '[倒霉熊]追野餐布' },
        },
      },
      {
        action: 'create_node',
        node: {
          id: 'shot-group', type: 'group', position: { x: 800, y: 100 },
          width: 1240, height: 560, data: { title: '镜头 01｜追逐' },
        },
      },
    ]);

    const nodes = JSON.parse(state.nodes);
    expect(nodes[0]).toMatchObject({ id: 'shot-group', width: 1240, height: 560, zIndex: -2000 });
    expect(nodes.find((node: any) => node.id === 'shot-image')).toMatchObject({
      parentId: 'shot-group', position: { x: 440, y: 72 },
    });
    const groupState = await service.getState('canvas-1', ['shot-group']);
    expect(groupState.nodes[0]).toMatchObject({ width: 1240, height: 560, zIndex: -2000 });
  });

  it('converts grouped video prompt text into a referenced video node', async () => {
    const { prisma, state } = makePrisma();
    const service = new AgentCanvasService(prisma as any);

    await service.applyOps('canvas-1', 'run-video', [
      { action: 'create_node', node: { id: 'shot-group', type: 'group', data: { title: '镜头 01' } } },
      { action: 'create_node', node: { id: 'shot-image', type: 'imageNode', parentId: 'shot-group', data: { title: '镜头01｜分镜图' } } },
      { action: 'create_node', node: { id: 'shot-video', type: 'textNode', parentId: 'shot-group', data: { title: '镜头01｜视频提示词', text: '时长6秒，镜头缓慢推近。' } } },
    ]);

    const nodes = JSON.parse(state.nodes);
    expect(nodes.find((node: any) => node.id === 'shot-video')).toMatchObject({
      type: 'videoNode',
      data: {
        title: '镜头01｜视频',
        draftText: '参考首帧画面镜头01｜分镜图，时长6秒，镜头缓慢推近。',
        config: { videoMode: 'imageToVideo' },
      },
    });
    expect(JSON.parse(state.edges)).toContainEqual(expect.objectContaining({
      source: 'shot-image', target: 'shot-video',
      sourceHandle: 'source-anchor', targetHandle: 'target-anchor',
    }));
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
