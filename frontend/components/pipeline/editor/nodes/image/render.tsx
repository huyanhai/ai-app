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
  title?: string;
}

export class ImageNodeRender extends DecoratorNode<ReactNode> {
  // 图片地址
  __url: string;
  __title?: string;

  constructor(data: IImageNode, key?: NodeKey) {
    super(key);
    this.__url = data.url;
    this.__title = data.title;
  }

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNodeRender): ImageNodeRender {
    return new ImageNodeRender(
      { url: node.__url, title: node.__title, type: "image", version: 1 },
      node.__key,
    );
  }

  static importJSON(data: IImageNode): ImageNodeRender {
    return $createImageNode(data.url, data.title);
  }

  exportJSON(): IImageNode {
    return {
      type: "image",
      version: 1,
      url: this.__url,
      title: this.__title,
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
    return <ImageNode url={this.__url} fileName={this.__title} isSelected status="success" />;
  }

  getConfig() {
    return {
      url: this.__url,
    };
  }
}

export function $createImageNode(url: string, title?: string): ImageNodeRender {
  return new ImageNodeRender({
    url,
    title,
    type: "image",
    version: 1,
  });
}

export function $isImageNode(node: LexicalNode | null | undefined) {
  return node instanceof ImageNodeRender;
}
