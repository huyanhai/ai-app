"use client";

import { useEffect, useRef, useState } from "react";
import {
  Brush,
  Eraser,
  LoaderCircle,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { usePipelineStore } from "@/store/pipeline-store";

type CutoutEditorProps = {
  url: string;
  width: number;
  height: number;
};

const CutoutEditor = ({ url, width, height }: CutoutEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternRef = useRef<CanvasPattern | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const pastRef = useRef<ImageData[]>([]);
  const futureRef = useRef<ImageData[]>([]);
  const generateTimerRef = useRef<number | null>(null);
  const close = usePipelineStore((state) => state.setImageEditor);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(32);
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false });
  const [, setHistoryVersion] = useState(0);
  const canvasWidth = 600;
  const canvasHeight = Math.round(canvasWidth * height / width);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const checker = document.createElement("canvas");
      checker.width = 20;
      checker.height = 20;
      const checkerContext = checker.getContext("2d");
      if (!checkerContext) return;
      checkerContext.fillStyle = "rgba(78, 119, 222, 0.56)";
      checkerContext.fillRect(0, 0, 20, 20);
      checkerContext.fillStyle = "rgba(127, 157, 235, 0.56)";
      checkerContext.fillRect(0, 0, 10, 10);
      checkerContext.fillRect(10, 10, 10, 10);
      patternRef.current = context.createPattern(checker, "repeat");
      if (!patternRef.current) return;

      context.fillStyle = patternRef.current;
      context.beginPath();
      context.ellipse(canvasWidth * 0.5, canvasHeight * 0.6, canvasWidth * 0.3, canvasHeight * 0.37, 0, 0, Math.PI * 2);
      context.ellipse(canvasWidth * 0.5, canvasHeight * 0.25, canvasWidth * 0.17, canvasHeight * 0.19, 0, 0, Math.PI * 2);
      context.fill();
      pastRef.current = [];
      futureRef.current = [];
      setHistoryVersion((version) => version + 1);
      setLoading(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [canvasHeight, canvasWidth]);

  useEffect(() => () => {
    if (generateTimerRef.current) window.clearTimeout(generateTimerRef.current);
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  };

  const paintTo = (point: { x: number; y: number }) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context || !patternRef.current) return;
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = patternRef.current;
    context.fillStyle = patternRef.current;
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  };

  const undo = () => {
    const context = canvasRef.current?.getContext("2d");
    const previous = pastRef.current.pop();
    if (!context || !previous || !canvasRef.current) return;
    futureRef.current.push(context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    context.putImageData(previous, 0, 0);
    setHistoryVersion((version) => version + 1);
  };

  const redo = () => {
    const context = canvasRef.current?.getContext("2d");
    const next = futureRef.current.pop();
    if (!context || !next || !canvasRef.current) return;
    pastRef.current.push(context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    context.putImageData(next, 0, 0);
    setHistoryVersion((version) => version + 1);
  };

  const simulateGenerate = () => {
    setGenerating(true);
    setMessage("");
    generateTimerRef.current = window.setTimeout(() => {
      setGenerating(false);
      setMessage("演示完成，暂未接入模型接口");
    }, 900);
  };

  const toolButtonClass = (active: boolean) =>
    `flex size-8 items-center justify-center rounded-lg transition-colors ${active ? "bg-white/12 text-white" : "text-white/55 hover:bg-white/8 hover:text-white"}`;

  return (
    <div className="relative" style={{ width, height }}>
      {(loading || message) && (
        <div className="nodrag nopan absolute bottom-full left-1/2 z-20 mb-3 flex h-10 -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-xl border border-white/5 bg-[#26262a] px-4 text-xs text-white/80 shadow-2xl">
          {loading && <LoaderCircle size={14} className="animate-spin" />}
          {loading ? "智能识别选区中…" : message}
          {loading && (
            <button onClick={() => close(null)} className="ml-2 text-white/50 hover:text-white">取消</button>
          )}
        </div>
      )}
      <div className="nodrag nopan nowheel relative size-full touch-none overflow-hidden rounded-2xl border border-white/5 bg-[#1f1f22]">
        <img src={url} alt="抠图原图" draggable={false} className="pointer-events-none size-full object-cover" />
        <canvas
          ref={canvasRef}
          aria-label="抠图选区"
          className={`absolute inset-0 size-full ${loading ? "cursor-default opacity-0" : "cursor-none opacity-100"}`}
          onPointerDown={(event) => {
            if (loading || generating || event.button !== 0) return;
            const canvas = event.currentTarget;
            const context = canvas.getContext("2d");
            if (!context) return;
            pastRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height));
            if (pastRef.current.length > 20) pastRef.current.shift();
            futureRef.current = [];
            setHistoryVersion((version) => version + 1);
            setMessage("");
            drawingRef.current = true;
            lastPointRef.current = pointFromEvent(event);
            canvas.setPointerCapture(event.pointerId);
            paintTo(lastPointRef.current);
          }}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setCursor({
              x: (event.clientX - rect.left) * width / rect.width,
              y: (event.clientY - rect.top) * height / rect.height,
              visible: true,
            });
            if (drawingRef.current) paintTo(pointFromEvent(event));
          }}
          onPointerEnter={() => setCursor((current) => ({ ...current, visible: true }))}
          onPointerLeave={() => setCursor((current) => ({ ...current, visible: false }))}
          onPointerUp={() => { drawingRef.current = false; }}
          onPointerCancel={() => { drawingRef.current = false; }}
        />
        {!loading && cursor.visible && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black/5 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            style={{
              left: cursor.x,
              top: cursor.y,
              width: brushSize * width / canvasWidth,
              height: brushSize * width / canvasWidth,
            }}
          />
        )}
      </div>
      <div className="nodrag nopan nowheel absolute left-1/2 top-full z-20 mt-3 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-xl border border-white/5 bg-[#26262a] p-1.5 text-xs text-white/60 shadow-2xl">
        <button aria-label="画笔增选" title="画笔增选" onClick={() => setTool("brush")} className={toolButtonClass(tool === "brush")}>
          <Brush size={15} />
        </button>
        <button aria-label="橡皮擦减选" title="橡皮擦减选" onClick={() => setTool("eraser")} className={toolButtonClass(tool === "eraser")}>
          <Eraser size={15} />
        </button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <input
          aria-label="笔刷大小"
          type="range"
          min="8"
          max="72"
          value={brushSize}
          onChange={(event) => setBrushSize(Number(event.target.value))}
          className="mx-2 h-1 w-24 cursor-pointer accent-white"
        />
        <span className="w-7 text-right text-xs tabular-nums text-white/70">{brushSize}</span>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button aria-label="撤销" title="撤销" disabled={!pastRef.current.length} onClick={undo} className={toolButtonClass(false) + " disabled:opacity-25"}>
          <Undo2 size={15} />
        </button>
        <button aria-label="重做" title="重做" disabled={!futureRef.current.length} onClick={redo} className={toolButtonClass(false) + " disabled:opacity-25"}>
          <Redo2 size={15} />
        </button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button
          disabled={loading || generating}
          onClick={simulateGenerate}
          className="flex h-8 min-w-20 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm text-black disabled:bg-white/10 disabled:text-white/30"
        >
          {generating && <LoaderCircle size={14} className="animate-spin" />}
          生成
        </button>
        <button aria-label="退出抠图" title="退出抠图" onClick={() => close(null)} className={toolButtonClass(false)}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export default CutoutEditor;
