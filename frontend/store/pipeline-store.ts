import { create } from "zustand";
import { TAllNodes } from "@/components/pipeline/types";

type TPipelineStore = {
  currentSelectNode: TAllNodes | null;
  setCurrentSelectNode: (node: TAllNodes | null) => void;
};

export const usePipelineStore = create<TPipelineStore>((set) => ({
  currentSelectNode: null,
  setCurrentSelectNode: (node: TAllNodes | null) =>
    set({ currentSelectNode: node }),
}));
