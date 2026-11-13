import {
  createdTaskId,
  openVideoResult,
  readVideoResponse,
  videoEndpoint,
  videoFetch,
  videoHeaders,
} from './http';
import type { VideoProvider } from './types';

export const seedanceProvider: VideoProvider = {
  async create(request, model) {
    const content = [
      { type: 'text', text: request.prompt },
      ...request.media.map((item) =>
        item.type === 'reference_video'
          ? { type: 'video_url', video_url: { url: item.url }, role: item.type }
          : {
              type: 'image_url',
              image_url: { url: item.url },
              role: item.type,
            },
      ),
    ];
    const data = await videoFetch(
      videoEndpoint(model, '/contents/generations/tasks'),
      {
        method: 'POST',
        headers: videoHeaders(model),
        body: JSON.stringify({
          model: model.modelId,
          content,
          resolution: (request.config?.resolution || '720P').toLowerCase(),
          ratio: request.config?.ratio || '16:9',
          duration: request.config?.duration || 5,
          return_last_frame: request.config?.extractLastFrame,
          watermark: false,
        }),
      },
    ).then(readVideoResponse);
    return { taskId: createdTaskId(data) };
  },

  async query(taskId, model) {
    const data = await videoFetch(
      videoEndpoint(model, `/contents/generations/tasks/${taskId}`),
      { headers: videoHeaders(model, false) },
    ).then(readVideoResponse);
    return openVideoResult(data);
  },
};
