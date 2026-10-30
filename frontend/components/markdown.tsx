"use client";
import { Streamdown } from "streamdown";
import type { Components } from "streamdown";

interface MarkdownProps {
  children: string;
  className?: string;
  // 正在流式输出：显示末尾光标，代码块复制等操作在输出结束前禁用
  animating?: boolean;
}

const components: Components = {
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[#6ea8fe] underline"
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    return (
      <img src={src} alt={alt || ""} className="my-2 max-w-full rounded-md" />
    );
  },
};

// 统一用 Streamdown 渲染模型输出：兼容流式不完整 Markdown，自带 GFM / 代码高亮 / 表格
// markdown-dark 样式见 globals.css：Streamdown 的语义色按深色底覆盖（全局 token 是浅色主题）
export function Markdown({ children, className, animating }: MarkdownProps) {
  return (
    <div className="markdown-dark" data-animating={animating || undefined}>
      <Streamdown
        className={className}
        components={components}
        shikiTheme={["github-dark", "github-dark"]}
        isAnimating={animating}
        caret="block"
      >
        {children}
      </Streamdown>
    </div>
  );
}
