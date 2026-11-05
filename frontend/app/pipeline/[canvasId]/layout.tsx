import { CanvasWorkspaceProvider } from "@/components/pipeline/canvas-workspace-context";

export default function CanvasWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <CanvasWorkspaceProvider>{children}</CanvasWorkspaceProvider>;
}
