import { Node } from "@xyflow/react";
import { IMediaData } from "backend/src/common/utils/ai-stream-utils";
import { TextScene } from "backend/src/common/utils/text-scene";
import { HumanMessage } from "langchain";

export type TRatio = `${number}:${number}`;

// 导演工具箱选择（相机 / 运镜 / 配色 / 风格）
export type TNodeToolbox = {
  camera?: {
    camera?: string; // 相机
    lens?: string; // 镜头
    focal?: string; // 焦距
    aperture?: string; // 光圈
  };
  movement?: string; // 运镜名称
  palette?: string; // 配色方案名称
  style?: string; // 风格名称
};

export enum Placement {
  Top = "top",
  Bottom = "bottom",
}

export enum NodeType {
  TextNode = "textNode",
  ImageNode = "imageNode",
  VideoNode = "videoNode",
  AudioNode = "audioNode",
  TimelineNode = "timelineNode",
  SubjectNode = "subjectNode",
  StageNode = "stageNode",
}

export enum VideoModeType {
  // 文生视频
  TextToVideo = "textToVideo",
  // 图生成视频
  ImageToVideo = "imageToVideo",
  // 首尾帧生成视频
  FirstAndLastFrameToVideo = "firstAndLastFrameToVideo",
}

export type TNodeBase = {
  title?: string; // 节点标题（创建时自动编号，如 图片 1）
  labelColor?: string; // 节点右上角标签色
  config?: {
    ratio?: TRatio; // 比例
    videoMode?: VideoModeType; // 生图模式
    duration?: number; // 视频时长
    firstFrameUrl?: string; // 首帧图片
    lastFrameUrl?: string; // 尾帧图片
    resolution?: string; // 清晰度
    count?: number; // 生成数量
    model?: string; // 模型
    scene?: TextScene; // 文本节点生成场景
    toolbox?: TNodeToolbox; // 导演工具箱选择
  };
};

export type TNodeTextData = {
  text: string;
  bg?: string; // 背景色（选中工具条可切换）
  status?: IMediaData["status"]; // 生成状态
  error?: string; // 生成失败原因
} & TNodeBase;

export type TNodeImageData = {
  url: string;
  status?: IMediaData["status"];
  error?: string;
} & TNodeBase;

// 音频生成节点数据
export type TNodeAudioData = {
  url?: string;
  status?: IMediaData["status"];
  error?: string;
} & TNodeBase;

// 时间线节点数据
export type TNodeTimelineData = TNodeBase;

// 主体节点数据
export type TNodeSubjectData = {
  name: string;
  description?: string;
} & TNodeBase;

// 导演台（外部）节点数据
export type TNodeStageData = TNodeBase;

// 文本生成节点
export type TNodeText = Node<TNodeTextData>;

// 图片生成节点
export type TNodeImage = Node<TNodeImageData>;

// 音频生成节点
export type TNodeAudio = Node<TNodeAudioData>;

// 时间线节点
export type TNodeTimeline = Node<TNodeTimelineData>;

// 主体节点
export type TNodeSubject = Node<TNodeSubjectData>;

// 导演台节点
export type TNodeStage = Node<TNodeStageData>;

export type TAllNodes =
  | TNodeText
  | TNodeImage
  | TNodeAudio
  | TNodeTimeline
  | TNodeSubject
  | TNodeStage;

export type TSendMessageContent = HumanMessage["content"][0];
