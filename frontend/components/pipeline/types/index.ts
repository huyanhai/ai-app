import { Node } from "@xyflow/react";
import { HumanMessage } from "langchain";

export enum NodeType {
  TextNode = "textNode",
  ImageNode = "imageNode",
}

export type TNodeTextData = {
  text: string;
};

export type TNodeImageData = {
  url: string;
};

// 文本生成节点
export type TNodeText = Node<TNodeTextData>;

// 图片生成节点
export type TNodeImage = Node<TNodeImageData>;

export type TAllNodes = TNodeText | TNodeImage;

export type TSendMessageContent = HumanMessage["content"][0];

export interface IMenu {
  id: string;
  position: { x: number; y: number };
  top: number;
  left: number;
}
