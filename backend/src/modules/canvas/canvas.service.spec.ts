import { CanvasService } from './canvas.service';

describe('CanvasService', () => {
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
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          ...data,
          id: 'canvas-1',
          createdAt: new Date('2026-11-04T00:00:00Z'),
          updatedAt: new Date('2026-11-04T00:00:00Z'),
        })),
      },
      generationRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };
    const service = new CanvasService(prisma as any);

    await expect(service.get()).resolves.toEqual({
      nodes: [{ id: '1' }], edges: [], past: [], future: [],
    });
    await service.save('default', {
      nodes: [], edges: [],
      past: Array.from({ length: 51 }, () => ({ nodes: [], edges: [] })),
      future: [],
    });
    const values = prisma.canvasState.upsert.mock.calls[0][0].create;
    expect(JSON.parse(values.past)).toHaveLength(50);
    await expect(service.create()).resolves.toMatchObject({ id: 'canvas-1', title: '未命名画布', nodeCount: 0 });
    await expect(service.list()).resolves.toEqual([]);
    await service.generations('canvas-1');
    expect(prisma.generationRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { canvasId: 'canvas-1' } }));
    await service.createGeneration('canvas-1', { nodeId: 'node-1', nodeType: 'imageNode', title: '图片 1', url: 'image.png' });
    expect(prisma.generationRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ canvasId: 'canvas-1' }) });
  });
});
