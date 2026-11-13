import { ChatOpenAI } from '@langchain/openai';
import { ModelConfig } from '@prisma/client';

export type RuntimeModel = Pick<
  ModelConfig,
  'id' | 'provider' | 'modelId' | 'baseURL' | 'apiKey' | 'params'
>;

export const createChatModel = (
  model: RuntimeModel,
  options: {
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
    timeout?: number;
    maxRetries?: number;
    modelKwargs?: Record<string, unknown>;
  } = {},
) =>
  new ChatOpenAI({
    model: model.modelId,
    apiKey: model.apiKey,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    streaming: options.streaming,
    timeout: options.timeout,
    maxRetries: options.maxRetries,
    modelKwargs: options.modelKwargs,
    configuration: { baseURL: model.baseURL },
  });
