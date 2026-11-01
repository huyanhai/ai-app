export type StageTool = "select" | "translate" | "rotate" | "scale";
export type StagePoint = [number, number, number];
export type CameraProperty = "position" | "target" | "fov" | "roll";
export type CameraKeyframe = { time: number; value: StagePoint | number };
export type CameraKeyframes = Partial<Record<CameraProperty, CameraKeyframe[]>>;
export type CameraMotion = { id: string; name: string; start: number; duration: number };
export type CharacterProperty = "position" | "rotation" | "scale";

export type CharacterAction = {
  id: string;
  name: string;
  kind: "action" | "walk" | "run";
  start: number;
  duration: number;
  motionAssetId?: string;
};

export type CharacterKeyframe = {
  time: number;
  value: StagePoint;
  actionId?: string;
};

export type CharacterPose = {
  name: string;
  assetId?: string;
  rotations: Record<string, StagePoint>;
  positions?: Record<string, StagePoint>;
};

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
  actions?: CharacterAction[];
  characterKeyframes?: Partial<Record<CharacterProperty, CharacterKeyframe[]>>;
  pathAutoRotate?: boolean;
  pose?: CharacterPose;
  path?: StagePoint[];
  pathOrigin?: StagePoint;
  pathActionId?: string;
  target?: StagePoint;
  fov?: number;
  roll?: number;
  cameraPath?: StagePoint[];
  targetPath?: StagePoint[];
  cameraPathOrigin?: StagePoint;
  targetPathOrigin?: StagePoint;
  cameraKeyframes?: CameraKeyframes;
  cameraMotions?: CameraMotion[];
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
