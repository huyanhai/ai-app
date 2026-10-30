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
  } = {},
) =>
  new ChatOpenAI({
    model: model.modelId,
    apiKey: model.apiKey,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    streaming: options.streaming,
    configuration: { baseURL: model.baseURL },
  });
