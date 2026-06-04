import { create } from "zustand";
import { TAllNodes } from "@/components/pipeline/types";

type TPipelineStore = {
  currentSelectNode: TAllNodes | null;
  setCurrentSelectNode: (node: TAllNodes | null) => void;
  updateSelectNodeData: (nodeData: TAllNodes["data"]["config"]) => void;
};

export const usePipelineStore = create<TPipelineStore>((set) => ({
  currentSelectNode: null,
  updateSelectNodeData: (config: TAllNodes["data"]["config"]) =>
    set((state) => ({
      currentSelectNode: {
        ...(state.currentSelectNode! || {}),
        data: {
          config,
        },
      } as TAllNodes,
    })),
  setCurrentSelectNode: (node: TAllNodes | null) =>
    set({ currentSelectNode: node }),
}));
