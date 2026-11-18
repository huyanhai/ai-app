import { ChunkStatus } from '@/common/utils/ai-stream-utils';
import { GenerationService } from './generation.service';

const record = {
  id: 'job-1',
  kind: 'image',
  prompt: '一只猫',
  modelId: 'model-1',
  modelName: 'Image Model',
  config: JSON.stringify({ ratio: '1:1', count: 2 }),
  referenceUrl: null,
  status: 'pending',
  urls: '[]',
  error: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GenerationService', () => {
  it('persists every generated image url', async () => {
    const update = jest.fn().mockResolvedValue(record);
    const prisma = {
      generationJob: {
        findUnique: jest.fn().mockResolvedValue(record),
        update,
      },
    };
    const pipeline = {
      image: jest.fn().mockImplementation(async function* () {
        yield {
          type: 'msg_chunk',
          content: {
            status: ChunkStatus.SUCCESS,
            url: '/first.png',
            urls: ['/first.png', '/second.png'],
          },
        };
        yield { type: 'msg_end' };
      }),
    };
    const service = new GenerationService(prisma as any, pipeline as any);

    for await (const _event of service.run(record.id)) {
    }

    expect(update).toHaveBeenLastCalledWith({
      where: { id: record.id },
      data: {
        status: 'succeeded',
        error: null,
        urls: JSON.stringify(['/first.png', '/second.png']),
      },
    });
  });

  it('marks the record as failed when generation returns an error', async () => {
    const update = jest.fn().mockResolvedValue(record);
    const prisma = {
      generationJob: {
        findUnique: jest.fn().mockResolvedValue(record),
        update,
      },
    };
    const pipeline = {
      image: jest.fn().mockImplementation(async function* () {
        yield { type: 'msg_error', error: 'model failed' };
      }),
    };
    const service = new GenerationService(prisma as any, pipeline as any);

    for await (const _event of service.run(record.id)) {
    }

    expect(update).toHaveBeenLastCalledWith({
      where: { id: record.id },
      data: {
        status: 'failed',
        error: 'model failed',
        urls: '[]',
      },
    });
  });

  it('sends all reference images without leaking internal config to the pipeline', async () => {
    const referencedRecord = {
      ...record,
      referenceUrl: '/character.png',
      config: JSON.stringify({
        ratio: '16:9',
        referenceUrls: ['/character.png', 'https://cdn/scene.png'],
      }),
    };
    const prisma = {
      generationJob: {
        findUnique: jest.fn().mockResolvedValue(referencedRecord),
        update: jest.fn().mockResolvedValue(referencedRecord),
      },
    };
    const pipeline = {
      image: jest.fn().mockImplementation(async function* () {
        yield { type: 'msg_end' };
      }),
    };
    const service = new GenerationService(prisma as any, pipeline as any);

    for await (const _event of service.run(record.id)) {
    }

    expect(pipeline.image).toHaveBeenCalledWith(expect.objectContaining({
      message: [
        { type: 'image_url', image_url: 'http://127.0.0.1:3000/character.png' },
        { type: 'image_url', image_url: 'https://cdn/scene.png' },
        { type: 'text', text: '一只猫' },
      ],
      config: { ratio: '16:9', edit: true },
    }));
  });
});
