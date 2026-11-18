/// <reference types="jest" />
import { genImage } from './gen-image';

describe('genImage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects with the upstream error message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        error: { message: 'image model unavailable' },
      }),
    } as unknown as Response);

    await expect(
      genImage({
        message: [{ type: 'text', text: 'a cat' }],
        config: { ratio: '1:1' },
        runtimeModel: {
          id: 'model-config-id',
          provider: 'test-provider',
          baseURL: 'https://example.com',
          apiKey: 'test-key',
          modelId: 'image-model',
          params: '{}',
        },
      }),
    ).rejects.toThrow('image model unavailable');
  });

  it('sends the source image to the edits endpoint in edit mode', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['image'])),
      } as unknown as Response)
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ data: [{ url: 'result.png' }] }),
      } as unknown as Response);

    await genImage({
      message: [
        { type: 'image_url', image_url: 'source.png' },
        { type: 'text', text: 'improve the marked area' },
      ],
      config: { ratio: '1:1', edit: true },
      runtimeModel: {
        id: 'model-config-id',
        provider: 'test-provider',
        baseURL: 'https://example.com',
        apiKey: 'test-key',
        modelId: 'image-model',
        params: '{}',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/images/edits');
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData);
    expect((fetchMock.mock.calls[1][1]?.body as FormData).get('size')).toBe('1024x1024');
    expect(fetchMock.mock.calls[2][0]).toBe('result.png');
  });

  it('sends the configured portrait size to the generations endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({ data: [{ url: 'result.png' }] }),
    } as unknown as Response);

    await genImage({
      message: [{ type: 'text', text: 'a full-body character' }],
      config: { ratio: '3:4' },
      runtimeModel: {
        id: 'model-config-id', provider: 'test-provider', baseURL: 'https://example.com',
        apiKey: 'test-key', modelId: 'image-model', params: '{}',
      },
    });

    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init?.body as string).size).toBe('1152x1536');
  });

  it('applies the configured resolution while preserving the aspect ratio', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      json: jest.fn().mockResolvedValue({ data: [{ url: 'result.png' }] }),
    } as unknown as Response);

    await genImage({
      message: [{ type: 'text', text: 'a full-body character' }],
      config: { ratio: '3:4', resolution: '2K' },
      runtimeModel: {
        id: 'model-config-id', provider: 'test-provider', baseURL: 'https://example.com',
        apiKey: 'test-key', modelId: 'image-model', params: '{}',
      },
    });

    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init?.body as string).size).toBe('1536x2048');
  });

  it('sets a landscape output size for outpainting', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['image'])),
      } as unknown as Response)
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ data: [{ url: 'result.png' }] }),
      } as unknown as Response);

    await genImage({
      message: [
        { type: 'image_url', image_url: 'source.png' },
        { type: 'text', text: 'extend the scene' },
      ],
      config: { ratio: '16:9', edit: true, outpaint: true },
      runtimeModel: {
        id: 'model-config-id', provider: 'test-provider', baseURL: 'https://example.com',
        apiKey: 'test-key', modelId: 'image-model', params: '{}',
      },
    });

    const form = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(form.get('size')).toBe('1536x1024');
  });

  it('uses the reference image and landscape size for presets', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob(['image'])),
      } as unknown as Response)
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ data: [{ url: 'result.png' }] }),
      } as unknown as Response);

    await genImage({
      message: [
        { type: 'image_url', image_url: 'source.png' },
        { type: 'text', text: 'create a character three-view' },
      ],
      config: { ratio: '16:9', edit: true, preset: 'character-three-view' },
      runtimeModel: {
        id: 'model-config-id', provider: 'test-provider', baseURL: 'https://example.com',
        apiKey: 'test-key', modelId: 'image-model', params: '{}',
      },
    });

    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/images/edits');
    const form = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(form.get('image')).toBeInstanceOf(Blob);
    expect(form.get('size')).toBe('1536x864');
    expect(form.get('prompt')).toContain('[图片1]');
  });

  it('retries when the generated image does not match the configured ratio', async () => {
    const png = (width: number, height: number) => {
      const buffer = Buffer.alloc(24);
      buffer.write('PNG', 1);
      buffer.writeUInt32BE(width, 16);
      buffer.writeUInt32BE(height, 20);
      return buffer;
    };
    const generated = (url: string) => ({
      json: jest.fn().mockResolvedValue({ data: [{ url }] }),
    }) as unknown as Response;
    const image = (buffer: Buffer) => ({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: jest.fn().mockResolvedValue(buffer.buffer),
    }) as unknown as Response;
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(generated('portrait.png'))
      .mockResolvedValueOnce(image(png(1024, 1536)))
      .mockResolvedValueOnce(generated('landscape.png'))
      .mockResolvedValueOnce(image(png(1536, 864)));

    const result = await genImage({
      message: [{ type: 'text', text: 'a tall palm tree' }],
      config: { ratio: '16:9' },
      runtimeModel: {
        id: 'model-config-id', provider: 'test-provider', baseURL: 'https://example.com',
        apiKey: 'test-key', modelId: 'image-model', params: '{}',
      },
    });

    expect(result.content).toEqual([{ image: 'landscape.png' }]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const call of [fetchMock.mock.calls[0], fetchMock.mock.calls[2]]) {
      const body = JSON.parse(call[1]?.body as string);
      expect(body.size).toBe('1536x864');
      expect(body.prompt).toContain('必须严格采用 16:9');
    }
  });
});
