import { CameraKeyframe, CameraKeyframes, CameraMotion, StageObject, StagePoint } from "./types";

export type CameraPresetCategory = "fixed-target" | "fixed-camera";
export type CameraPresetId =
  | "push-in"
  | "pull-back"
  | "truck"
  | "rise"
  | "descend"
  | "orbit"
  | "arc"
  | "spiral-rise"
  | "dolly-zoom"
  | "dutch"
  | "pan-left"
  | "pan-right"
  | "tilt-up"
  | "tilt-down";

export type CameraPresetDefinition = {
  id: CameraPresetId;
  name: string;
  description: string;
  category: CameraPresetCategory;
};

export type CameraPresetDraft = {
  cameraId: string;
  preset: CameraPresetDefinition;
  step: 1 | 2 | 3;
  position: StagePoint;
  target: StagePoint;
  angle: number;
  distance: number;
  start: number;
  duration: number;
  amplitude: number;
  placingTarget: boolean;
};

export type CameraPresetResult = {
  start: number;
  end: number;
  motion: CameraMotion;
  keyframes: CameraKeyframes;
  cameraPath?: StagePoint[];
  cameraPathOrigin?: StagePoint;
  targetPath?: StagePoint[];
  targetPathOrigin?: StagePoint;
};

export const CAMERA_PRESETS: CameraPresetDefinition[] = [
  { id: "push-in", name: "推近", description: "机位靠近主体，让主体逐渐放大。", category: "fixed-target" },
  { id: "pull-back", name: "拉远", description: "机位远离主体，展示更多环境。", category: "fixed-target" },
  { id: "truck", name: "横移", description: "横向移动机位，呈现前后景的相对变化。", category: "fixed-target" },
  { id: "rise", name: "上升", description: "升高机位，逐渐俯视场景。", category: "fixed-target" },
  { id: "descend", name: "下降", description: "降低机位，靠近主体高度。", category: "fixed-target" },
  { id: "orbit", name: "环绕", description: "围绕注视点旋转一整圈。", category: "fixed-target" },
  { id: "arc", name: "半弧", description: "围绕注视点移动半圈。", category: "fixed-target" },
  { id: "spiral-rise", name: "螺旋上升", description: "环绕上升，同时逐渐靠近主体。", category: "fixed-target" },
  { id: "dolly-zoom", name: "滑动变焦", description: "同时调整距离和视野，保持主体大小并改变背景透视。", category: "fixed-target" },
  { id: "dutch", name: "倾斜镜头", description: "倾斜画面，形成斜角构图。", category: "fixed-target" },
  { id: "pan-left", name: "镜头左摇", description: "固定机位，向左转动拍摄方向。", category: "fixed-camera" },
  { id: "pan-right", name: "镜头右摇", description: "固定机位，向右转动拍摄方向。", category: "fixed-camera" },
  { id: "tilt-up", name: "镜头上摇", description: "固定机位，向上转动拍摄方向。", category: "fixed-camera" },
  { id: "tilt-down", name: "镜头下摇", description: "固定机位，向下转动拍摄方向。", category: "fixed-camera" },
];

const point = (x: number, y: number, z: number): StagePoint => [x, y, z];

const PRESET_KEYFRAME_COUNTS: Partial<Record<CameraPresetId, number>> = {
  arc: 10,
  orbit: 14,
  "spiral-rise": 18,
};

function orbitPoint(target: StagePoint, radius: number, angle: number, height: number): StagePoint {
  return point(target[0] + Math.sin(angle) * radius, height, target[2] + Math.cos(angle) * radius);
}

function dollyZoomFov(baseFov: number, startDistance: number, currentDistance: number) {
  const tangent = Math.tan((baseFov * Math.PI) / 360) * (startDistance / Math.max(0.2, currentDistance));
  return Math.min(110, Math.max(12, (Math.atan(tangent) * 360) / Math.PI));
}

export function createCameraPresetResult(camera: StageObject, draft: CameraPresetDraft, frameRate: number): CameraPresetResult {
  const { preset, target, angle, distance, amplitude } = draft;
  const start = Math.max(0, draft.start);
  const duration = Math.max(0.1, draft.duration);
  const basePosition = orbitPoint(target, distance, angle, draft.position[1]);
  const baseTarget = target;
  const side = point(Math.cos(angle), 0, -Math.sin(angle));
  const baseFov = camera.fov ?? 50;
  const baseRoll = camera.roll ?? 0;
  const positions: StagePoint[] = [];
  const targets: StagePoint[] = [];
  const fovs: number[] = [];
  const rolls: number[] = [];
  const samples = 32;

  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const amount = progress * amplitude;
    let position = basePosition;
    let nextTarget = baseTarget;
    let fov = baseFov;
    let roll = baseRoll;

    if (preset.id === "push-in" || preset.id === "dolly-zoom") {
      const ratio = preset.id === "dolly-zoom" ? 0.55 : 0.45;
      const radius = distance * (1 - ratio * amount);
      position = orbitPoint(target, radius, angle, basePosition[1] - (basePosition[1] - target[1]) * ratio * amount);
      if (preset.id === "dolly-zoom") fov = dollyZoomFov(baseFov, distance, radius);
    } else if (preset.id === "pull-back") {
      position = orbitPoint(target, distance * (1 + 0.55 * amount), angle, basePosition[1] + distance * 0.12 * amount);
    } else if (preset.id === "truck") {
      position = point(basePosition[0] + side[0] * distance * 0.7 * amount, basePosition[1], basePosition[2] + side[2] * distance * 0.7 * amount);
    } else if (preset.id === "rise") {
      position = point(basePosition[0], basePosition[1] + distance * 0.65 * amount, basePosition[2]);
    } else if (preset.id === "descend") {
      position = point(basePosition[0], Math.max(0.3, basePosition[1] - distance * 0.55 * amount), basePosition[2]);
    } else if (preset.id === "orbit") {
      position = orbitPoint(target, distance, angle + Math.PI * 2 * amount, basePosition[1]);
    } else if (preset.id === "arc") {
      position = orbitPoint(target, distance, angle + Math.PI * amount, basePosition[1]);
    } else if (preset.id === "spiral-rise") {
      position = orbitPoint(target, distance * (1 - 0.35 * amount), angle + Math.PI * 2 * amount, basePosition[1] + distance * 0.65 * amount);
    } else if (preset.id === "dutch") {
      roll = baseRoll + 30 * amount;
    } else if (preset.id === "pan-left" || preset.id === "pan-right") {
      const direction = preset.id === "pan-left" ? -1 : 1;
      nextTarget = point(baseTarget[0] + side[0] * distance * 0.8 * amount * direction, baseTarget[1], baseTarget[2] + side[2] * distance * 0.8 * amount * direction);
    } else if (preset.id === "tilt-up" || preset.id === "tilt-down") {
      const direction = preset.id === "tilt-up" ? 1 : -1;
      nextTarget = point(baseTarget[0], Math.max(0, baseTarget[1] + distance * 0.6 * amount * direction), baseTarget[2]);
    }

    if (preset.category === "fixed-camera") position = draft.position;
    positions.push(position);
    targets.push(nextTarget);
    fovs.push(fov);
    rolls.push(roll);
  }

  const movingCamera = preset.category === "fixed-target" && preset.id !== "dutch";
  const movingTarget = preset.category === "fixed-camera";
  const keyframeCount = PRESET_KEYFRAME_COUNTS[preset.id] ?? 10;
  const animatedIndices = Array.from({ length: keyframeCount }, (_, index) => Math.round((index * samples) / (keyframeCount - 1)));
  const endpointIndices = [0, samples];
  const frames = <T extends StagePoint | number>(values: T[], indices: number[]): CameraKeyframe[] => indices.map((index) => ({
    time: Math.round((start + (duration * index) / samples) * frameRate) / frameRate,
    value: values[index],
  }));
  const keyframes: CameraKeyframes = {
    position: frames(positions, movingCamera ? animatedIndices : endpointIndices),
    target: frames(targets, movingTarget ? animatedIndices : endpointIndices),
  };
  if (preset.id === "dolly-zoom") keyframes.fov = frames(fovs, animatedIndices);
  if (preset.id === "dutch") keyframes.roll = frames(rolls, animatedIndices);

  return {
    start,
    end: start + duration,
    motion: { id: `${camera.id}-${preset.id}-${start}-${duration}`, name: preset.name, start, duration },
    keyframes,
    ...(movingCamera ? { cameraPath: positions.slice(1), cameraPathOrigin: positions[0] } : {}),
    ...(movingTarget ? { targetPath: targets.slice(1), targetPathOrigin: targets[0] } : {}),
  };
}

export function applyCameraPresetResult(camera: StageObject, result: CameraPresetResult): StageObject {
  const cameraKeyframes = { ...camera.cameraKeyframes };
  (Object.keys(result.keyframes) as (keyof CameraKeyframes)[]).forEach((property) => {
    const generated = result.keyframes[property] ?? [];
    const existing = cameraKeyframes[property] ?? [];
    cameraKeyframes[property] = [
      ...existing.filter((frame) => frame.time < result.start - 0.0001 || frame.time > result.end + 0.0001),
      ...generated,
    ].sort((a, b) => a.time - b.time);
  });
  return {
    ...camera,
    cameraKeyframes,
    cameraMotions: [
      ...(camera.cameraMotions ?? []).filter((motion) => motion.start + motion.duration <= result.start || motion.start >= result.end),
      result.motion,
    ].sort((a, b) => a.start - b.start),
    ...(result.cameraPath ? { cameraPath: result.cameraPath, cameraPathOrigin: result.cameraPathOrigin } : {}),
    ...(result.targetPath ? { targetPath: result.targetPath, targetPathOrigin: result.targetPathOrigin } : {}),
  };
}
