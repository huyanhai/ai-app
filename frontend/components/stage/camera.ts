import * as THREE from "three";
import { CameraProperty, StageObject, StagePoint } from "./types";

export function createBezierPath(points: StagePoint[]) {
  if (points.length < 2) return null;
  const vectors = points.map((point) => new THREE.Vector3(...point));
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let index = 0; index < vectors.length - 1; index += 1) {
    const start = vectors[index];
    const end = vectors[index + 1];
    const previous = vectors[index - 1] ?? start;
    const next = vectors[index + 2] ?? end;
    const controlA = start.clone().add(end.clone().sub(previous).multiplyScalar(1 / 6));
    const controlB = end.clone().sub(next.clone().sub(start).multiplyScalar(1 / 6));
    path.add(new THREE.CubicBezierCurve3(start, controlA, controlB, end));
  }
  return path;
}

export function getCameraBaseValue(object: StageObject, property: CameraProperty): StagePoint | number {
  if (property === "position") return object.position;
  if (property === "target") return object.target ?? [0, 1, 0];
  if (property === "fov") return object.fov ?? 50;
  return object.roll ?? 0;
}

export function getCameraValue(object: StageObject, property: CameraProperty, time: number): StagePoint | number {
  const base = getCameraBaseValue(object, property);
  const frames = [...(object.cameraKeyframes?.[property] ?? [])].sort((a, b) => a.time - b.time);
  if (!frames.length) return base;
  if (time <= frames[0].time) return frames[0].value;
  if (time >= frames[frames.length - 1].time) return frames[frames.length - 1].value;
  const index = frames.findIndex((frame, frameIndex) => frameIndex < frames.length - 1 && time >= frame.time && time <= frames[frameIndex + 1].time);
  const from = frames[index];
  const to = frames[index + 1];
  const progress = (time - from.time) / (to.time - from.time);
  if (typeof from.value === "number" || typeof to.value === "number") return Number(from.value) + (Number(to.value) - Number(from.value)) * progress;
  const fromVector = from.value as StagePoint;
  const toVector = to.value as StagePoint;
  return fromVector.map((value, axis) => value + (toVector[axis] - value) * progress) as StagePoint;
}

export function getCameraGroundIntersection(object: StageObject, time: number): StagePoint {
  const position = new THREE.Vector3(...getCameraValue(object, "position", time) as StagePoint);
  const target = new THREE.Vector3(...getCameraValue(object, "target", time) as StagePoint);
  const direction = target.clone().sub(position).normalize();
  const intersection = new THREE.Ray(position, direction).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  return intersection?.toArray() ?? [target.x, 0, target.z];
}

export function getCameraPathOrigin(object: StageObject, kind: "camera" | "target", time: number): StagePoint {
  return kind === "target" ? getCameraGroundIntersection(object, time) : getCameraValue(object, "position", time) as StagePoint;
}

export function hasCameraKeyframe(object: StageObject, property: CameraProperty, time: number) {
  return Boolean(object.cameraKeyframes?.[property]?.some((frame) => Math.abs(frame.time - time) < 0.0001));
}

