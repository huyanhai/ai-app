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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/images/edits');
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData);
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
});
