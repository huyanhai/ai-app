import type { ReactNode } from "react";

export function ShimmerText({ children }: { children: ReactNode }) {
  return <span className="thinking-shimmer text-zinc-500">{children}</span>;
}

