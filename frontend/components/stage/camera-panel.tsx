"use client";

import { Diamond } from "lucide-react";
import { getCameraValue, hasCameraKeyframe } from "./camera";
import { NumberField } from "./controls";
import { CameraProperty, StageObject, StagePoint } from "./types";

const LABELS: Record<CameraProperty, string> = { position: "机位位置", target: "注视点", fov: "视野", roll: "画面倾斜" };

export function CameraPanel({ object, currentTime, keyframeTime, onChange, onToggleKeyframe }: {
  object: StageObject;
  currentTime: number;
  keyframeTime: number;
  onChange: (property: CameraProperty, value: StagePoint | number) => void;
  onToggleKeyframe: (property: CameraProperty) => void;
}) {
  const vectorEditor = (property: "position" | "target") => {
    const value = getCameraValue(object, property, currentTime) as StagePoint;
    return <div className="flex gap-1">{(["X", "Y", "Z"] as const).map((axis, index) => <label key={axis} className="flex h-9 min-w-0 flex-1 items-center gap-1 rounded-md bg-white/[0.045] px-2 text-[10px] text-white/35"><span>{axis}</span><input aria-label={`${LABELS[property]} ${axis}`} type="number" step={0.1} value={Number(value[index].toFixed(2))} disabled={object.locked} onChange={(event) => { const next = [...value] as StagePoint; next[index] = Number(event.target.value); onChange(property, next); }} className="min-w-0 flex-1 bg-transparent text-right text-xs text-white/70 outline-none" /></label>)}</div>;
  };
  return <div className="space-y-3">{(["position", "target", "fov", "roll"] as const).map((property) => {
    const keyed = hasCameraKeyframe(object, property, keyframeTime);
    return <section key={property} className="rounded-lg bg-white/[0.025] p-2">
      <div className="mb-2 flex h-7 items-center px-1 text-xs text-white/55"><span>{LABELS[property]}</span><button type="button" aria-label={`${keyed ? "删除" : "添加"}${LABELS[property]}关键帧`} title={`${keyed ? "删除" : "添加"}当前时间关键帧`} onClick={() => onToggleKeyframe(property)} className={`ml-auto rounded p-1.5 hover:bg-white/8 ${keyed ? "text-white" : "text-white/30"}`}><Diamond size={12} fill={keyed ? "currentColor" : "none"} /></button></div>
      {property === "position" || property === "target" ? vectorEditor(property) : <NumberField label={LABELS[property]} value={Number((getCameraValue(object, property, currentTime) as number).toFixed(1))} min={property === "fov" ? 10 : -180} max={property === "fov" ? 120 : 180} step={1} suffix="°" onChange={(value) => onChange(property, value)} />}
    </section>;
  })}</div>;
}
