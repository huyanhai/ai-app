import {
  createdTaskId,
  readVideoResponse,
  videoFetch,
  videoHeaders,
} from './http';
import type { RuntimeModel } from '..';
import type { VideoProvider } from './types';

const viduEndpoint = (model: RuntimeModel, path: string) => {
  const baseURL = model.baseURL.replace(/\/+$/, '');
  const normalizedBaseURL = baseURL === 'https://api.91token.com/v1'
    ? `${baseURL}/ent/v2`
    : baseURL;
  return `${normalizedBaseURL}${path}`;
};

export const viduProvider: VideoProvider = {
  async create(request, model) {
    if (request.media.some((item) => item.type === 'reference_video')) {
      throw new Error('Vidu 当前接入不支持参考视频输入');
    }
    const firstFrame = request.media.find(
      (item) => item.type === 'first_frame',
    )?.url;
    const lastFrame = request.media.find(
      (item) => item.type === 'last_frame',
    )?.url;
    const references = request.media
      .filter((item) => item.type === 'reference_image')
      .map((item) => item.url);
    if (lastFrame && !firstFrame)
      throw new Error('Vidu 首尾帧模式需要同时提供首帧和尾帧');
    if (firstFrame && lastFrame && references.length) {
      throw new Error('Vidu 首尾帧模式不能同时传入其他参考图');
    }
    const framed = Boolean(firstFrame && lastFrame);
    const images = framed
      ? [firstFrame!, lastFrame!]
      : firstFrame
        ? [firstFrame, ...references]
        : references;
    const path = framed
      ? '/start-end2video'
      : images.length
        ? '/image2video'
        : '/text2video';
    const resolution = request.config?.resolution || '720P';
    const data = await videoFetch(viduEndpoint(model, path), {
      method: 'POST',
      headers: videoHeaders(model),
      body: JSON.stringify({
        model: model.modelId,
        prompt: request.prompt,
        ...(images.length ? { images } : {}),
        duration: request.config?.duration || 5,
        resolution: model.modelId === 'viduq3-turbo' && resolution === '480P'
          ? '720p'
          : resolution.toLowerCase(),
        aspect_ratio: request.config?.ratio || '16:9',
        movement_amplitude: 'auto',
      }),
    }).then(readVideoResponse);
    return { taskId: createdTaskId(data) };
  },

  async query(taskId, model) {
    const data = await videoFetch(
      viduEndpoint(model, `/tasks/${taskId}/creations`),
      {
        headers: videoHeaders(model, false),
      },
    ).then(readVideoResponse);
    if (data?.state === 'success') {
      if (!data?.creations?.[0]?.url) {
        return {
          status: 'failed' as const,
          error: 'Vidu 任务完成但未返回视频地址',
        };
      }
      return {
        status: 'succeeded' as const,
        videoUrl: data?.creations?.[0]?.url,
      };
    }
    if (data?.state === 'failed') {
      return {
        status: 'failed' as const,
        error: data?.err_code || data?.payload || 'Vidu 视频生成任务失败',
      };
    }
    return { status: 'pending' as const };
  },
};
