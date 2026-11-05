"use client";
import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Table2 } from "lucide-react";
import NodeShell from "./shell";
import { NodeType, TNodeShotTable } from "../../types";

const ShotTableNode = ({ id, data, selected }: NodeProps<TNodeShotTable>) => (
  <NodeShell id={id} type={NodeType.ShotTableNode} selected={selected} title="全片分镜表" icon={<Table2 size={12} />}>
    <div className="nowheel max-h-[720px] w-[1600px] overflow-auto rounded-2xl border border-white/8 bg-[#1b1b1e]">
      <table className="w-full border-collapse text-left text-xs text-white/65">
        <thead className="sticky top-0 z-10 bg-[#252528] text-white/80">
          <tr>
            <th className="w-20 border-b border-white/8 px-3 py-3 font-medium">镜号</th>
            <th className="w-28 border-b border-white/8 px-3 py-3 font-medium">场景</th>
            <th className="w-56 border-b border-white/8 px-3 py-3 font-medium">分镜内容</th>
            <th className="w-44 border-b border-white/8 px-3 py-3 font-medium">动作与运镜</th>
            <th className="w-16 border-b border-white/8 px-3 py-3 font-medium">时长</th>
            <th className="w-72 border-b border-white/8 px-3 py-3 font-medium">分镜图提示词</th>
            <th className="w-72 border-b border-white/8 px-3 py-3 font-medium">视频拍摄提示词</th>
            <th className="w-[360px] border-b border-white/8 px-3 py-3 font-medium">转场设计</th>
          </tr>
        </thead>
        <tbody>
          {data.shots.map((shot) => (
            <tr key={shot.id} className="align-top odd:bg-white/[0.015]">
              <td className="border-b border-white/6 px-3 py-3 text-white/80">{shot.title || shot.id}</td>
              <td className="border-b border-white/6 px-3 py-3">{shot.sceneTitle}</td>
              <td className="whitespace-pre-wrap border-b border-white/6 px-3 py-3 leading-5">{shot.description}</td>
              <td className="whitespace-pre-wrap border-b border-white/6 px-3 py-3 leading-5">{shot.movement}</td>
              <td className="border-b border-white/6 px-3 py-3">{shot.duration}s</td>
              <td className="whitespace-pre-wrap border-b border-white/6 px-3 py-3 leading-5">{shot.visualPrompt || "待生成"}</td>
              <td className="whitespace-pre-wrap border-b border-white/6 px-3 py-3 leading-5">{shot.motionPrompt || "待生成"}</td>
              <td className="whitespace-pre-wrap border-b border-white/6 px-3 py-3 leading-5">
                {shot.transitionFromPrevious ? [
                  `${shot.transitionFromPrevious.mode === "continuous" ? "连续承接" : "独立切换"}：${shot.transitionFromPrevious.rationale}`,
                  `视觉桥梁：${shot.transitionFromPrevious.bridge}`,
                  `上一镜出场：${shot.transitionFromPrevious.previousOutro}`,
                  `当前镜入场：${shot.transitionFromPrevious.currentIntro}`,
                  `相机路径：${shot.transitionFromPrevious.cameraPath}`,
                  `连续性：${shot.transitionFromPrevious.consistency}`,
                ].join("\n") : "首镜或无转场"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </NodeShell>
);

export default memo(ShotTableNode);
