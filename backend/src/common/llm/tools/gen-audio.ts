import { StreamDto } from '@/modules/pipeline/dto/stream.dto';
import { RuntimeModel } from '..';

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pcm: 'audio/pcm',
};

async function genDashscopeAudio(
  input: string,
  runtimeModel: RuntimeModel,
  params: { formats?: string[]; sampleRate?: number },
) {
  const format = params.formats?.[0] || 'wav';
  const origin = new URL(runtimeModel.baseURL).origin;
  const response = await fetch(
    `${origin}/api/v1/services/audio/tts/SpeechSynthesizer`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtimeModel.apiKey}`,
      },
      body: JSON.stringify({
        model: runtimeModel.modelId,
        input: {
          text_prompt: input,
          format,
          sample_rate: params.sampleRate || 48000,
          channels: 2,
        },
      }),
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.error?.message ||
        data?.message ||
        `音频接口请求失败（${response.status}）`,
    );
  }

  const data = await response.json();
  if (data.code) throw new Error(data.message || '音频生成失败');
  const audio = data.output?.audio;
  if (audio?.url) return audio.url;
  const audioData = audio?.data || audio?.audio;
  if (!audioData) throw new Error('音频接口未返回音频数据');
  return `data:${MIME_TYPES[format] || 'audio/wav'};base64,${audioData}`;
}

export async function genAudio({
  message,
  textList,
  runtimeModel,
}: StreamDto & { runtimeModel: RuntimeModel }) {
  const input = [
    ...message.map((item) => ('text' in item ? item.text : '')),
    ...(textList?.map((item) => item.action_input) ?? []),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
  if (!input) throw new Error('请输入音频台词或关联文本节点');

  const params = JSON.parse(runtimeModel.params || '{}');
  if (runtimeModel.provider === 'dashscope') {
    return genDashscopeAudio(input, runtimeModel, params);
  }
  const format = params.formats?.[0] || 'mp3';
  const response = await fetch(`${runtimeModel.baseURL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${runtimeModel.apiKey}`,
    },
    body: JSON.stringify({
      model: runtimeModel.modelId,
      input,
      voice: params.voice || 'alloy',
      response_format: format,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.error?.message ||
        data?.message ||
        `音频接口请求失败（${response.status}）`,
    );
  }
  const audio = Buffer.from(await response.arrayBuffer()).toString('base64');
  return `data:${MIME_TYPES[format] || 'audio/mpeg'};base64,${audio}`;
}
