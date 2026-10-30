"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const DirectorStage = dynamic(() => import("@/components/stage/director-stage"), { ssr: false });

export default function StagePage() {
  const params = useParams<{ nodeId: string }>();
  return <DirectorStage nodeId={params.nodeId} />;
}
