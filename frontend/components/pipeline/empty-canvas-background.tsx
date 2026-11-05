"use client";

import { useEffect, useRef } from "react";
import { MousePointer2 } from "lucide-react";

type Dot = {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  alpha: number;
  phase: number;
  color: string;
};

type Ripple = { x: number; y: number; bornAt: number };

const DOT_GAP = 24;
const POINTER_RADIUS = 170;
const RIPPLE_LIFE = 1100;
const CURSOR_HOTSPOT_OFFSET_X = 11.6;
const CURSOR_HOTSPOT_OFFSET_Y = 6.9;

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const noise = (x: number, y: number) => {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const fractionX = x - left;
  const fractionY = y - top;
  const easeX = fractionX * fractionX * (3 - 2 * fractionX);
  const easeY = fractionY * fractionY * (3 - 2 * fractionY);
  const topLeft = hash(left, top);
  const topRight = hash(left + 1, top);
  const bottomLeft = hash(left, top + 1);
  const bottomRight = hash(left + 1, top + 1);
  const upper = topLeft + (topRight - topLeft) * easeX;
  const lower = bottomLeft + (bottomRight - bottomLeft) * easeX;
  return upper + (lower - upper) * easeY;
};

export default function EmptyCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const hint = hintRef.current;
    const cursor = cursorRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !container || !hint || !cursor || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pane = container.parentElement?.querySelector<HTMLElement>(".react-flow__pane");
    const previousCursor = pane?.style.cursor;
    if (pane && !reducedMotion) pane.style.cursor = "none";
    const pointer = { x: 0, y: 0, active: false };
    const ripples: Ripple[] = [];
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastRippleAt = 0;
    let lastRippleX = 0;
    let lastRippleY = 0;
    let hintX = 0;
    let hintY = 0;

    const rebuild = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      hintX = pointer.active ? pointer.x : width / 2;
      hintY = pointer.active ? pointer.y : height / 2;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      dots = [];
      const columns = Math.ceil(width / DOT_GAP) + 2;
      const rows = Math.ceil(height / DOT_GAP) + 2;
      for (let row = -1; row < rows; row += 1) {
        for (let column = -1; column < columns; column += 1) {
          const x = column * DOT_GAP;
          const y = row * DOT_GAP;
          const broadNoise = noise(column / 13, row / 13);
          const detailNoise = noise(column / 4, row / 4);
          const colorNoise = noise(column / 18 + 20, row / 18 + 20);
          dots.push({
            x: x + (detailNoise - 0.5) * 5,
            y: y + (broadNoise - 0.5) * 5,
            offsetX: 0,
            offsetY: 0,
            velocityX: 0,
            velocityY: 0,
            radius: 0.65 + detailNoise * 0.85,
            alpha: 0.18 + broadNoise * 0.32,
            phase: hash(column + 40, row + 40) * Math.PI * 2,
            color: `${155 + colorNoise * 175} 82% ${55 + detailNoise * 16}%`,
          });
        }
      }
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      while (ripples.length && time - ripples[0].bornAt > RIPPLE_LIFE) ripples.shift();

      const hintTargetX = pointer.active && !reducedMotion ? pointer.x : width / 2;
      const hintTargetY = pointer.active && !reducedMotion ? pointer.y : height / 2;
      hintX += (hintTargetX - hintX) * 0.075;
      hintY += (hintTargetY - hintY) * 0.075;
      hint.style.transform = `translate(${hintX - width / 2}px, ${hintY - height / 2}px)`;
      const cursorX = pointer.active && !reducedMotion ? pointer.x - hintX + CURSOR_HOTSPOT_OFFSET_X : 0;
      const cursorY = pointer.active && !reducedMotion ? pointer.y - hintY + CURSOR_HOTSPOT_OFFSET_Y : 0;
      cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) rotate(-12deg)`;

      for (const dot of dots) {
        let targetX = 0;
        let targetY = 0;
        let energy = 0;

        if (!reducedMotion && pointer.active) {
          const deltaX = dot.x - pointer.x;
          const deltaY = dot.y - pointer.y;
          const distance = Math.hypot(deltaX, deltaY) || 1;
          if (distance < POINTER_RADIUS) {
            const force = (1 - distance / POINTER_RADIUS) ** 2;
            targetX += (deltaX / distance) * force * 52;
            targetY += (deltaY / distance) * force * 52;
            energy = Math.max(energy, force);
          }
        }

        if (!reducedMotion) {
          for (const ripple of ripples) {
            const age = time - ripple.bornAt;
            const progress = age / RIPPLE_LIFE;
            const radius = progress * 260;
            const centerX = pointer.active ? pointer.x : ripple.x;
            const centerY = pointer.active ? pointer.y : ripple.y;
            const deltaX = dot.x - centerX;
            const deltaY = dot.y - centerY;
            const distance = Math.hypot(deltaX, deltaY) || 1;
            const band = Math.abs(distance - radius);
            if (band < 65) {
              const force = (1 - band / 65) * (1 - progress) * 0.75;
              targetX += (deltaX / distance) * force * 34;
              targetY += (deltaY / distance) * force * 34;
              energy = Math.max(energy, force);
            }
          }
        }

        dot.velocityX = (dot.velocityX + (targetX - dot.offsetX) * 0.12) * 0.74;
        dot.velocityY = (dot.velocityY + (targetY - dot.offsetY) * 0.12) * 0.74;
        dot.offsetX += dot.velocityX;
        dot.offsetY += dot.velocityY;

        const pulse = reducedMotion ? 0 : Math.sin(time * 0.0007 + dot.phase) * 0.045;
        const alpha = Math.min(0.9, dot.alpha + pulse + energy * 0.48);
        const radius = dot.radius + energy * 1.25;
        context.beginPath();
        context.arc(dot.x + dot.offsetX, dot.y + dot.offsetY, radius, 0, Math.PI * 2);
        context.fillStyle = `hsl(${dot.color} / ${alpha})`;
        context.fill();
      }

      if (!reducedMotion && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const target = event.target as HTMLElement | null;
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = pointer.x >= 0 && pointer.x <= rect.width && pointer.y >= 0 && pointer.y <= rect.height && Boolean(target?.closest(".react-flow__pane"));
      if (!pointer.active || reducedMotion) return;

      const now = performance.now();
      const moved = Math.hypot(pointer.x - lastRippleX, pointer.y - lastRippleY);
      if (now - lastRippleAt > 55 && moved > 12) {
        ripples.push({ x: pointer.x, y: pointer.y, bornAt: now });
        if (ripples.length > 12) ripples.shift();
        lastRippleAt = now;
        lastRippleX = pointer.x;
        lastRippleY = pointer.y;
      }
    };

    const onVisibilityChange = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reducedMotion) frame = requestAnimationFrame(draw);
    };

    rebuild();
    const resizeObserver = new ResizeObserver(rebuild);
    resizeObserver.observe(container);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (reducedMotion) draw(0);
    else frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (pane) pane.style.cursor = previousCursor ?? "";
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div ref={hintRef} className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-14 whitespace-nowrap text-2xl text-white/45 will-change-transform">
        <span>右击画布</span>
        <MousePointer2 ref={cursorRef} size={30} className="fill-sky-400/20 text-sky-400 will-change-transform" />
        <span>创建节点</span>
      </div>
    </div>
  );
}
