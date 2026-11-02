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
      },
    };
    const service = new CanvasService(prisma as any);

    await expect(service.get()).resolves.toEqual({
      nodes: [{ id: '1' }], edges: [], past: [], future: [],
    });
    await service.save({
      nodes: [], edges: [],
      past: Array.from({ length: 51 }, () => ({ nodes: [], edges: [] })),
      future: [],
    });
    const values = prisma.canvasState.upsert.mock.calls[0][0].create;
    expect(JSON.parse(values.past)).toHaveLength(50);
  });
});
