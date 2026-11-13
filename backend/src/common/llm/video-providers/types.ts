import type { StreamDto } from '@/modules/pipeline/dto/stream.dto';
import type { RuntimeModel } from '..';

export type VideoMediaType =
  | 'reference_image'
  | 'reference_video'
  | 'first_frame'
  | 'last_frame';

export type VideoProviderRequest = {
  prompt: string;
  media: { type: VideoMediaType; url: string }[];
  config: StreamDto['config'];
};

export type VideoProviderResult = {
  status: 'pending' | 'succeeded' | 'failed';
  videoUrl?: string;
  lastFrameUrl?: string;
  error?: string;
};

export interface VideoProvider {
  create(
    request: VideoProviderRequest,
    model: RuntimeModel,
  ): Promise<{ taskId: string }>;
  query(taskId: string, model: RuntimeModel): Promise<VideoProviderResult>;
}
