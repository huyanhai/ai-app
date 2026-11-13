import {
  createdTaskId,
  readVideoResponse,
  videoEndpoint,
  videoFetch,
  videoHeaders,
} from './http';
import type { VideoProvider } from './types';

export const wan3Provider: VideoProvider = {
  async create(request, model) {
    if (
      request.media.some((item) => item.type === 'reference_video') &&
      !model.modelId.startsWith('wan3.0-video')
    ) {
      throw new Error(
        '当前模型不支持原生视频参考，请选择 wan3.0-video 或 wan3.0-video-prime',
      );
    }
    const data = await videoFetch(
      videoEndpoint(model, '/services/aigc/video-generation/video-synthesis'),
      {
        method: 'POST',
        headers: { ...videoHeaders(model), 'X-DashScope-Async': 'enable' },
        body: JSON.stringify({
          model: model.modelId,
          input: { prompt: request.prompt, media: request.media },
          parameters: {
            resolution: request.config?.resolution || '720P',
            duration: request.config?.duration || 5,
            prompt_extend: request.config?.promptExtend ?? true,
            watermark: false,
            ratio: request.config?.ratio || '16:9',
          },
        }),
      },
    ).then(readVideoResponse);
    return { taskId: createdTaskId(data?.output) };
  },

  async query(taskId, model) {
    const data = await videoFetch(videoEndpoint(model, `/tasks/${taskId}`), {
      headers: videoHeaders(model, false),
    }).then(readVideoResponse);
    const output = data?.output;
    const status = String(output?.task_status || '').toUpperCase();
    if (status === 'SUCCEEDED') {
      return { status: 'succeeded', videoUrl: output?.video_url };
    }
    if (['FAILED', 'CANCELED'].includes(status)) {
      return {
        status: 'failed',
        error: output?.message || 'Wan3 视频生成任务失败',
      };
    }
    return { status: 'pending' };
  },
};
