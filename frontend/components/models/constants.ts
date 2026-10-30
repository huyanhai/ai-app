import {
  AudioLines,
  Image as ImageIcon,
  LucideIcon,
  Type,
  Video,
} from "lucide-react";
import { VideoModeType } from "../pipeline/types";
import { ModelCategory, TModelParamsMap } from "./types";

// 模型类别展示信息
export const MODEL_CATEGORIES: {
  value: ModelCategory;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: ModelCategory.Text,
    label: "文本",
    description: "对话、脚本创作、提示词优化等文本生成能力",
    icon: Type,
  },
  {
    value: ModelCategory.Image,
    label: "图片",
    description: "文生图、图生图、参考图生成等图像能力",
    icon: ImageIcon,
  },
  {
    value: ModelCategory.Video,
    label: "视频",
    description: "文生视频、图生视频、首尾帧生成等视频能力",
    icon: Video,
  },
  {
    value: ModelCategory.Audio,
    label: "音频",
    description: "语音合成、音效与配乐生成等音频能力",
    icon: AudioLines,
  },
];

export const MODEL_CATEGORY_LABEL: Record<ModelCategory, string> = {
  [ModelCategory.Text]: "文本",
  [ModelCategory.Image]: "图片",
  [ModelCategory.Video]: "视频",
  [ModelCategory.Audio]: "音频",
};

// 服务商预设，选中后自动填充接口地址
export const MODEL_PROVIDERS: {
  value: string;
  label: string;
  baseURL: string;
  categories: ModelCategory[];
}[] = [
  {
    value: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    categories: Object.values(ModelCategory),
  },
  {
    value: "anthropic",
    label: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    categories: [ModelCategory.Text],
  },
  {
    value: "google",
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    categories: Object.values(ModelCategory),
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    categories: [ModelCategory.Text],
  },
  {
    value: "dashscope",
    label: "阿里云百炼",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    categories: Object.values(ModelCategory),
  },
  {
    value: "volcengine",
    label: "火山方舟",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    categories: Object.values(ModelCategory),
  },
  {
    value: "siliconflow",
    label: "硅基流动",
    baseURL: "https://api.siliconflow.cn/v1",
    categories: Object.values(ModelCategory),
  },
  {
    value: "elevenlabs",
    label: "ElevenLabs",
    baseURL: "https://api.elevenlabs.io/v1",
    categories: [ModelCategory.Audio],
  },
  {
    value: "custom",
    label: "自定义",
    baseURL: "",
    categories: Object.values(ModelCategory),
  },
];

export const getProvider = (value: string) =>
  MODEL_PROVIDERS.find((item) => item.value === value);

// 可选项（与画布生成卡片的配置保持一致）
export const IMAGE_RESOLUTIONS = ["1K", "2K", "4K"];
export const VIDEO_RESOLUTIONS = ["480P", "720P", "1080P"];
export const MODEL_RATIOS = [
  "1:1",
  "9:16",
  "16:9",
  "3:4",
  "4:3",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];
export const VIDEO_DURATIONS = [4, 5, 10, 15];
export const VIDEO_MODES: { value: VideoModeType; label: string }[] = [
  { value: VideoModeType.TextToVideo, label: "文生视频" },
  { value: VideoModeType.ImageToVideo, label: "图生视频" },
  { value: VideoModeType.FirstAndLastFrameToVideo, label: "首尾帧" },
];
export const AUDIO_FORMATS = ["mp3", "wav", "pcm", "flac", "opus"];
export const AUDIO_SAMPLE_RATES = [16000, 24000, 32000, 44100, 48000];

// 各类别新建模型时的默认参数
export const DEFAULT_MODEL_PARAMS: TModelParamsMap = {
  [ModelCategory.Text]: {
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 128,
    supportTools: true,
    supportVision: false,
  },
  [ModelCategory.Image]: {
    resolutions: ["1K", "2K"],
    ratios: ["1:1", "9:16", "16:9", "3:4", "4:3"],
    maxCount: 4,
    supportReference: true,
  },
  [ModelCategory.Video]: {
    resolutions: ["720P", "1080P"],
    durations: [4, 5, 10],
    modes: [VideoModeType.TextToVideo, VideoModeType.ImageToVideo],
  },
  [ModelCategory.Audio]: {
    formats: ["mp3", "wav"],
    sampleRate: 24000,
    voice: "",
    supportClone: false,
  },
};
