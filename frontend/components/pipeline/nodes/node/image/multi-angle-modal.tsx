"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { TNodeImage } from "../../../types";

export type MultiAngleParams = {
  direction: string;
  horizontal: number;
  vertical: number;
  zoom: "近" | "标准" | "远";
};

const DEFAULT_PARAMS: MultiAngleParams = { direction: "正面", horizontal: 0, vertical: 0, zoom: "标准" };
const SLIDER_CLASS = "block h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-1 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white";
const DIRECTIONS = [
  { label: "左上", horizontal: 315, vertical: 30, icon: ArrowDownRight },
  { label: "上方", horizontal: 0, vertical: 60, icon: ArrowDown },
  { label: "右上", horizontal: 45, vertical: 30, icon: ArrowUpLeft },
  { label: "左侧", horizontal: 270, vertical: 0, icon: ArrowRight },
  { label: "正面", horizontal: 0, vertical: 0, icon: null },
  { label: "右侧", horizontal: 90, vertical: 0, icon: ArrowLeft },
  { label: "左下", horizontal: 315, vertical: -30, icon: ArrowUpRight },
  { label: "下方", horizontal: 0, vertical: -30, icon: ArrowUp },
  { label: "右下", horizontal: 45, vertical: -30, icon: ArrowDownLeft },
];

const spherePath = (type: "longitude" | "latitude", angle: number, tilt: number) => {
  const rotation = tilt * Math.PI / 180;
  const points = Array.from({ length: 73 }, (_, index) => {
    const progress = index / 72;
    const longitude = type === "longitude" ? angle * Math.PI / 180 : progress * Math.PI * 2;
    const latitude = type === "latitude" ? angle * Math.PI / 180 : (progress - 0.5) * Math.PI;
    const x = Math.cos(latitude) * Math.sin(longitude);
    const y = Math.sin(latitude);
    const z = Math.cos(latitude) * Math.cos(longitude);
    const rotatedY = y * Math.cos(rotation) - z * Math.sin(rotation);
    return `${index === 0 ? "M" : "L"}${(127 + 126.5 * x).toFixed(2)},${(127 - 126.5 * rotatedY).toFixed(2)}`;
  });
  return points.join(" ");
};

const CameraModel = ({
  url,
  horizontal,
  vertical,
  onChange,
}: {
  url: string;
  horizontal: number;
  vertical: number;
  onChange: (horizontal: number, vertical: number) => void;
}) => {
  const dragRef = useRef<{ x: number; y: number; horizontal: number; vertical: number } | null>(null);
  const orbitX = Math.sin(horizontal * Math.PI / 180) * 120;
  const orbitY = -Math.sin(vertical * Math.PI / 180) * 150;
  const face = "absolute box-border rounded-[1px] border border-[#74747b] backface-visible";

  return (
    <div className="pointer-events-none absolute inset-0 z-[7] [perspective:800px] [transform-style:preserve-3d]">
      <div
        data-testid="multi-angle-camera-position"
        className="absolute left-1/2 top-1/2 size-0 cursor-grab [transform-style:preserve-3d] [transition:transform_180ms_cubic-bezier(0.22,1,0.36,1)] active:cursor-grabbing"
        style={{ transform: `translate3d(${orbitX}px, ${orbitY}px, 0) scale(1.3666)` }}
      >
        <div
          data-testid="multi-angle-camera-body"
          className="pointer-events-auto absolute size-0 touch-none select-none [transform-style:preserve-3d]"
          style={{ transform: `rotateY(${horizontal}deg) rotateX(${vertical}deg)` }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { x: event.clientX, y: event.clientY, horizontal, vertical };
          }}
          onPointerMove={(event) => {
            const start = dragRef.current;
            if (!start) return;
            const nextHorizontal = (start.horizontal + (event.clientX - start.x) * 0.6 + 360) % 360;
            const nextVertical = Math.min(60, Math.max(-30, start.vertical - (event.clientY - start.y) * 0.3));
            onChange(nextHorizontal, nextVertical);
          }}
          onPointerUp={() => { dragRef.current = null; }}
        >
          <div className={`${face} h-[26px] w-[34px] bg-[#4b4b50] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[1px] after:border after:border-[#242428] after:content-[''] [transform:translate(-50%,-50%)_translateZ(8.8px)]`}>
            <div className="absolute left-1/2 top-1/2 h-4 w-6 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1px] border border-[#85858c] bg-black">
              <img src={url} alt="" draggable={false} className="size-full object-cover" />
            </div>
          </div>
          <div className={`${face} h-[26px] w-[34px] bg-[#39393e] [transform:translate(-50%,-50%)_rotateY(180deg)_translateZ(8.8px)]`} />
          <div className={`${face} h-[18.15px] w-[34px] bg-[#505056] [transform:translate(-50%,-50%)_rotateX(90deg)_translateZ(13px)]`} />
          <div className={`${face} h-[18.15px] w-[34px] bg-[#303034] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[1px] after:border after:border-[#202024] after:content-[''] [transform:translate(-50%,-50%)_rotateX(-90deg)_translateZ(13px)]`} />
          <div className={`${face} h-[26px] w-[18.15px] bg-[#343439] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[1px] after:border after:border-[#202024] after:content-[''] [transform:translate(-50%,-50%)_rotateY(-90deg)_translateZ(17px)]`} />
          <div className={`${face} h-[26px] w-[18.15px] bg-[#45454a] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[1px] after:border after:border-[#202024] after:content-[''] [transform:translate(-50%,-50%)_rotateY(90deg)_translateZ(17px)]`} />
          <div className="absolute size-0 [transform:rotateY(180deg)_translateZ(8.8px)] [transform-style:preserve-3d]">
            <div className="absolute left-0 top-0 size-[15.5px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#797981] bg-[#303034] shadow-[inset_0_0_0_1.5px_#505056,inset_0_0_0_2px_#171719]" />
            <div className="absolute [transform-style:preserve-3d]">
              {Array.from({ length: 24 }, (_, index) => (
                <span
                  key={index}
                  className="absolute left-[-1.1px] top-[-5.5px] h-[11px] w-[2.2px] bg-[#29292e] backface-visible"
                  style={{ transform: `rotateZ(${index * 15}deg) translateY(-7.75px) translateZ(5.5px) rotateX(90deg)` }}
                />
              ))}
            </div>
            <div className="absolute left-0 top-0 flex size-[15.5px] items-center justify-center rounded-full border border-[#797981] bg-[#343439] shadow-[inset_0_0_0_1.5px_#505056,inset_0_0_0_2px_#171719] [transform:translate(-50%,-50%)_translateZ(11px)] [transform-style:preserve-3d]">
              <div className="size-2 rounded-full border border-[#85858c] bg-[#111115] shadow-[inset_0_0_2px_#7777aa]" />
            </div>
          </div>
          <div className="absolute left-0 top-[-15.75px] size-0 [transform-style:preserve-3d]">
            <div className="absolute left-[-5.5px] top-[-2.75px] h-[5.5px] w-[11px] border border-[#74747b] bg-[#45454a] [clip-path:polygon(18%_0,82%_0,100%_100%,0_100%)] [transform:translateZ(3.1px)]" />
            <div className="absolute left-[-5.5px] top-[-2.75px] h-[5.5px] w-[11px] border border-[#74747b] bg-[#39393e] [clip-path:polygon(18%_0,82%_0,100%_100%,0_100%)] [transform:rotateY(180deg)_translateZ(3.1px)]" />
            <div className="absolute left-[-3.6px] top-[-3.2px] h-[6.4px] w-[7.2px] rounded-[1px] border border-[#74747b] bg-[#45454a] [transform:rotateX(90deg)_translateZ(2.75px)]" />
            <div className="absolute left-[-5.6px] top-[-3.2px] h-[6.4px] w-[11.2px] rounded-[1px] border border-[#74747b] bg-[#303034] [transform:rotateX(-90deg)_translateZ(2.75px)]" />
          </div>
        </div>
      </div>
    </div>
  );
};

const MultiAngleModal = ({
  node,
  open,
  onClose,
  onGenerate,
}: {
  node: TNodeImage;
  open: boolean;
  onClose: () => void;
  onGenerate: (params: MultiAngleParams) => void;
}) => {
  const [params, setParams] = useState<MultiAngleParams>(DEFAULT_PARAMS);

  useEffect(() => {
    if (open) setParams(DEFAULT_PARAMS);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const orbitX = Math.sin(params.horizontal * Math.PI / 180) * 120;
  const orbitY = -Math.sin(params.vertical * Math.PI / 180) * 150;
  const orbitLength = Math.hypot(orbitX, orbitY) || 1;
  const coneX = -orbitY / orbitLength * 44;
  const coneY = orbitX / orbitLength * 44;
  const cameraX = 165 + orbitX;
  const cameraY = 165 + orbitY;
  const zoomIndex = params.zoom === "近" ? 0 : params.zoom === "标准" ? 1 : 2;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="多角度编辑" className="w-full max-w-[800px] rounded-[20px] border border-white/10 bg-[#202022] p-4 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">多角度编辑</h2>
          <button onClick={() => setParams(DEFAULT_PARAMS)} className="flex cursor-pointer items-center gap-1 text-xs text-white/50 hover:text-white">
            重置参数 <RotateCcw size={13} />
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-[390px_1fr]">
          <div className="relative flex min-h-[448px] items-center justify-center overflow-hidden rounded-xl bg-white/[0.035]">
            <button aria-label="向上调整" onClick={() => setParams((value) => ({ ...value, vertical: Math.min(60, value.vertical + 30) }))} className="absolute left-1/2 top-5 -translate-x-1/2 cursor-pointer text-white/40 hover:text-white"><ArrowUp size={18} /></button>
            <button aria-label="向下调整" onClick={() => setParams((value) => ({ ...value, vertical: Math.max(-30, value.vertical - 30) }))} className="absolute bottom-5 left-1/2 -translate-x-1/2 cursor-pointer text-white/40 hover:text-white"><ArrowDown size={18} /></button>
            <button aria-label="向左调整" onClick={() => setParams((value) => ({ ...value, horizontal: (value.horizontal + 315) % 360 }))} className="absolute left-5 top-1/2 -translate-y-1/2 cursor-pointer text-white/40 hover:text-white"><ArrowLeft size={18} /></button>
            <button aria-label="向右调整" onClick={() => setParams((value) => ({ ...value, horizontal: (value.horizontal + 45) % 360 }))} className="absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer text-white/40 hover:text-white"><ArrowRight size={18} /></button>
            <div className="relative size-[254px]">
              <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 254 254" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1">
                <circle cx="127" cy="127" r="126.5" />
                {Array.from({ length: 12 }, (_, index) => index * 30).map((angle) => <path key={`longitude-${angle}`} d={spherePath("longitude", angle, params.vertical)} />)}
                {[-60, -30, 0, 30, 60].map((angle) => <path key={`latitude-${angle}`} d={spherePath("latitude", angle, params.vertical)} />)}
              </svg>
              <svg className="pointer-events-none absolute inset-[-38px] z-[1] size-[330px] overflow-visible" viewBox="0 0 330 330">
                <polygon points={`${cameraX},${cameraY} ${165 + coneX},${165 + coneY} ${165 - coneX},${165 - coneY}`} fill="rgba(255,255,255,0.18)" />
                <line x1={cameraX} y1={cameraY} x2={165 + coneX} y2={165 + coneY} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line x1={cameraX} y1={cameraY} x2={165 - coneX} y2={165 - coneY} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              </svg>
              <div
                className="absolute left-1/2 top-1/2 z-[2] w-20 overflow-hidden rounded-md border border-white/30 shadow-2xl transition-transform duration-300"
                style={{ transform: `translate(-50%, -50%) scale(${zoomIndex === 0 ? 1.15 : zoomIndex === 2 ? 0.85 : 1})` }}
              >
                <img src={node.data.url} alt="原图预览" className="aspect-[3/4] w-full object-cover" />
              </div>
              <CameraModel
                url={node.data.url}
                horizontal={params.horizontal}
                vertical={params.vertical}
                onChange={(horizontal, vertical) => setParams((value) => ({ ...value, horizontal, vertical, direction: "自定义" }))}
              />
            </div>
          </div>
          <div className="flex flex-col py-2">
            <div className="flex flex-col gap-4">
            <section>
              <h3 className="mb-2 text-sm text-white/75">摄像机方位</h3>
              <div className="grid grid-cols-3 gap-2">
                {DIRECTIONS.map(({ label, horizontal, vertical, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => setParams((value) => ({ ...value, direction: label, horizontal, vertical }))}
                    className={`flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm transition-colors ${params.direction === label ? "bg-white/15 text-white" : "bg-white/[0.025] text-white/55 hover:bg-white/10 hover:text-white"}`}
                  >
                    {Icon ? <Icon size={15} /> : <span className="size-1 rounded-full bg-current" />}
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs text-white/75">水平</h3>
              <input aria-label="水平角度" type="range" min="0" max="360" step="0.1" value={params.horizontal} onChange={(event) => setParams((value) => ({ ...value, horizontal: Number(event.target.value), direction: "自定义" }))} className={SLIDER_CLASS} style={{ background: `linear-gradient(to right, rgba(255,255,255,.24) ${params.horizontal / 3.6}%, rgba(255,255,255,.1) ${params.horizontal / 3.6}%)` }} />
              <div className="mt-2 flex justify-between text-[10px] text-white/35">{[0, 45, 90, 135, 180, 225, 270, 315, 360].map((value) => <span key={value} className={params.horizontal === value ? "text-white" : ""}>{value}</span>)}</div>
            </section>
            <section>
              <h3 className="mb-2 text-xs text-white/75">垂直</h3>
              <input aria-label="垂直角度" type="range" min="-30" max="60" step="0.1" value={params.vertical} onChange={(event) => setParams((value) => ({ ...value, vertical: Number(event.target.value), direction: "自定义" }))} className={SLIDER_CLASS} style={{ background: `linear-gradient(to right, rgba(255,255,255,.24) ${(params.vertical + 30) / .9}%, rgba(255,255,255,.1) ${(params.vertical + 30) / .9}%)` }} />
              <div className="mt-2 flex justify-between text-[10px] text-white/35">{[-30, 0, 30, 60].map((value) => <span key={value} className={params.vertical === value ? "text-white" : ""}>{value}</span>)}</div>
            </section>
            <section>
              <h3 className="mb-2 text-xs text-white/75">景别缩放</h3>
              <input aria-label="景别缩放" type="range" min="0" max="2" step="1" value={zoomIndex} onChange={(event) => setParams((value) => ({ ...value, zoom: (["近", "标准", "远"] as const)[Number(event.target.value)] }))} className={SLIDER_CLASS} style={{ background: `linear-gradient(to right, rgba(255,255,255,.24) ${zoomIndex * 50}%, rgba(255,255,255,.1) ${zoomIndex * 50}%)` }} />
              <div className="mt-2 flex justify-between text-[10px] text-white/35">{(["近", "标准", "远"] as const).map((value) => <span key={value} className={params.zoom === value ? "text-white" : ""}>{value}</span>)}</div>
            </section>
            </div>
            <div className="mt-auto flex items-center justify-end gap-4 pt-6">
              <span className="flex items-center gap-1 text-xs text-white/50"><Sparkles size={13} /> 1</span>
              <button onClick={() => { onGenerate(params); onClose(); }} className="h-8 cursor-pointer rounded-lg bg-white px-6 text-sm font-medium text-black transition-colors hover:bg-white/85">生成</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MultiAngleModal;
