import {
  createdTaskId,
  readVideoResponse,
  videoEndpoint,
  videoFetch,
  videoHeaders,
} from './http';
import { queryOpenVideo } from './open-video';
import type { VideoProvider, VideoProviderRequest } from './types';

const normalizeH3Prompt = (request: VideoProviderRequest) => {
  const prompt =
    request.prompt.trim() || 'Use the supplied references to create this shot.';
  const references = request.media.filter((item) =>
    ['reference_image', 'reference_video'].includes(item.type),
  );
  if (references.length) {
    if (
      [
        'subject_definitions:',
        'summary:',
        'retention_analysis:',
        'detailed_description:',
        'overall_soundscape:',
        'non_diegetic_music:',
      ].every((field) => prompt.includes(field))
    ) {
      return prompt;
    }
    let pictureIndex = 0;
    let videoIndex = 0;
    const labels = references.map((item) =>
      item.type === 'reference_video'
        ? `<Video ${++videoIndex}>`
        : `<Picture ${++pictureIndex}>`,
    );
    return [
      `subject_definitions: ${labels.map((label) => `${label} is a supplied reference for this shot.`).join(' ')}`,
      `summary: ${prompt}`,
      `retention_analysis: ${labels.map((label) => `${label} (appears in [Shot 1]): fully_preserved - Preserve the relevant identity, composition and visual attributes from this reference.`).join(' ')}`,
      `detailed_description: [Shot 1] ${prompt}`,
      'overall_soundscape: Follow the ambience, synchronized sound effects and dialogue described in the shot.',
      'non_diegetic_music: N/A',
    ].join('\n');
  }
  if (
    request.media.length &&
    !prompt.includes('integrated_multimodal_description:')
  ) {
    return [
      `integrated_multimodal_description: [Shot 1] ${prompt}`,
      'overall_soundscape: Follow the ambience, synchronized sound effects and dialogue described in the shot.',
      'non_diegetic_music: N/A',
    ].join('\n');
  }
  return prompt;
};

export const generalVideoProvider: VideoProvider = {
  async create(request, model) {
    const resolution = request.config?.resolution || '720P';
    const normalizedResolution =
      model.modelId === 'MiniMax-H3'
        ? resolution === '2K' || resolution === '1080P'
          ? '2K'
          : '768P'
        : resolution.toLowerCase();
    const content = request.media.map((item) =>
      item.type === 'reference_video'
        ? { type: 'video_url', video_url: { url: item.url }, role: item.type }
        : { type: 'image_url', image_url: { url: item.url }, role: item.type },
    );
    const prompt =
      model.modelId === 'MiniMax-H3'
        ? normalizeH3Prompt(request)
        : request.prompt;
    const data = await videoFetch(videoEndpoint(model, '/video/generations'), {
      method: 'POST',
      headers: videoHeaders(model),
      body: JSON.stringify({
        model: model.modelId,
        prompt,
        duration: request.config?.duration || 5,
        metadata: {
          content,
          return_last_frame: request.config?.extractLastFrame,
          resolution: normalizedResolution,
          ratio: request.config?.ratio || '16:9',
          duration: request.config?.duration || 5,
          watermark: false,
        },
      }),
    }).then(readVideoResponse);
    return { taskId: createdTaskId(data) };
  },
  query: queryOpenVideo,
};
