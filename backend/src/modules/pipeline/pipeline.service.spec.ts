import { PipelineService } from './pipeline.service';
import { genSceneReferenceImage } from '@/common/llm/tools/gen-scene-reference';
import { ChunkStatus } from '@/common/utils/ai-stream-utils';
import { createChatModel } from '@/common/llm';
import { genAudio } from '@/common/llm/tools/gen-audio';

jest.mock('@/common/llm/tools/gen-scene-reference', () => ({ genSceneReferenceImage: jest.fn() }));
jest.mock('@/common/llm', () => ({ createChatModel: jest.fn() }));
jest.mock('@/common/llm/tools/gen-audio', () => ({ genAudio: jest.fn() }));

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

describe('PipelineService dubbing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a script from the subject image and description before generating audio', async () => {
    const audioModel = { id: 'audio-model', params: '{}' };
    const textModel = { id: 'vision-model', params: '{}' };
    const models = {
      runtime: jest.fn().mockResolvedValue(audioModel),
      visionRuntime: jest.fn().mockResolvedValue(textModel),
    };
    const invoke = jest.fn().mockResolvedValue({ text: '你好，我是小企鹅。' });
    (createChatModel as jest.Mock).mockReturnValue({ invoke });
    (genAudio as jest.Mock).mockResolvedValue('voice.wav');
    const service = new PipelineService(models as any, {} as any);
    const message = [
      { type: 'image_url', image_url: 'subject.png' },
      { type: 'text', text: '一只开朗的小企鹅' },
    ];
    const events = [];

    for await (const event of service.dubbing({ modelId: 'audio-model', message } as any)) {
      events.push(event);
    }

    expect(models.visionRuntime).toHaveBeenCalledTimes(1);
    expect(models.runtime).toHaveBeenCalledWith('audio-model', 'audio');
    expect(invoke.mock.calls[0][0][0].content.slice(0, 2)).toEqual(message);
    expect(genAudio).toHaveBeenCalledWith({
      message: [{ type: 'text', text: '你好，我是小企鹅。' }],
      runtimeModel: audioModel,
    });
    expect(events).toContainEqual({
      type: 'msg_chunk',
      content: { status: ChunkStatus.SUCCESS, url: 'voice.wav' },
    });
  });
});
