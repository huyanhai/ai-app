"use client";
import { ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const INPUT =
  "h-9 w-full rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#33a3ff]/60 focus:bg-white/[0.07]";

// 表单项：标签 + 内容 + 提示 / 错误信息
export const Field = ({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    <label className="text-xs text-white/60">
      {label}
      {required && <span className="ml-0.5 text-[#ff6b6b]">*</span>}
    </label>
    {children}
    {error ? (
      <p className="text-xs text-[#ff6b6b]">{error}</p>
    ) : (
      hint && <p className="text-xs text-white/30">{hint}</p>
    )}
  </div>
);

// 密钥输入框，可切换明文显示
export const SecretInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT, "pr-9 font-mono")}
      />
      <button
        type="button"
        aria-label={visible ? "隐藏密钥" : "显示密钥"}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
};

// 选项按钮组，multiple 为多选
export function ChipGroup<T extends string | number>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  multiple?: false;
}): ReactNode;
export function ChipGroup<T extends string | number>(props: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multiple: true;
}): ReactNode;
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  multiple,
}: {
  options: { value: T; label: string }[];
  value: T | T[];
  onChange: ((v: T) => void) | ((v: T[]) => void);
  multiple?: boolean;
}) {
  const isActive = (v: T) =>
    Array.isArray(value) ? value.includes(v) : value === v;

  const select = (v: T) => {
    if (!multiple) {
      (onChange as (v: T) => void)(v);
      return;
    }
    const list = value as T[];
    const next = list.includes(v)
      ? list.filter((item) => item !== v)
      : // 保持与选项列表一致的顺序
        options.map((o) => o.value).filter((o) => o === v || list.includes(o));
    (onChange as (v: T[]) => void)(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={isActive(option.value)}
          onClick={() => select(option.value)}
          className={cn(
            "h-8 rounded-lg border px-3 text-xs transition-colors cursor-pointer",
            isActive(option.value)
              ? "border-[#33a3ff]/50 bg-[#33a3ff]/15 text-white"
              : "border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/10",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// 开关
export const Switch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer",
      checked ? "bg-white" : "bg-white/15",
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 left-0.5 size-4 rounded-full shadow transition-transform",
        checked ? "translate-x-4 bg-[#181818]" : "bg-white/70",
      )}
    />
  </button>
);

// 带说明的开关行
export const SwitchRow = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5">
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-white/80">{label}</span>
      {hint && <span className="text-xs text-white/30">{hint}</span>}
    </div>
    <Switch checked={checked} onChange={onChange} label={label} />
  </div>
);

// 数字输入（空值时回退为 min，失焦时校正到范围内）
export const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) => (
  <div className="relative">
    <input
      type="number"
      value={Number.isNaN(value) ? "" : value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.valueAsNumber)}
      onBlur={() =>
        onChange(
          Number.isNaN(value) ? min : Math.min(max, Math.max(min, value)),
        )
      }
      className={cn(INPUT, suffix && "pr-12")}
    />
    {suffix && (
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/30">
        {suffix}
      </span>
    )}
  </div>
);

// 滑块 + 数值
export const Slider = ({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) => (
  <div className="flex h-9 items-center gap-3">
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.valueAsNumber)}
      className="h-1 flex-1 cursor-pointer accent-[#33a3ff]"
    />
    <span className="w-8 text-right font-mono text-xs text-white/70">
      {value.toFixed(1)}
    </span>
  </div>
);
