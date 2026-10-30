"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex h-10 items-center justify-between text-xs text-white/55">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? "bg-white" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full transition ${
            checked ? "left-[18px] bg-[#181818]" : "left-0.5 bg-white/70"
          }`}
        />
      </button>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = 0.1,
  min = -999,
  max = 999,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  return (
    <div className="flex h-10 items-center rounded-md bg-white/[0.045] px-3 text-xs hover:bg-white/[0.065]">
      <button
        type="button"
        aria-label={`${label}, drag horizontally to adjust`}
        className="shrink-0 cursor-ew-resize text-left text-white/45"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, value };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const next = drag.current.value + (event.clientX - drag.current.x) * step;
          onChange(Math.min(max, Math.max(min, Number(next.toFixed(2)))));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {label}
      </button>
      <input
        aria-label={label}
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="ml-auto w-14 min-w-0 bg-transparent text-right text-white/75 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="ml-1 text-white/35">{suffix}</span>}
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value.toUpperCase());
  useEffect(() => setDraft(value.toUpperCase()), [value]);
  return (
    <div className="flex h-10 items-center text-xs text-white/50">
      <span>{label}</span>
      <div className="ml-auto flex items-center gap-2">
        <label className="relative size-6 overflow-hidden rounded-md border border-white/10" style={{ background: value }}>
          <input
            aria-label={label}
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          aria-label={label}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) onChange(event.target.value);
          }}
          onBlur={() => setDraft(value.toUpperCase())}
          className="h-8 w-24 rounded-md bg-white/[0.045] px-2 text-white/70 outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>
    </div>
  );
}

export function StageModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-[420px] rounded-xl border border-white/10 bg-[#242424] p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">{title}</h2>
          <button type="button" aria-label="关闭" onClick={onClose} className="text-lg text-white/45 hover:text-white">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
