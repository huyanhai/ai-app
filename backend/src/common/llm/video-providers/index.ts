import type { RuntimeModel } from '..';
import { dashscopeProvider } from './dashscope';
import { generalVideoProvider } from './general';
import { grokVideoProvider } from './grok';
import { seedanceProvider } from './seedance';
import type { VideoProvider } from './types';
import { viduProvider } from './vidu';
import { wan3Provider } from './wan3';

const providers: Record<string, VideoProvider> = {
  dashscope: dashscopeProvider,
  volcengine: seedanceProvider,
  seedance: seedanceProvider,
  'grok-video': grokVideoProvider,
  'general-video': generalVideoProvider,
  openai: generalVideoProvider,
  google: generalVideoProvider,
  siliconflow: generalVideoProvider,
  custom: generalVideoProvider,
  vidu: viduProvider,
  wan3: wan3Provider,
};

export function getVideoProvider(model: RuntimeModel) {
  const provider = providers[model.provider];
  if (!provider) throw new Error(`不支持的视频服务商：${model.provider}`);
  return provider;
}

export type {
  VideoProvider,
  VideoProviderRequest,
  VideoProviderResult,
} from './types';
