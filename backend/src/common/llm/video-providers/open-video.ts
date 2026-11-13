import {
  openVideoResult,
  readVideoResponse,
  videoEndpoint,
  videoFetch,
  videoHeaders,
} from './http';
import type { RuntimeModel } from '..';

export async function queryOpenVideo(taskId: string, model: RuntimeModel) {
  const data = await videoFetch(
    videoEndpoint(model, `/video/generations/${taskId}`),
    {
      headers: videoHeaders(model, false),
    },
  ).then(readVideoResponse);
  return openVideoResult(data);
}
