import { genVideo, queryVideoTask } from '../tools/gen-video';
import { getVideoProvider } from '.';

const model = (provider: string, baseURL: string, modelId = 'test-video') => ({
  id: provider,
  provider,
  baseURL,
  modelId,
  apiKey: 'test-key',
  params: '{}',
});

const response = (data: unknown) =>
  ({
    ok: true,
    json: jest.fn().mockResolvedValue(data),
  }) as unknown as Response;

const body = (fetchMock: jest.SpyInstance, index = 0) =>
  JSON.parse(String(fetchMock.mock.calls[index][1]?.body));

describe('video providers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('routes Seedance creation and normalizes its task result', async () => {
    const runtime = model('seedance', 'https://api.91token.com/doubao/api/v3');
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ id: 'cgt-1' }))
      .mockResolvedValueOnce(
        response({
          status: 'succeeded',
          content: { video_url: 'seedance.mp4', last_frame_url: 'last.png' },
        }),
      );

    await expect(
      genVideo({
        runtimeModel: runtime,
        message: [
          { type: 'text', text: '镜头推进' },
          { type: 'image_url', image_url: 'character.png' },
          { type: 'video_url', video_url: 'reference.mp4' },
        ],
        config: {
          resolution: '720P',
          ratio: '16:9',
          duration: 5,
          extractLastFrame: true,
        },
      }),
    ).resolves.toEqual({ task_id: 'cgt-1' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.91token.com/doubao/api/v3/contents/generations/tasks',
    );
    expect(body(fetchMock).content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'image_url', role: 'reference_image' }),
        expect.objectContaining({ type: 'video_url', role: 'reference_video' }),
      ]),
    );
    expect(body(fetchMock).resolution).toBe('720p');

    await expect(queryVideoTask('cgt-1', runtime)).resolves.toEqual({
      output: expect.objectContaining({
        task_status: 'SUCCEEDED',
        video_url: 'seedance.mp4',
        last_frame_url: 'last.png',
      }),
    });
  });

  it('uses Grok multi-image fields and reads wrapped task responses', async () => {
    const runtime = model(
      'grok-video',
      'https://api.91token.com/v1',
      'grok-imagine-video',
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ task_id: 'grok-1' }))
      .mockResolvedValueOnce(
        response({
          code: 'success',
          data: {
            task_id: 'grok-1',
            status: 'SUCCESS',
            result_url: 'grok.mp4',
          },
        }),
      );
    await genVideo({
      runtimeModel: runtime,
      message: [
        { type: 'text', text: '生成视频' },
        { type: 'image_url', image_url: 'one.png' },
        { type: 'image_url', image_url: 'two.png' },
      ],
      config: { duration: 6, resolution: '720P', ratio: '16:9' },
    });
    expect(body(fetchMock).metadata.reference_images).toEqual([
      'one.png',
      'two.png',
    ]);
    expect(body(fetchMock).image).toBeUndefined();
    await expect(queryVideoTask('grok-1', runtime)).resolves.toEqual({
      output: expect.objectContaining({
        task_status: 'SUCCEEDED',
        video_url: 'grok.mp4',
      }),
    });
  });

  it('rejects unsupported Grok multi-image models before requesting', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(
      genVideo({
        runtimeModel: model(
          'grok-video',
          'https://api.91token.com/v1',
          'grok-imagine-video-1.5-preview',
        ),
        message: [
          { type: 'image_url', image_url: 'one.png' },
          { type: 'image_url', image_url: 'two.png' },
        ],
        config: { ratio: '16:9' },
      }),
    ).rejects.toThrow('仅支持单图');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses general metadata content and direct completion responses', async () => {
    const runtime = model('general-video', 'https://api.91token.com/v1');
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ id: 'general-1' }))
      .mockResolvedValueOnce(
        response({ status: 'completed', metadata: { url: 'general.mp4' } }),
      );
    await genVideo({
      runtimeModel: runtime,
      message: [{ type: 'image_url', image_url: 'first.png' }],
      config: {
        firstFrameUrl: 'first.png',
        lastFrameUrl: 'last.png',
        duration: 4,
        ratio: '16:9',
      },
    });
    expect(body(fetchMock).metadata.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          image_url: { url: 'first.png' },
          role: 'first_frame',
        }),
        expect.objectContaining({
          image_url: { url: 'last.png' },
          role: 'last_frame',
        }),
      ]),
    );
    await expect(queryVideoTask('general-1', runtime)).resolves.toEqual({
      output: expect.objectContaining({
        task_status: 'SUCCEEDED',
        video_url: 'general.mp4',
      }),
    });
  });

  it.each(['openai', 'google', 'siliconflow', 'custom'])(
    'routes legacy %s video models through the general API',
    async (provider) => {
      const runtime = model(provider, 'https://api.91token.com/v1', 'MiniMax-H3');
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(response({ id: 'general-legacy' }));

      await genVideo({
        runtimeModel: runtime,
        message: [{ type: 'text', text: '长颈鹿找到水洼' }],
        config: { ratio: '16:9', resolution: '480P', duration: 8 },
      });

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://api.91token.com/v1/video/generations',
      );
      expect(body(fetchMock).model).toBe('MiniMax-H3');
      expect(body(fetchMock).metadata.resolution).toBe('768P');
      expect(body(fetchMock).metadata.duration).toBe(8);
    },
  );

  it('structures MiniMax-H3 full-reference prompts and media roles', async () => {
    const runtime = model('general-video', 'https://api.91token.com/v1', 'MiniMax-H3');
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ id: 'h3-reference' }));

    await genVideo({
      runtimeModel: runtime,
      message: [
        { type: 'text', text: '长颈鹿走到水洼边低头喝水' },
        { type: 'image_url', image_url: 'giraffe.png' },
      ],
      config: { ratio: '16:9', resolution: '768P', duration: 8 },
    });

    const payload = body(fetchMock);
    expect(payload.prompt).toContain('subject_definitions: <Picture 1>');
    expect(payload.prompt).toContain('summary: 长颈鹿走到水洼边低头喝水');
    expect(payload.prompt).toContain('retention_analysis: <Picture 1>');
    expect(payload.prompt).toContain('detailed_description: [Shot 1]');
    expect(payload.prompt).toContain('overall_soundscape:');
    expect(payload.prompt).toContain('non_diegetic_music: N/A');
    expect(payload.metadata.content).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'giraffe.png' },
        role: 'reference_image',
      },
    ]);
  });

  it('selects Vidu text, frame and query endpoints', async () => {
    const runtime = model(
      'vidu',
      'https://api.91token.com/v1/ent/v2',
      'viduq3-turbo',
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ task_id: 'vidu-text' }))
      .mockResolvedValueOnce(response({ task_id: 'vidu-frames' }))
      .mockResolvedValueOnce(
        response({ state: 'success', creations: [{ url: 'vidu.mp4' }] }),
      );
    await genVideo({
      runtimeModel: runtime,
      message: [{ type: 'text', text: '文生视频' }],
      config: { ratio: '16:9' },
    });
    await genVideo({
      runtimeModel: runtime,
      message: [{ type: 'text', text: '首尾帧' }],
      config: {
        firstFrameUrl: 'first.png',
        lastFrameUrl: 'last.png',
        ratio: '16:9',
      },
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.91token.com/v1/ent/v2/text2video',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.91token.com/v1/ent/v2/start-end2video',
    );
    expect(body(fetchMock, 1).images).toEqual(['first.png', 'last.png']);
    await expect(queryVideoTask('vidu-frames', runtime)).resolves.toEqual({
      output: expect.objectContaining({
        task_status: 'SUCCEEDED',
        video_url: 'vidu.mp4',
      }),
    });
  });

  it('normalizes legacy 91Token Vidu URLs for creation and query', async () => {
    const runtime = model('vidu', 'https://api.91token.com/v1', 'viduq3-turbo');
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ task_id: 'vidu-legacy' }))
      .mockResolvedValueOnce(
        response({ state: 'success', creations: [{ url: 'vidu-legacy.mp4' }] }),
      );

    await genVideo({
      runtimeModel: runtime,
      message: [{ type: 'text', text: '长颈鹿找到水洼' }],
      config: { ratio: '16:9', resolution: '480P' },
    });
    await queryVideoTask('vidu-legacy', runtime);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.91token.com/v1/ent/v2/text2video',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.91token.com/v1/ent/v2/tasks/vidu-legacy/creations',
    );
    expect(body(fetchMock).resolution).toBe('720p');
  });

  it('keeps Wan3 on its independent gateway protocol', async () => {
    const runtime = model(
      'wan3',
      'https://api.91token.com/ali/api/v1',
      'wan3.0-video',
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ output: { task_id: 'wan-1' } }))
      .mockResolvedValueOnce(
        response({
          output: { task_status: 'SUCCEEDED', video_url: 'wan.mp4' },
        }),
      );
    await genVideo({
      runtimeModel: runtime,
      message: [{ type: 'video_url', video_url: 'reference.mp4' }],
      config: { promptExtend: false, ratio: '16:9' },
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.91token.com/ali/api/v1/services/aigc/video-generation/video-synthesis',
    );
    expect(body(fetchMock).input.media).toEqual([
      { type: 'reference_video', url: 'reference.mp4' },
    ]);
    expect(body(fetchMock).parameters.prompt_extend).toBe(false);
    await expect(queryVideoTask('wan-1', runtime)).resolves.toEqual({
      output: expect.objectContaining({
        task_status: 'SUCCEEDED',
        video_url: 'wan.mp4',
      }),
    });
  });

  it('rejects unknown providers', () => {
    expect(() =>
      getVideoProvider(model('unknown', 'https://example.com')),
    ).toThrow('不支持的视频服务商');
  });

  it('retries a TLS connection reset before creating the task', async () => {
    const networkError = Object.assign(new TypeError('fetch failed'), {
      cause: {
        code: 'ECONNRESET',
        message:
          'Client network socket disconnected before secure TLS connection was established',
      },
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(response({ id: 'network-retry' }));

    await expect(
      genVideo({
        runtimeModel: model('general-video', 'https://api.91token.com/v1'),
        message: [{ type: 'text', text: '测试断线重试' }],
        config: { ratio: '16:9' },
      }),
    ).resolves.toEqual({ task_id: 'network-retry' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
