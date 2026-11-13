import { PipelineService } from './pipeline.service';
import { genSceneReferenceImage } from '@/common/llm/tools/gen-scene-reference';
import { ChunkStatus } from '@/common/utils/ai-stream-utils';

jest.mock('@/common/llm/tools/gen-scene-reference', () => ({ genSceneReferenceImage: jest.fn() }));

describe('PipelineService scene reference', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ignores a linked story script without any character image connection', async () => {
    const models = { runtime: jest.fn().mockResolvedValue({}), visionRuntime: jest.fn().mockResolvedValue({}) };
    const service = new PipelineService(models as any, {} as any);
    (genSceneReferenceImage as jest.Mock).mockResolvedValue({ content: [{ image: 'empty.png' }] });
    const events = [];
    for await (const event of service.image({
      assetKind: 'sceneReference',
      message: [{ type: 'text', text: '后院池塘空景，无人物、无动物' }] as any,
      textList: [{ action: '场景剧本', action_input: '橘猫趴在石头上，小鱼跃出水面，接住蜻蜓', supplementary: { style: '', ratio: '16:9' } }],
      config: { ratio: '16:9' },
    })) events.push(event);

    const input = (genSceneReferenceImage as jest.Mock).mock.calls[0][0];
    expect(input.message).toEqual([{ type: 'text', text: '后院池塘空景，无人物、无动物' }]);
    expect(input.textList).toEqual([]);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'msg_chunk',
      content: expect.objectContaining({ status: ChunkStatus.SUCCESS }),
    }));
  });

  it('streams processing before image generation finishes', async () => {
    const models = { runtime: jest.fn().mockResolvedValue({}), visionRuntime: jest.fn().mockResolvedValue({}) };
    const service = new PipelineService(models as any, {} as any);
    (genSceneReferenceImage as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const stream = service.image({
      assetKind: 'sceneReference',
      message: [{ type: 'text', text: '池塘空景' }] as any,
      config: { ratio: '16:9' },
    });

    expect(await stream.next()).toEqual(expect.objectContaining({
      value: expect.objectContaining({ type: 'msg_start' }),
    }));
    expect(await stream.next()).toEqual(expect.objectContaining({
      value: expect.objectContaining({ content: expect.objectContaining({ status: ChunkStatus.PROCESSING }) }),
    }));
    await stream.return(undefined);
  });

  it('does not pass connected script or character images to generation', async () => {
    const models = { runtime: jest.fn().mockResolvedValue({}), visionRuntime: jest.fn().mockResolvedValue({}) };
    const service = new PipelineService(models as any, {} as any);
    (genSceneReferenceImage as jest.Mock).mockResolvedValue({ content: [{ image: 'empty.png' }] });
    const events = [];
    for await (const event of service.image({
      assetKind: 'sceneReference',
      message: [
        { type: 'image_url', image_url: 'character.png' },
        { type: 'text', text: '空荡的池塘' },
      ] as any,
      textList: [{ action: '剧本', action_input: '猫跳进水中', supplementary: { style: '', ratio: '16:9' } }],
      config: { ratio: '16:9', edit: true },
    })) events.push(event);

    const input = (genSceneReferenceImage as jest.Mock).mock.calls[0][0];
    expect(input.message).toEqual([{ type: 'text', text: '空荡的池塘' }]);
    expect(input.textList).toEqual([]);
    expect(input.config.edit).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'msg_chunk',
      content: expect.objectContaining({ url: 'empty.png' }),
    }));
  });

  it('reports failed review without publishing an occupied image', async () => {
    const models = { runtime: jest.fn().mockResolvedValue({}), visionRuntime: jest.fn().mockResolvedValue({}) };
    const service = new PipelineService(models as any, {} as any);
    (genSceneReferenceImage as jest.Mock).mockRejectedValue(new Error('场景参考图多次出现人物或动物'));
    const events = [];
    for await (const event of service.image({
      assetKind: 'sceneReference',
      message: [{ type: 'text', text: '池塘空景' }] as any,
      config: { ratio: '16:9' },
    })) events.push(event);

    expect(events).toContainEqual(expect.objectContaining({
      type: 'msg_chunk',
      content: expect.objectContaining({ status: ChunkStatus.FAILED, url: null }),
    }));
    expect(events).not.toContainEqual(expect.objectContaining({
      type: 'msg_chunk',
      content: expect.objectContaining({ status: ChunkStatus.SUCCESS }),
    }));
  });
});
