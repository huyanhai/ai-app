"use client";

import { useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { AgentPanel } from "@/components/agent/agent-panel";
import type { NodeOption } from "@/components/agent/agent-editor";
import { useAgentController, useAgentModels } from "@/hooks/use-agent-controller";
import type { RefNode } from "@/lib/agent/selection-refs";
import { NODE_TYPE_LABEL } from "./constants";
import { NodeType, type TAllNodes, type TNodeBase } from "./types";

const REFERENCE_KINDS: Partial<Record<NodeType, NodeOption["kind"]>> = {
  [NodeType.TextNode]: "script",
  [NodeType.ImageNode]: "image",
  [NodeType.VideoNode]: "video",
  [NodeType.AudioNode]: "audio",
  [NodeType.SubjectNode]: "character",
};

type AgentHostProps = {
  canvasId: string;
  open: boolean;
  nodes: TAllNodes[];
  onClose: () => void;
  beforeSend: () => Promise<number | undefined>;
};

export default function AgentHost({
  canvasId,
  open,
  nodes,
  onClose,
  beforeSend,
}: AgentHostProps) {
  const { getViewport } = useReactFlow();
  const models = useAgentModels();
  const controller = useAgentController({
    canvasId,
    models: models ?? [],
    getViewport,
  });
  const ctl = useMemo(
    () => ({
      ...controller,
      send: async (...args: Parameters<typeof controller.send>) => {
        try {
          await beforeSend();
          return await controller.send(...args);
        } catch {
          return false;
        }
      },
    }),
    [beforeSend, controller],
  );

  const options = useMemo(() => {
    const referable = nodes.flatMap((node) => {
      const kind = REFERENCE_KINDS[node.type as NodeType];
      if (!kind) return [];
      const data = node.data as TNodeBase & { name?: string };
      const label = data.title || data.name || NODE_TYPE_LABEL[node.type as NodeType] || node.id;
      return [{ node, option: { id: node.id, label, kind } as NodeOption }];
    });
    return {
      nodes: referable.map((item) => item.option),
      refs: referable.map((item) => item.option) as RefNode[],
      selection: referable.filter((item) => item.node.selected).map((item) => item.node.id),
    };
  }, [nodes]);

  if (!open || !models || models.length === 0) return null;
  return (
    <AgentPanel
      ctl={ctl}
      models={models}
      selection={options.selection}
      nodes={options.nodes}
      refNodes={options.refs}
      onClose={onClose}
    />
  );
}
