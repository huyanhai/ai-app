import { CharacterProperty, StageObject, StagePoint } from "./types";

export function getCharacterValue(object: StageObject, property: CharacterProperty, time: number): StagePoint {
  if (property === "rotation" && object.pathAutoRotate) return [0, 0, 0];
  const base = object[property];
  const frames = [...(object.characterKeyframes?.[property] ?? [])].sort((a, b) => a.time - b.time);
  if (!frames.length) return base;
  if (time <= frames[0].time) return frames[0].value;
  if (time >= frames[frames.length - 1].time) return frames[frames.length - 1].value;
  const index = frames.findIndex((frame, frameIndex) => frameIndex < frames.length - 1 && time >= frame.time && time <= frames[frameIndex + 1].time);
  const from = frames[index];
  const to = frames[index + 1];
  const progress = (time - from.time) / (to.time - from.time);
  return from.value.map((value, axis) => value + (to.value[axis] - value) * progress) as StagePoint;
}
