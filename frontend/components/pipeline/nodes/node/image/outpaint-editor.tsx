"use client";

import { ArrowUp, LoaderCircle, RectangleHorizontal, RectangleVertical, Scan } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import Editor, { IEditorRef } from "../../../editor";
import OptionPopper from "../../../option-popper";
import { NodeType, TAllNodes, TNodeImage } from "../../../types";
import { outpaintSize } from "./outpaint-canvas";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";

const ratios = ["original", "21:9", "16:9", "4:3", "3:4", "9:16"];

const OutpaintEditor = ({ node, onSubmit }: { node: TNodeImage; onSubmit: () => void }) => {
  const editorRef = useRef<IEditorRef>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const { setNodes, getViewport } = useReactFlow<TAllNodes>();
  const processing = node.data.status === ChunkStatus.PROCESSING;
  const selectedRatio = node.data.outpaintRatio ?? "original";
  const originalRatio = node.data.config?.ratio ?? "1:1";

  const update = (data: Partial<TNodeImage["data"]>) => {
    setNodes((nodes) => nodes.map((item) =>
      item.id === node.id && item.type === NodeType.ImageNode
        ? { ...item, data: { ...item.data, ...data } }
        : item,
    ) as TAllNodes[]);
  };

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const layer = document.querySelector<HTMLElement>(`[data-outpaint-layer="${node.id}"]`);
    if (!panel || !layer) return;
    const zoom = getViewport().zoom;
    const panelRect = panel.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const baseTop = panelRect.top - offset.y * zoom;
    const baseLeft = panelRect.left - offset.x * zoom;
    const belowOffset = (layerRect.bottom + 12 - baseTop) / zoom;
    const aboveOffset = (layerRect.top - panelRect.height - 12 - baseTop) / zoom;
    const horizontalOffset = (layerRect.left + layerRect.width / 2 - panelRect.width / 2 - baseLeft) / zoom;
    const placeAbove = layerRect.bottom + panelRect.height + 24 > window.innerHeight && layerRect.top - panelRect.height - 12 >= 0;
    const nextOffset = placeAbove ? aboveOffset : belowOffset;
    if (Math.abs(nextOffset - offset.y) > 0.5 || Math.abs(horizontalOffset - offset.x) > 0.5) {
      setOffset({ x: horizontalOffset, y: nextOffset });
    }
  });

  return (
    <div ref={panelRef} className="nodrag nopan nowheel pointer-events-auto flex w-[560px] flex-col gap-3" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
      <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-[#26262a] p-1.5 text-xs text-white/60 shadow-2xl">
        <OptionPopper
          label={`${node.data.outpaintZoom ?? 1}x`}
          options={["0.5x", "1x", "1.5x", "2x"]}
          value={`${node.data.outpaintZoom ?? 1}x`}
          onChange={(value) => update({ outpaintZoom: parseFloat(String(value)) })}
        />
        <span className="mx-1 h-4 w-px bg-white/10" />
        {ratios.map((ratio) => {
          const Icon = ratio === "original" ? Scan : ["3:4", "9:16"].includes(ratio) ? RectangleVertical : RectangleHorizontal;
          return (
            <button
              key={ratio}
              onClick={() => {
                const size = outpaintSize(originalRatio, ratio);
                const original = outpaintSize(originalRatio, "original");
                update({
                  outpaintRatio: ratio,
                  outpaintWidth: size.width,
                  outpaintHeight: size.height,
                  outpaintX: (original.width - size.width) / 2,
                  outpaintY: (original.height - size.height) / 2,
                });
              }}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg ${selectedRatio === ratio ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
            >
              <Icon size={14} />{ratio === "original" ? "原比例" : ratio}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#1c1c1e] p-3 shadow-2xl">
        <div className="relative min-w-0 flex-1">
          <Editor
            ref={editorRef}
            images={[]}
            initialState=""
            noImageMention
            autoFocus={false}
            placeholder="描述你想如何修改图片"
            onSubmit={onSubmit}
            onTextChange={(outpaintPrompt) => update({ outpaintPrompt })}
          />
        </div>
        <span className="shrink-0 text-xs text-white/40">✦ 1</span>
        <button aria-label="生成扩图" disabled={processing} onClick={onSubmit} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:bg-white/10 disabled:text-white/30">
          {processing ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </div>
    </div>
  );
};

export default OutpaintEditor;
