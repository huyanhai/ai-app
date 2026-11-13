"use client";

import { PointerEvent, useEffect, useRef } from "react";
import { hexToHsv, hsvToHex, hsvToRgb } from "./palette-color";

const CANVAS_SIZE = 360;

const ColorWheel = ({
  colors,
  activeIndex,
  onSelect,
  onChange,
}: {
  colors: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onChange: (index: number, color: string) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingIndex = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = context.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    const center = CANVAS_SIZE / 2;
    for (let y = 0; y < CANVAS_SIZE; y += 1) {
      for (let x = 0; x < CANVAS_SIZE; x += 1) {
        const offset = (y * CANVAS_SIZE + x) * 4;
        const deltaX = x - center;
        const deltaY = y - center;
        const radius = Math.sqrt(deltaX ** 2 + deltaY ** 2) / center;
        if (radius > 1) continue;
        const hue = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
        const [red, green, blue] = hsvToRgb(hue, radius, 1);
        image.data[offset] = red;
        image.data[offset + 1] = green;
        image.data[offset + 2] = blue;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }, []);

  const updateColor = (event: PointerEvent<HTMLElement>, index: number) => {
    const wheel = canvasRef.current?.parentElement;
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    const hue = (Math.atan2(y, x) * 180) / Math.PI;
    const saturation = Math.min(1, Math.sqrt(x ** 2 + y ** 2));
    onChange(index, hsvToHex(hue, saturation, 1));
  };

  const startDragging = (event: PointerEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingIndex.current = index;
    onSelect(index);
    updateColor(event, index);
  };

  return (
    <div
      className="relative aspect-square touch-none select-none rounded-full"
      onPointerDown={(event) => startDragging(event, activeIndex)}
      onPointerMove={(event) => {
        if (draggingIndex.current !== null) updateColor(event, draggingIndex.current);
      }}
      onPointerUp={() => { draggingIndex.current = null; }}
      onPointerCancel={() => { draggingIndex.current = null; }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        aria-label="色轮"
        className="size-full rounded-full"
      />
      {colors.map((color, index) => {
        const hsv = hexToHsv(color);
        const angle = (hsv.h * Math.PI) / 180;
        const left = 50 + Math.cos(angle) * hsv.s * 50;
        const top = 50 + Math.sin(angle) * hsv.s * 50;
        return (
          <button
            key={index}
            type="button"
            aria-label={`颜色 ${index + 1} 色轮标记`}
            onPointerDown={(event) => {
              event.stopPropagation();
              startDragging(event, index);
            }}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.16)] transition-[width,height] cursor-grab active:cursor-grabbing ${
              activeIndex === index ? "size-4.5" : "size-3.5"
            }`}
            style={{ left: `${left}%`, top: `${top}%`, backgroundColor: color }}
          />
        );
      })}
    </div>
  );
};

export default ColorWheel;
