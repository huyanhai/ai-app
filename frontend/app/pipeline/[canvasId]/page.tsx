"use client";

import { useParams } from "next/navigation";
import PipelinePage from "@/components/pipeline/pipeline-page";

export default function CanvasWorkspacePage() {
  const params = useParams<{ canvasId: string }>();
  return <PipelinePage key={params.canvasId} />;
}
