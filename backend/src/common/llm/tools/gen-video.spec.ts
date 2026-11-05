/// <reference types="jest" />
import { genVideo } from './gen-video';

const runtimeModel = {
  id: 'video-config',
  provider: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: 'test-key',
  modelId: 'wan3.0-video',
  params: '{}',
};

describe('genVideo video references', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends native video and image references', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ output: { task_id: 'task-id' } }),
    } as unknown as Response);

    await genVideo({
      message: [
        { type: 'video_url', video_url: 'https://example.com/preview.webm' },
        { type: 'image_url', image_url: 'https://example.com/character.png' },
        { type: 'text', text: '渲染成真实人物' },
      ],
      config: { ratio: '16:9', duration: 15 },
      runtimeModel,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.input.media).toEqual([
      { type: 'reference_video', url: 'https://example.com/preview.webm' },
      { type: 'reference_image', url: 'https://example.com/character.png' },
    ]);
    expect(body.input.prompt).toContain('[视频0]');
    expect(body.input.prompt).toContain('[图片0]');
    expect(body.parameters.duration).toBe(15);
    expect(body.parameters.prompt_extend).toBe(true);
  });

  it('can disable prompt rewriting for reviewed continuity prompts', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ output: { task_id: 'task-id' } }),
    } as unknown as Response);
    await genVideo({
      message: [{ type: 'text', text: '保持首帧构图' }],
      config: { ratio: '16:9', firstFrameUrl: 'https://example.com/last.png', promptExtend: false },
      runtimeModel,
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.parameters.prompt_extend).toBe(false);
    expect(body.input.media).toEqual([
      { type: 'first_frame', url: 'https://example.com/last.png' },
    ]);
  });

  it('rejects models without native video reference support', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(genVideo({
      message: [{ type: 'video_url', video_url: 'https://example.com/preview.webm' }],
      config: { ratio: '16:9' },
      runtimeModel: { ...runtimeModel, modelId: 'wan2.6-video' },
    })).rejects.toThrow('当前模型不支持原生视频参考');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
