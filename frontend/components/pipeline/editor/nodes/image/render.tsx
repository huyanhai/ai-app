import {
  DecoratorNode,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";
import ImageNode from "./node";
import { ReactNode } from "react";

export interface IImageNode extends SerializedLexicalNode {
  url: string;
}

export class ImageNodeRender extends DecoratorNode<ReactNode> {
  // 图片地址
  __url: string;

  constructor(data: IImageNode, key?: NodeKey) {
    super(key);
    this.__url = data.url;
  }

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNodeRender): ImageNodeRender {
    return new ImageNodeRender(
      { url: node.__url, type: "image", version: 1 },
      node.__key,
    );
  }

  static importJSON(data: IImageNode): ImageNodeRender {
    return $createImageNode(data.url);
  }

  exportJSON(): IImageNode {
    return {
      type: "image",
      version: 1,
      url: this.__url,
    };
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.style.display = "inline-flex";
    dom.style.verticalAlign = "middle";
    dom.contentEditable = "false";
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  decorate(): ReactNode {
    return <ImageNode url={this.__url} isSelected status="success" />;
  }
}

export function $createImageNode(url: string): ImageNodeRender {
  return new ImageNodeRender({
    url,
    type: "image",
    version: 1,
  });
}

export function $isImageNode(node: LexicalNode | null | undefined) {
  return node instanceof ImageNodeRender;
}
