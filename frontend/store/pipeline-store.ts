import { create } from "zustand";
import { TAllNodes } from "@/components/pipeline/types";

export type ImageEditorState = {
  nodeId: string;
  mode: "edit" | "outpaint" | "upscale" | "cutout";
} | null;

export type SubjectAssetTarget = {
  nodeId: string;
  slot: "import" | "main" | "voice";
  source: "subjects" | "canvas" | "assets";
};

// 节点上 + 按钮 / 连线拖拽结束时请求打开节点创建菜单
export type TMenuRequest = {
  position: { x: number; y: number };
  nodeId?: string | null;
  handleId?: string | null;
  handleType?: string | null;
};

type TPipelineStore = {
  currentSelectNode: TAllNodes | null;
  setCurrentSelectNode: (node: TAllNodes | null) => void;
  updateSelectNodeData: (nodeData: TAllNodes["data"]["config"]) => void;
  menuRequest: TMenuRequest | null;
  openMenu: (req: TMenuRequest) => void;
  closeMenu: () => void;
  showMiniMap: boolean;
  toggleMiniMap: () => void;
  showEdges: boolean;
  toggleEdges: () => void;
  assetModalOpen: boolean;
  setAssetModalOpen: (open: boolean) => void;
  subjectAssetTarget: SubjectAssetTarget | null;
  openSubjectAssets: (target: SubjectAssetTarget) => void;
  imageEditor: ImageEditorState;
  setImageEditor: (editor: ImageEditorState) => void;
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
  menuRequest: null,
  openMenu: (req) => set({ menuRequest: req }),
  closeMenu: () => set({ menuRequest: null }),
  showMiniMap: false,
  toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
  showEdges: true,
  toggleEdges: () => set((s) => ({ showEdges: !s.showEdges })),
  assetModalOpen: false,
  setAssetModalOpen: (open) => set({
    assetModalOpen: open,
    ...(open ? {} : { subjectAssetTarget: null }),
  }),
  subjectAssetTarget: null,
  openSubjectAssets: (subjectAssetTarget) => set({
    assetModalOpen: true,
    subjectAssetTarget,
  }),
  imageEditor: null,
  setImageEditor: (imageEditor) => set({ imageEditor }),
}));
