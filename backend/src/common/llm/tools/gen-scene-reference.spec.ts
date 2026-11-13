import { createChatModel } from '..';
import { genImage } from './gen-image';
import { genSceneReferenceImage } from './gen-scene-reference';

jest.mock('..', () => ({ createChatModel: jest.fn() }));
jest.mock('./gen-image', () => ({ genImage: jest.fn() }));

const input = {
  runtimeModel: {} as any,
  message: [{ type: 'text' as const, text: '池塘空景' }],
  textList: [],
  config: { ratio: '16:9' },
};

describe('genSceneReferenceImage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retries occupied images and returns only a reviewed empty scene', async () => {
    (genImage as jest.Mock)
      .mockResolvedValueOnce({ content: [{ image: 'cat.png' }] })
      .mockResolvedValueOnce({ content: [{ image: 'empty.png' }] });
    const invoke = jest.fn()
      .mockResolvedValueOnce({ text: 'OCCUPIED' })
      .mockResolvedValueOnce({ text: 'EMPTY' });
    (createChatModel as jest.Mock).mockReturnValue({ invoke });

    await expect(genSceneReferenceImage(input, {} as any))
      .resolves.toEqual({ content: [{ image: 'empty.png' }] });
    expect(genImage).toHaveBeenCalledTimes(2);
    expect((genImage as jest.Mock).mock.calls[1][0].message[1].text).toContain('重新绘制');
    expect((genImage as jest.Mock).mock.calls[1][0].config).toEqual(expect.objectContaining({ count: 1, edit: false }));
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('fails closed after three occupied images', async () => {
    (genImage as jest.Mock).mockResolvedValue({ content: [{ image: 'cat.png' }] });
    (createChatModel as jest.Mock).mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ text: 'OCCUPIED' }),
    });

    await expect(genSceneReferenceImage(input, {} as any))
      .rejects.toThrow('多次出现人物或动物');
    expect(genImage).toHaveBeenCalledTimes(3);
  });

  it('does not accept an uncertain review', async () => {
    (genImage as jest.Mock).mockResolvedValue({ content: [{ image: 'scene.png' }] });
    (createChatModel as jest.Mock).mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ text: 'maybe' }),
    });

    await expect(genSceneReferenceImage(input, {} as any))
      .rejects.toThrow('无法确认场景参考图');
    expect(genImage).toHaveBeenCalledTimes(1);
  });

  it('disables SenseNova reasoning so the review returns a verdict', async () => {
    (genImage as jest.Mock).mockResolvedValue({ content: [{ image: 'scene.png' }] });
    (createChatModel as jest.Mock).mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ text: 'EMPTY' }),
    });

    await genSceneReferenceImage(input, { modelId: 'sensenova-6.8-flash-lite' } as any);

    expect(createChatModel).toHaveBeenCalledWith(
      { modelId: 'sensenova-6.8-flash-lite' },
      expect.objectContaining({ modelKwargs: { reasoning_effort: 'none' } }),
    );
  });
});
