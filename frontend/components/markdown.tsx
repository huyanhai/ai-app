import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownProps {
  children: string;
  className?: string;
}

function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code
      className={className}
      style={{
        backgroundColor: "rgba(0,0,0,0.06)",
        borderRadius: "4px",
        padding: "2px 6px",
        fontSize: "0.875em",
        fontFamily: 'ui-monospace, "IBM Plex Mono", monospace',
        wordBreak: "break-word",
      }}
    >
      {children}
    </code>
  );
}

function PreBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre
      style={{
        backgroundColor: "#1e293b",
        color: "#e2e8f0",
        borderRadius: "8px",
        padding: "16px",
        overflow: "auto",
        fontSize: "0.8125rem",
        lineHeight: "1.5",
        fontFamily: 'ui-monospace, "IBM Plex Mono", monospace',
        margin: "12px 0",
      }}
    >
      {children}
    </pre>
  );
}

const components: Partial<Components> = {
  code({ className, children, ...props }) {
    const isInline = !className;
    if (isInline) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <PreBlock>{children}</PreBlock>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={{ color: "#0755bb", textDecoration: "underline" }}
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div style={{ overflowX: "auto", margin: "12px 0" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: "0.875rem",
          }}
        >
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th
        style={{
          border: "1px solid #d1d5db",
          padding: "8px 12px",
          backgroundColor: "#f1f5f9",
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td
        style={{
          border: "1px solid #d1d5db",
          padding: "6px 12px",
        }}
      >
        {children}
      </td>
    );
  },
  img({ src, alt }) {
    return (
      <img
        src={src}
        alt={alt || ""}
        style={{ maxWidth: "100%", borderRadius: "6px", margin: "8px 0" }}
      />
    );
  },
  hr() {
    return (
      <hr
        style={{
          border: "none",
          borderTop: "1px solid #d1d5db",
          margin: "16px 0",
        }}
      />
    );
  },
};

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
