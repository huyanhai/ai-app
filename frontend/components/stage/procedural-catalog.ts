import catalog from "./procedural-catalog.json";

export type ProceduralPart = {
  shape: string;
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  surface?: "ceramic" | "glass";
};

export type ProceduralAsset = {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  dimensions: [number, number, number];
  parts: ProceduralPart[];
};

export const PROCEDURAL_ASSETS = catalog as ProceduralAsset[];
export const PROCEDURAL_BY_NAME = new Map(PROCEDURAL_ASSETS.map((asset) => [asset.name, asset]));
export const PROCEDURAL_CATEGORIES = [
  { id: "furniture", name: "家具" },
  { id: "architecture", name: "建筑构件" },
  { id: "nature", name: "自然" },
  { id: "street", name: "街道设施" },
  { id: "kitchen", name: "厨房" },
  { id: "bathroom", name: "卫浴" },
  { id: "office", name: "办公" },
  { id: "household", name: "日常用品" },
];
