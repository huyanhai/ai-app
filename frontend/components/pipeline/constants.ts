import { NodeType, TAllNodes, VideoModeType } from "./types";

export const SOURCE_HANDLE = "source";
export const TARGET_HANDLE = "target";

// 各节点类型的中文名称
export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  [NodeType.TextNode]: "文本",
  [NodeType.ImageNode]: "图片",
  [NodeType.VideoNode]: "视频",
  [NodeType.AudioNode]: "音频",
  [NodeType.TimelineNode]: "时间线",
  [NodeType.SubjectNode]: "主体",
  [NodeType.StageNode]: "导演台",
};

// 生成类节点提示词占位文案（对齐即梦）
export const NODE_PROMPT_PLACEHOLDER: Partial<Record<NodeType, string>> = {
  [NodeType.TextNode]:
    "通过 AI 生成文本内容，可以添加图片、视频、音频或文档作为生成参考",
  [NodeType.ImageNode]: "上传参考图、输入文字或 @ 主体，描述你想生成的图片",
  [NodeType.VideoNode]: "上传参考图、输入文字或 @ 主体，描述你想生成的视频",
  [NodeType.AudioNode]:
    "输入台词并描述声音，可上传参考音频，通过 @ 引用多个音色，使用时间戳编排人声、音效与配乐。",
};

// 生成价格展示（对齐即梦）
export const NODE_PRICE: Partial<Record<NodeType, string>> = {
  [NodeType.ImageNode]: "3 / 张",
  [NodeType.VideoNode]: "56",
  [NodeType.AudioNode]: "12",
};

// 各节点类型的默认数据
export const NODE_DEFAULT_DATA: Record<NodeType, TAllNodes["data"]> = {
  [NodeType.TextNode]: { text: "" },
  [NodeType.ImageNode]: {
    url: "",
    config: {
      ratio: "1:1",
      resolution: "2K",
      count: 1,
      model: "Seedream 5.0 Lite",
    },
  },
  [NodeType.VideoNode]: {
    url: "",
    config: {
      videoMode: VideoModeType.TextToVideo,
      ratio: "1:1",
      duration: 4,
      resolution: "720P",
      count: 1,
      model: "即梦 Seedance 2.0",
    },
  },
  [NodeType.AudioNode]: {
    url: "",
    config: { model: "SeedAudio 1.0" },
  },
  [NodeType.TimelineNode]: {},
  [NodeType.SubjectNode]: { name: "主体 1" },
  [NodeType.StageNode]: {},
};
