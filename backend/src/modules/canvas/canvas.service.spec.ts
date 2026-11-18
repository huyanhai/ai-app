import { CanvasService } from './canvas.service';

describe('CanvasService', () => {
  it('increments revisions and rejects stale saves', async () => {
    const prisma = {
      canvasState: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'canvas-1', revision: 4 }),
        create: jest.fn(),
      },
    };
    const service = new CanvasService(prisma as any);

    await expect(
      service.save('canvas-1', {
        nodes: [],
        edges: [],
        past: [],
        future: [],
        revision: 3,
      }),
    ).resolves.toEqual({ success: true, revision: 4 });
    expect(prisma.canvasState.updateMany).toHaveBeenCalledWith({
      where: { id: 'canvas-1', revision: 3 },
      data: expect.objectContaining({ revision: { increment: 1 } }),
    });
    await expect(
      service.save('canvas-1', {
        nodes: [],
        edges: [],
        past: [],
        future: [],
        revision: 3,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.canvasState.create).not.toHaveBeenCalled();
  });

  it('uses the explicitly selected image as the canvas cover', async () => {
    const state = {
      id: 'canvas-1',
      title: '画布',
      createdAt: new Date(),
      updatedAt: new Date(),
      nodes: JSON.stringify([
        {
          id: 'cover',
          type: 'imageNode',
          data: { url: 'cover.png', canvasCover: true },
        },
        { id: 'latest', type: 'imageNode', data: { url: 'latest.png' } },
      ]),
    };
    const service = new CanvasService({
      canvasState: { findMany: jest.fn().mockResolvedValue([state]) },
    } as any);

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        previewUrl: 'cover.png',
        previewType: 'image',
      }),
    ]);
  });

  it('normalizes existing edges when loading an agent canvas', async () => {
    const nodes = [
      { id: 'shot-group', type: 'group', position: { x: 400, y: 0 }, data: { title: '镜头 01' } },
      { id: 'script', type: 'textNode', position: { x: 0, y: 0 }, data: { title: '剧本' } },
      { id: 'asset', type: 'imageNode', position: { x: 0, y: 100 }, data: { title: '角色三视图' } },
      { id: 'storyboard', type: 'imageNode', position: { x: 400, y: 100 }, data: { title: '镜头 01 · 分镜图' } },
    ];
    const service = new CanvasService({
      canvasState: {
        findUnique: jest.fn().mockResolvedValue({
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify([
            { id: 'reverse', source: 'storyboard', target: 'asset' },
            { id: 'script-edge', source: 'storyboard', target: 'script' },
          ]),
          past: '[]', future: '[]', revision: 7,
        }),
      },
    } as any);

    await expect(service.get('canvas-1')).resolves.toMatchObject({
      revision: 7,
      edges: [{
        id: 'reverse', source: 'asset', target: 'storyboard',
        sourceHandle: 'source-anchor', targetHandle: 'target-anchor',
      }],
    });
  });

  it('restores and limits persisted canvas history', async () => {
    const prisma = {
      canvasState: {
        findUnique: jest.fn().mockResolvedValue({
          nodes: '[{"id":"1"}]',
          edges: '[]',
          past: '[]',
          future: '[]',
        }),
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...data,
            id: 'canvas-1',
            createdAt: new Date('2026-11-04T00:00:00Z'),
            updatedAt: new Date('2026-11-04T00:00:00Z'),
          }),
        ),
      },
      generationRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };
    const service = new CanvasService(prisma as any);

    await expect(service.get()).resolves.toEqual({
      nodes: [{ id: '1' }],
      edges: [],
      past: [],
      future: [],
      revision: 0,
      viewport: undefined,
    });
    await service.save('default', {
      nodes: [],
      edges: [],
      past: Array.from({ length: 51 }, () => ({ nodes: [], edges: [] })),
      future: [],
    });
    const values = prisma.canvasState.upsert.mock.calls[0][0].create;
    expect(JSON.parse(values.past)).toHaveLength(50);
    await service.save('default', {
      nodes: [],
      edges: [],
      past: [],
      future: [],
      viewport: { x: 120, y: -40, zoom: 0.75 },
    });
    expect(
      JSON.parse(prisma.canvasState.upsert.mock.calls[1][0].create.viewport),
    ).toEqual({
      x: 120,
      y: -40,
      zoom: 0.75,
    });
    await service.saveViewport('default', { x: 160, y: -80, zoom: 1.25 });
    expect(prisma.canvasState.updateMany).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { viewport: JSON.stringify({ x: 160, y: -80, zoom: 1.25 }) },
    });
    await expect(service.create()).resolves.toMatchObject({
      id: 'canvas-1',
      title: '未命名画布',
      nodeCount: 0,
    });
    await expect(service.list()).resolves.toEqual([]);
    await service.generations('canvas-1');
    expect(prisma.generationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { canvasId: 'canvas-1' } }),
    );
    await service.createGeneration('canvas-1', {
      nodeId: 'node-1',
      nodeType: 'imageNode',
      title: '图片 1',
      url: 'image.png',
    });
    expect(prisma.generationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ canvasId: 'canvas-1' }),
    });
  });

  it('renames, duplicates, and removes a complete canvas project', async () => {
    const createdAt = new Date('2026-11-04T00:00:00Z');
    const state = {
      id: 'canvas-1',
      title: '画布',
      nodes: '[]',
      edges: '[]',
      past: '[]',
      future: '[]',
      createdAt,
      updatedAt: createdAt,
    };
    const transaction = {
      canvasState: {
        create: jest
          .fn()
          .mockResolvedValue({
            ...state,
            id: 'canvas-copy',
            title: '画布 副本',
          }),
        delete: jest.fn().mockResolvedValue({}),
      },
      generationRecord: { createMany: jest.fn(), deleteMany: jest.fn() },
      productionProject: { createMany: jest.fn(), deleteMany: jest.fn() },
      agentSession: { create: jest.fn(), deleteMany: jest.fn() },
      agentMessage: { deleteMany: jest.fn() },
    };
    const prisma = {
      canvasState: {
        update: jest.fn().mockResolvedValue({ ...state, title: '新名称' }),
        findUnique: jest.fn().mockResolvedValue(state),
      },
      generationRecord: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'generation-1', canvasId: 'canvas-1', nodeId: 'node-1' },
          ]),
      },
      productionProject: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'project-1', canvasId: 'canvas-1', idea: '创意' },
          ]),
      },
      agentSession: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'session-1',
            title: '会话',
            canvasId: 'canvas-1',
            createdAt,
            messages: [
              { id: 1, sessionId: 'session-1', role: 'user', content: '你好' },
            ],
          },
        ]),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const service = new CanvasService(prisma as any);

    await expect(
      service.rename('canvas-1', '  新名称  '),
    ).resolves.toMatchObject({ title: '新名称' });
    expect(prisma.canvasState.update).toHaveBeenCalledWith({
      where: { id: 'canvas-1' },
      data: { title: '新名称' },
    });

    await expect(service.duplicate('canvas-1')).resolves.toMatchObject({
      id: 'canvas-copy',
      title: '画布 副本',
    });
    expect(transaction.generationRecord.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ canvasId: 'canvas-copy', nodeId: 'node-1' }),
      ],
    });
    expect(transaction.productionProject.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          canvasId: 'canvas-copy',
          idea: '创意',
          id: expect.any(String),
        }),
      ],
    });
    expect(transaction.agentSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        canvasId: 'canvas-copy',
        messages: { create: [expect.objectContaining({ content: '你好' })] },
      }),
    });

    await expect(service.remove('canvas-1')).resolves.toEqual({
      success: true,
    });
    expect(transaction.agentMessage.deleteMany).toHaveBeenCalledWith({
      where: { session: { canvasId: 'canvas-1' } },
    });
    expect(transaction.productionProject.deleteMany).toHaveBeenCalledWith({
      where: { canvasId: 'canvas-1' },
    });
    expect(transaction.canvasState.delete).toHaveBeenCalledWith({
      where: { id: 'canvas-1' },
    });
  });

  it('lists and bulk deletes generation assets', async () => {
    const record = {
      id: 'asset-1',
      nodeId: 'node-1',
      nodeType: 'imageNode',
      title: 'Agent image',
      url: 'image.png',
      canvasId: 'canvas-1',
      createdAt: new Date('2026-11-17T00:00:00Z'),
    };
    const prisma = {
      generationRecord: {
        findMany: jest.fn().mockResolvedValue([record]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      canvasState: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'canvas-1',
          nodes: JSON.stringify([{ id: 'node-1', data: { title: '分镜-场景1 海滨步道' } }]),
        }]),
      },
    };
    const service = new CanvasService(prisma as any);

    await expect(service.allGenerations()).resolves.toEqual([{
      ...record,
      title: '分镜-场景1 海滨步道',
    }]);
    expect(prisma.generationRecord.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    await expect(service.deleteGenerations(['asset-1', 'asset-2', 'asset-1'])).resolves.toEqual({
      success: true,
      deleted: 2,
    });
    expect(prisma.generationRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['asset-1', 'asset-2'] } },
    });
    await expect(service.deleteGenerations([])).rejects.toMatchObject({ status: 400 });
    await expect(service.deleteGenerations([null as any])).rejects.toMatchObject({ status: 400 });
  });
});
