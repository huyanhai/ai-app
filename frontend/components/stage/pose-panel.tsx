"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, UserRound } from "lucide-react";
import { NumberField } from "./controls";
import { StageObject, StagePoint } from "./types";

const fingerBones = (side: "Left" | "Right") => ["Thumb", "Index", "Middle", "Ring", "Pinky"].flatMap((finger) => [1, 2, 3].map((joint) => [`${side}Hand${finger}${joint}`, `${side === "Left" ? "左" : "右"}手${finger}${joint}`] as const));
const POSE_GROUPS: { label: string; bones: readonly (readonly [string, string])[] }[] = [
  { label: "身体整体", bones: [["Hips", "身体整体"]] },
  { label: "胸腰", bones: [["Spine", "腰椎"], ["Spine1", "胸腰"], ["Spine2", "胸部"]] },
  { label: "头部", bones: [["Neck", "颈部"], ["Head", "头部"]] },
  { label: "左臂", bones: [["LeftShoulder", "左肩"], ["LeftArm", "左上臂"], ["LeftForeArm", "左前臂"]] },
  { label: "右臂", bones: [["RightShoulder", "右肩"], ["RightArm", "右上臂"], ["RightForeArm", "右前臂"]] },
  { label: "左手", bones: [["LeftHand", "左手腕"], ...fingerBones("Left")] },
  { label: "右手", bones: [["RightHand", "右手腕"], ...fingerBones("Right")] },
  { label: "左腿", bones: [["LeftUpLeg", "左大腿"], ["LeftLeg", "左小腿"], ["LeftFoot", "左脚"], ["LeftToeBase", "左脚尖"]] },
  { label: "右腿", bones: [["RightUpLeg", "右大腿"], ["RightLeg", "右小腿"], ["RightFoot", "右脚"], ["RightToeBase", "右脚尖"]] },
];

export function PosePanel({ object, selectedBone, onChange, onReset }: { object: StageObject; selectedBone?: string; onChange: (boneName: string, rotation: StagePoint) => void; onReset: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 身体整体: true, 胸腰: true, 头部: true });
  const rotations = object.pose?.rotations ?? {};
  const boneName = (suffix: string) => Object.keys(rotations).find((name) => name === `mixamorig_${suffix}` || name === `mixamorig${suffix}`);
  const update = (name: string, index: number, degrees: number) => {
    const rotation = [...(rotations[name] ?? [0, 0, 0])] as StagePoint;
    rotation[index] = degrees * Math.PI / 180;
    onChange(name, rotation);
  };
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-white/[0.035] p-3">
        <UserRound size={18} className="text-white/55" />
        <div className="min-w-0"><div className="truncate text-xs text-white/80">{object.name}</div><div className="mt-0.5 truncate text-[10px] text-white/35">{object.pose?.name ?? "未设置姿势"}</div></div>
        <button type="button" aria-label="重置姿势" title="重置姿势" onClick={onReset} className="ml-auto rounded-md p-2 text-white/40 hover:bg-white/8 hover:text-white"><RotateCcw size={14} /></button>
      </div>
      <div className="mb-3 flex items-center justify-between text-xs"><span className="text-white/55">调整姿势</span><span className="text-[10px] text-cyan-200/60">{selectedBone ? selectedBone.replace(/^mixamorig_?/, "") : "点击模型骨骼点"}</span></div>
      {object.pose ? <div className="space-y-2">{POSE_GROUPS.map((group) => {
        const bones = group.bones.flatMap(([suffix, label]) => { const name = boneName(suffix); return name ? [{ name, label }] : []; });
        if (!bones.length) return null;
        const open = Boolean(expanded[group.label]);
        return <section key={group.label} className="rounded-lg bg-white/[0.025] px-2 py-1">
          <button type="button" aria-label={`${open ? "收起" : "展开"}${group.label}`} onClick={() => setExpanded((current) => ({ ...current, [group.label]: !open }))} className="flex h-8 w-full items-center gap-1 text-left text-[11px] text-white/55">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{group.label}</button>
          {open && <div className="space-y-3 pb-2">{bones.map((bone) => <div key={bone.name} className={`rounded-md p-1 ${selectedBone === bone.name ? "bg-cyan-300/[0.06]" : ""}`}>
            {bones.length > 1 && <div className="mb-1 px-2 text-[10px] text-white/35">{bone.label}</div>}
            <div className="space-y-1">{(["前后倾", "转身", "侧倾"] as const).map((label, index) => <NumberField key={label} label={`${bone.label}${label}`} value={Number(((rotations[bone.name]?.[index] ?? 0) * 180 / Math.PI).toFixed(1))} step={0.1} onChange={(value) => update(bone.name, index, value)} />)}</div>
          </div>)}</div>}
        </section>;
      })}</div> : <div className="py-12 text-center text-xs leading-6 text-white/30">点击角色上方的“预设姿势”<br />选择动作后即可编辑骨骼</div>}
    </div>
  );
}
