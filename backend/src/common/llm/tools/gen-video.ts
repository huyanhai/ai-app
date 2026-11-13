import { ContentBlock, tool } from 'langchain';
import * as z from 'zod';
import { StreamDto } from '../../../modules/pipeline/dto/stream.dto';
import { RuntimeModel } from '..';
import { getVideoProvider } from '../video-providers';
import type {
  VideoMediaType,
  VideoProviderRequest,
} from '../video-providers/types';

const normalizeRequest = ({
  message,
  config,
  textList,
}: StreamDto): VideoProviderRequest => {
  let prompt = '';
  let imageIndex = 0;
  let videoIndex = 0;
  const media: { type: VideoMediaType; url: string }[] = [];
  message.forEach((item: ContentBlock) => {
    if (item.type === 'text') prompt += `${item.text}\n`;
    if (item.type === 'image_url') {
      prompt += `[图片${imageIndex++}]`;
      media.push({ type: 'reference_image', url: item.image_url as string });
    }
    if (item.type === 'video_url') {
      prompt += `[视频${videoIndex++}]`;
      media.push({ type: 'reference_video', url: item.video_url as string });
    }
  });
  if (config?.firstFrameUrl)
    media.push({ type: 'first_frame', url: config.firstFrameUrl });
  if (config?.lastFrameUrl)
    media.push({ type: 'last_frame', url: config.lastFrameUrl });
  textList?.forEach((item) => {
    prompt += `${item.action_input}\n${item.supplementary?.style || ''}\n`;
  });
  return { prompt, media, config };
};

export async function genVideo(
  input: StreamDto & { runtimeModel: RuntimeModel },
) {
  const { taskId } = await getVideoProvider(input.runtimeModel).create(
    normalizeRequest(input),
    input.runtimeModel,
  );
  return { task_id: taskId };
}

export async function queryVideoTask(
  taskId: string,
  runtimeModel: RuntimeModel,
) {
  const result = await getVideoProvider(runtimeModel).query(
    taskId,
    runtimeModel,
  );
  return {
    output: {
      task_status:
        result.status === 'succeeded'
          ? 'SUCCEEDED'
          : result.status === 'failed'
            ? 'FAILED'
            : 'RUNNING',
      video_url: result.videoUrl,
      last_frame_url: result.lastFrameUrl,
      message: result.error,
    },
  };
}

export const createGenVideoTool = (runtimeModel: RuntimeModel): any =>
  tool(
    async ({ prompt }) => {
      return genVideo({
        runtimeModel,
        message: [{ type: 'text', text: prompt }],
        textList: [],
        config: { videoMode: 'textToVideo', duration: 5, ratio: '16:9' },
      });
    },
    {
      name: '视频生成',
      description: '当用户需要生成视频的时候，使用此工具进行视频生成',
      schema: z.object({ prompt: z.string().describe('生成视频的提示词') }),
    },
  );
