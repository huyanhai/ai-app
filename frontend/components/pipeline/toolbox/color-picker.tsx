"use client";

import { PointerEvent, useEffect, useRef } from "react";
import { Pipette } from "lucide-react";
import { hexToHsv, hsvToHex, hsvToRgb } from "./palette-color";

const WIDTH = 180;
const HEIGHT = 120;

const ColorPicker = ({
  color,
  onChange,
  onPickImage,
  pickingImage,
}: {
  color: string;
  onChange: (color: string) => void;
  onPickImage: () => void;
  pickingImage: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<"surface" | "hue" | null>(null);
  const hsv = hexToHsv(color);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = context.createImageData(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const [red, green, blue] = hsvToRgb(hsv.h, x / (WIDTH - 1), 1 - y / (HEIGHT - 1));
        const offset = (y * WIDTH + x) * 4;
        image.data[offset] = red;
        image.data[offset + 1] = green;
        image.data[offset + 2] = blue;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, [hsv.h]);

  const updateSurface = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    onChange(hsvToHex(hsv.h, saturation, value));
  };

  return (
    <div className="w-[210px] rounded-[13px] border border-white/10 bg-[#292929] p-3 shadow-2xl">
      <div
        className="relative h-[120px] touch-none select-none overflow-hidden rounded-md"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = "surface";
          updateSurface(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current === "surface") updateSurface(event);
        }}
        onPointerUp={() => { dragging.current = null; }}
        onPointerCancel={() => { dragging.current = null; }}
      >
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="size-full" aria-label="饱和度明度取色板" />
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: color }}
        />
      </div>
      <input
        aria-label="色相"
        type="range"
        min="0"
        max="359"
        value={Math.round(hsv.h)}
        onChange={(event) => onChange(hsvToHex(Number(event.target.value), hsv.s, hsv.v))}
        className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)] outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-1 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
      />
      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          aria-label="吸取图片颜色"
          aria-pressed={pickingImage}
          onClick={onPickImage}
          className={`flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
            pickingImage
              ? "border-white bg-white/15 text-white"
              : "border-white/15 text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Pipette size={11} />
        </button>
        <input
          aria-label="取色器色值"
          value={color}
          maxLength={7}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-6 min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-2 text-center font-mono text-[9px] uppercase text-white outline-none focus:border-white/40"
        />
      </div>
    </div>
  );
};

export default ColorPicker;
