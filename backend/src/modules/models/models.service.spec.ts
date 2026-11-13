import { ModelsService } from './models.service';

describe('ModelsService runtime', () => {
  it('selects a configured vision-capable text model for image review', async () => {
    const models = [
      { id: 'text-only', params: '{"supportVision":false}' },
      { id: 'vision', params: '{"supportVision":true}' },
    ];
    const prisma = { modelConfig: { findMany: jest.fn().mockResolvedValue(models) } };
    const service = new ModelsService(prisma as any);
    jest.spyOn(service, 'runtime').mockResolvedValue(models[1] as any);

    await expect(service.visionRuntime()).resolves.toEqual(models[1]);
    expect(service.runtime).toHaveBeenCalledWith('vision', 'text');
  });

  it('resolves a node model display name as well as a config id', async () => {
    const prisma = {
      modelConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'config-1',
          name: 'Wan3 视频',
          category: 'video',
          modelId: 'wan3.0-video',
          baseURL: 'https://api.91token.com/ali/api/v1',
          apiKey: 'key',
          enabled: true,
        }),
      },
    };
    const service = new ModelsService(prisma as any);

    await expect(service.runtime('Wan3 视频', 'video')).resolves.toEqual(
      expect.objectContaining({ id: 'config-1' }),
    );
    expect(prisma.modelConfig.findFirst).toHaveBeenCalledWith({
      where: {
        category: 'video',
        OR: [{ id: 'Wan3 视频' }, { name: 'Wan3 视频' }],
      },
    });
  });
});
