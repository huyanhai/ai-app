import type { StageObject, StageSettings, Shot } from "./types";

export type StageSnapshot = {
  settings: StageSettings;
  objects: StageObject[];
  shots: Shot[];
  preview?: string;
  previewVideo?: string;
  previewDuration?: number;
  previewExportedAt?: string;
  duration?: number;
  frameRate?: number;
  savedAt?: string;
};

export type StageReference = {
  video: string;
  duration?: number;
};

export const getStageStorageKey = (nodeId: string) => `director-stage:${nodeId}`;

export const readStageReference = (nodeId: string, index: number, title?: string): StageReference => {
  const name = title || `导演台 ${index + 1}`;
  const saved = localStorage.getItem(getStageStorageKey(nodeId));
  if (!saved) throw new Error(`请先进入「${name}」保存场景并导出预演`);
  try {
    const snapshot = JSON.parse(saved) as StageSnapshot;
    if (!snapshot.settings || !Array.isArray(snapshot.objects) || !snapshot.objects.length) throw new Error("empty");
    if (!snapshot.previewVideo) throw new Error(`请先进入「${name}」导出几何预演，再生成视频`);
    return { video: snapshot.previewVideo, duration: snapshot.previewDuration };
  } catch (error) {
    if (error instanceof Error && error.message.includes("导出几何预演")) throw error;
    throw new Error(`「${name}」的场景数据无效，请重新进入导演台并保存`);
  }
};
