import { ChatOpenAI } from '@langchain/openai';

export const model: ChatOpenAI = new ChatOpenAI({
  model: process.env.OPEN_BASE_MODEL,
  apiKey: process.env.OPEN_API_KEY,
  configuration: {
    baseURL: process.env.OPEN_BASE_URL,
  },
});

// 工具调用有问题
export const senModel: ChatOpenAI = new ChatOpenAI({
  model: process.env.SEN_BASE_MODEL,
  apiKey: process.env.SEN_API_KEY,
  streaming: false,
  configuration: {
    baseURL: process.env.SEN_BASE_URL,
  },
});

// 可以正常调用工具
export const alMode: ChatOpenAI = new ChatOpenAI({
  model: process.env.ALI_BASE_MODEL,
  apiKey: process.env.ALI_API_KEY,
  temperature: 0.7,
  streaming: true,
  configuration: {
    baseURL: process.env.ALI_BASE_URL,
  },
});

export const imageMode: ChatOpenAI = new ChatOpenAI({
  model: process.env.ALI_IMAGE_MODEL,
  apiKey: process.env.ALI_API_KEY,
  temperature: 0.7,
  streaming: false,
  configuration: {
    baseURL: process.env.ALI_BASE_URL,
  },
});
