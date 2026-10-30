export type StageTool = "select" | "translate" | "rotate" | "scale";

export type LightSettings = {
  color: string;
  intensity: number;
  horizontal?: number;
  elevation?: number;
  shadow?: boolean;
};

export type StageSettings = {
  environment: string;
  backgroundColor: string;
  groundColor: string;
  showGround: boolean;
  groundOpacity: number;
  exposure: number;
  showGrid: boolean;
  mainLight: LightSettings;
  fillLight: LightSettings;
  rimLight: LightSettings;
};

export type StageObject = {
  id: string;
  type: "camera" | "character" | "prop";
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  locked: boolean;
  modelUrl?: string;
  modelFormat?: "fbx" | "glb" | "gltf";
};

export type Shot = {
  id: string;
  name: string;
  image: string;
  duration: number;
};

export const DEFAULT_SETTINGS: StageSettings = {
  environment: "影棚",
  backgroundColor: "#171717",
  groundColor: "#242424",
  showGround: true,
  groundOpacity: 50,
  exposure: 1.05,
  showGrid: true,
  mainLight: {
    color: "#ffffff",
    intensity: 3.4,
    horizontal: -34,
    elevation: 51,
    shadow: true,
  },
  fillLight: { color: "#ffffff", intensity: 2.1 },
  rimLight: { color: "#ffffff", intensity: 1.1 },
};

export const DEFAULT_OBJECTS: StageObject[] = [
  {
    id: "camera-1",
    type: "camera",
    name: "机位",
    position: [0, 1.6, 4],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    locked: false,
  },
];
