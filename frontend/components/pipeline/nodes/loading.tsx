"use client";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

const DOT_SPACING = 14;
const DOT_RADIUS = 1.2;
const NOISE_STRENGTH = 180;
const BAND_WIDTH = 36;
const CYCLE_DURATION = 2800;

interface IDot {
  x: number;
  y: number;
  noise: number;
}

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const noise = (x: number, y: number) => {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const offsetX = x - left;
  const offsetY = y - top;
  const smoothX = offsetX * offsetX * (3 - 2 * offsetX);
  const smoothY = offsetY * offsetY * (3 - 2 * offsetY);
  const topValue =
    hash(left, top) * (1 - smoothX) + hash(left + 1, top) * smoothX;
  const bottomValue =
    hash(left, top + 1) * (1 - smoothX) +
    hash(left + 1, top + 1) * smoothX;
  return topValue * (1 - smoothY) + bottomValue * smoothY;
};

// 图片 / 视频 / 音频共用的生成中过渡层：均匀波点随噪波扩散显示 + 顶部不确定进度条
const Loading = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let maxRadius = 0;
    let dots: IDot[] = [];
    let frame = 0;
    const startTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      maxRadius = Math.hypot(width, height) / 2;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      dots = [];
      for (let y = DOT_SPACING / 2; y < height; y += DOT_SPACING) {
        for (let x = DOT_SPACING / 2; x < width; x += DOT_SPACING) {
          dots.push({
            x,
            y,
            noise:
              noise(x / 52, y / 52) * 0.45 +
              noise(x / 22, y / 22) * 0.35 +
              noise(x / 9, y / 9) * 0.2,
          });
        }
      }
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const progress = ((time - startTime) % CYCLE_DURATION) / CYCLE_DURATION;
      const radius = progress * maxRadius;

      context.fillStyle = "rgba(255, 255, 255, 0.8)";
      context.beginPath();
      dots.forEach((dot) => {
        const distance = Math.hypot(dot.x - width / 2, dot.y - height / 2);
        const noisyDistance = distance + (dot.noise - 0.5) * NOISE_STRENGTH;
        const edgeDistance = Math.abs(noisyDistance - radius);
        if (edgeDistance > BAND_WIDTH) return;
        const strength = 1 - edgeDistance / BAND_WIDTH;
        const dotRadius = DOT_RADIUS * (0.4 + strength * 0.8);
        context.moveTo(dot.x + dotRadius, dot.y);
        context.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
      });
      context.fill();

      frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frame = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-10 overflow-hidden bg-[#1f1f22]"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 size-full mix-blend-screen"
      />
    </motion.div>
  );
};

export default Loading;
