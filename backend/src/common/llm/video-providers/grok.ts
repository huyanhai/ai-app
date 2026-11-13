import {
  createdTaskId,
  readVideoResponse,
  videoEndpoint,
  videoFetch,
  videoHeaders,
} from './http';
import { queryOpenVideo } from './open-video';
import type { VideoProvider } from './types';

export const grokVideoProvider: VideoProvider = {
  async create(request, model) {
    if (request.media.some((item) => item.type === 'reference_video')) {
      throw new Error('Grok 视频不支持参考视频输入');
    }
    if (request.media.some((item) => item.type === 'last_frame')) {
      throw new Error('Grok 视频不支持首尾帧模式');
    }
    const images = request.media.map((item) => item.url);
    if (!images.length) throw new Error('Grok 视频需要至少一张参考图');
    if (
      model.modelId === 'grok-imagine-video-1.5-preview' &&
      images.length > 1
    ) {
      throw new Error(
        'grok-imagine-video-1.5-preview 仅支持单图，请使用 grok-imagine-video',
      );
    }
    if (images.length > 7) throw new Error('Grok 视频最多支持 7 张参考图');
    const data = await videoFetch(videoEndpoint(model, '/video/generations'), {
      method: 'POST',
      headers: videoHeaders(model),
      body: JSON.stringify({
        model: model.modelId,
        prompt: request.prompt,
        ...(images.length === 1
          ? { image: images[0] }
          : { metadata: { reference_images: images } }),
        duration: request.config?.duration || 4,
        ratio: request.config?.ratio || '16:9',
        resolution: request.config?.resolution || '720P',
        seed: 47,
      }),
    }).then(readVideoResponse);
    return { taskId: createdTaskId(data) };
  },
  query: queryOpenVideo,
};
