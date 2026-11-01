"use client";

import { Diamond } from "lucide-react";
import { getCharacterValue } from "./character";
import { NumericInput, Toggle } from "./controls";
import { CharacterProperty, StageObject, StagePoint } from "./types";

const LABELS: Record<CharacterProperty, string> = { position: "位置", rotation: "旋转", scale: "缩放" };

export function CharacterPanel({ object, currentTime, keyframeTime, onChange, onToggleKeyframe, onAutoRotateChange }: {
  object: StageObject;
  currentTime: number;
  keyframeTime: number;
  onChange: (property: CharacterProperty, value: StagePoint) => void;
  onToggleKeyframe: (property: CharacterProperty) => void;
  onAutoRotateChange: (checked: boolean) => void;
}) {
  return <div className="space-y-3">
    {(["position", "rotation", "scale"] as const).map((property) => {
      const value = getCharacterValue(object, property, currentTime);
      const keyed = object.characterKeyframes?.[property]?.some((frame) => Math.abs(frame.time - keyframeTime) < 0.0001) ?? false;
      const rotationLocked = property === "rotation" && object.pathAutoRotate;
      return <section key={property} className="rounded-lg bg-white/[0.025] p-2">
        <div className="mb-2 flex h-7 items-center px-1 text-xs text-white/55">
          <span>{LABELS[property]}</span>
          <button type="button" aria-label={`${keyed ? "删除" : "添加"}${object.name}${LABELS[property]}关键帧`} title={rotationLocked ? "沿路径自动转向开启时无法编辑旋转" : `${keyed ? "删除" : "添加"}当前时间关键帧`} disabled={object.locked || rotationLocked} onClick={() => onToggleKeyframe(property)} className={`ml-auto rounded p-1.5 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-25 ${keyed ? "text-white" : "text-white/30"}`}><Diamond size={12} fill={keyed ? "currentColor" : "none"} /></button>
        </div>
        <div className="flex gap-1">{(["X", "Y", "Z"] as const).map((axis, index) => <label key={axis} className="flex h-9 min-w-0 flex-1 items-center gap-1 rounded-md bg-white/[0.045] px-2 text-[10px] text-white/35">
          <span>{axis}</span>
          <NumericInput label={`${object.name}${LABELS[property]} ${axis}`} step={property === "rotation" ? 1 : 0.1} value={Number((property === "rotation" ? value[index] * 180 / Math.PI : value[index]).toFixed(2))} disabled={object.locked || rotationLocked} onChange={(nextValue) => { const next = [...value] as StagePoint; next[index] = property === "rotation" ? nextValue * Math.PI / 180 : nextValue; onChange(property, next); }} className="min-w-0 flex-1 bg-transparent text-right text-xs text-white/70 outline-none disabled:opacity-35" />
        </label>)}</div>
      </section>;
    })}
    {Boolean(object.path?.length) && <div className="rounded-lg bg-white/[0.025] px-3 py-1">
      <Toggle label="沿路径自动转向" checked={Boolean(object.pathAutoRotate)} onChange={onAutoRotateChange} />
      <p className="pb-3 text-[10px] leading-4 text-white/30">沿路径移动时自动调整朝向，开启后不可编辑旋转。</p>
    </div>}
  </div>;
}
