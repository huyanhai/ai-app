import { VideoModeType } from "../pipeline/types";

// 模型类别
export enum ModelCategory {
  Text = "text",
  Image = "image",
  Video = "video",
  Audio = "audio",
}

// 文本模型参数
export type TTextModelParams = {
  temperature: number; // 温度
  maxTokens: number; // 最大输出 token
  contextWindow: number; // 上下文长度（K）
  supportTools: boolean; // 支持工具调用
  supportVision: boolean; // 支持图片理解
};

// 图片模型参数
export type TImageModelParams = {
  resolutions: string[]; // 支持的清晰度
  ratios: string[]; // 支持的比例
  maxCount: number; // 单次最多生成张数
  supportReference: boolean; // 支持参考图
};

// 视频模型参数
export type TVideoModelParams = {
  resolutions: string[]; // 支持的清晰度
  durations: number[]; // 支持的时长（秒）
  modes: VideoModeType[]; // 支持的生成模式
};

// 音频模型参数
export type TAudioModelParams = {
  formats: string[]; // 输出格式
  sampleRate: number; // 采样率
  voice: string; // 默认音色
  supportClone: boolean; // 支持音色克隆
};

export type TModelParamsMap = {
  [ModelCategory.Text]: TTextModelParams;
  [ModelCategory.Image]: TImageModelParams;
  [ModelCategory.Video]: TVideoModelParams;
  [ModelCategory.Audio]: TAudioModelParams;
};

type TModelBase = {
  id: string;
  name: string; // 显示名称
  provider: string; // 服务商 id
  modelId: string; // 调用时传给接口的模型标识
  baseURL: string; // 接口地址
  apiKey: string; // 密钥
  hasApiKey?: boolean; // 后端是否已保存密钥（列表不返回明文）
  isDefault?: boolean;
  enabled: boolean; // 是否启用
  description?: string; // 备注
  createdAt: number;
};

export type TModelConfigOf<C extends ModelCategory> = TModelBase & {
  category: C;
  params: TModelParamsMap[C];
};

export type TModelConfig = {
  [C in ModelCategory]: TModelConfigOf<C>;
}[ModelCategory];
