import { Node } from "@xyflow/react";
import { HumanMessage } from "langchain";

export type TRatio = `${number}:${number}`;

export enum Placement {
  Top = "top",
  Bottom = "bottom",
}

export enum NodeType {
  TextNode = "textNode",
  ImageNode = "imageNode",
  VideoNode = "videoNode",
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
  config?: {
    ratio?: TRatio; // 比例
    videoMode?: VideoModeType; // 生图模式
  };
};

export type TNodeTextData = {
  text: string;
} & TNodeBase;

export type TNodeImageData = {
  url: string;
} & TNodeBase;

// 文本生成节点
export type TNodeText = Node<TNodeTextData>;

// 图片生成节点
export type TNodeImage = Node<TNodeImageData>;

export type TAllNodes = TNodeText | TNodeImage;

export type TSendMessageContent = HumanMessage["content"][0];
