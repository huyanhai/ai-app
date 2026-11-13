import type { RuntimeModel } from '..';

type VideoNetworkError = Error & {
  cause?: { code?: string; message?: string };
};

const retryableConnectionError = (error: unknown) => {
  const cause = (error as VideoNetworkError)?.cause;
  if (
    ['ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(
      cause?.code || '',
    )
  ) {
    return true;
  }
  return cause?.code === 'ECONNRESET' &&
    /before secure TLS|TLS connection|handshake/i.test(cause.message || '');
};

export async function videoFetch(input: string | URL, init?: RequestInit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (attempt === 2 || !retryableConnectionError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error('视频服务连接失败');
}

export function videoErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as VideoNetworkError).cause;
  if (error.message === 'fetch failed' && cause) {
    return `视频服务连接失败${cause.code ? `（${cause.code}）` : ''}，请重试${cause.message ? `：${cause.message}` : ''}`;
  }
  return error.message;
}

export const videoEndpoint = (model: RuntimeModel, path: string) =>
  `${model.baseURL.replace(/\/+$/, '')}${path}`;

export const videoHeaders = (model: RuntimeModel, json = true) => ({
  Authorization: `Bearer ${model.apiKey}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

export async function readVideoResponse(response: Response) {
  const data = await response.json().catch(() => null);
  const error = data?.error;
  const code = data?.code;
  const businessError =
    code && ![0, '0', 200, '200', 'success', 'SUCCESS'].includes(code);
  if (!response.ok || error || businessError) {
    throw new Error(
      error?.message ||
        (typeof error === 'string' ? error : undefined) ||
        data?.message ||
        `视频接口请求失败（${response.status}）`,
    );
  }
  if (!data) throw new Error('视频接口返回了无效响应');
  return data;
}

export function createdTaskId(data: any) {
  const taskId = data?.task_id || data?.taskId || data?.id;
  if (!taskId) throw new Error('视频生成接口未返回任务 ID');
  return String(taskId);
}

export function openVideoResult(data: any) {
  const value = data?.data?.task_id || data?.data?.status ? data.data : data;
  const status = String(value?.status || '').toLowerCase();
  const videoUrl =
    value?.result_url || value?.metadata?.url || value?.content?.video_url;
  if (['success', 'succeeded', 'completed'].includes(status)) {
    if (!videoUrl)
      return {
        status: 'failed' as const,
        error: '视频生成完成但未返回视频地址',
      };
    return {
      status: 'succeeded' as const,
      videoUrl,
      lastFrameUrl: value?.content?.last_frame_url,
    };
  }
  if (
    ['failed', 'failure', 'cancelled', 'canceled', 'expired'].includes(status)
  ) {
    return {
      status: 'failed' as const,
      error: value?.fail_reason || value?.message || '视频生成任务失败',
    };
  }
  if (!status)
    return { status: 'failed' as const, error: '视频任务查询未返回状态' };
  return { status: 'pending' as const };
}
