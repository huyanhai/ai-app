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
});
