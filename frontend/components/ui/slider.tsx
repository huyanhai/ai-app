"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "min" | "max" | "step" | "onChange"
> & {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  showValue?: boolean;
  showLimits?: boolean;
  showTicks?: boolean;
  tickValues?: number[];
  formatValue?: (value: number) => ReactNode;
};

const Slider = ({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  showValue = true,
  showLimits = true,
  showTicks = false,
  tickValues,
  formatValue = String,
  className,
  "aria-valuetext": ariaValueText,
  ...props
}: SliderProps) => {
  const progress = max === min ? 0 : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const generatedTicks = showTicks && !tickValues && max > min && step > 0
    ? Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step)
    : [];
  const ticks = (tickValues ?? generatedTicks).filter((tick) => tick >= min && tick <= max);
  const formattedValue = formatValue(value);
  const valueText = typeof formattedValue === "string" || typeof formattedValue === "number"
    ? String(formattedValue)
    : String(value);

  return (
    <div className={cn("w-full min-w-0", showValue && "pt-6", className)}>
      <div className="relative mx-1.5 h-5">
        <input
          {...props}
          aria-valuetext={ariaValueText ?? valueText}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onValueChange(event.target.valueAsNumber)}
          className="peer absolute inset-0 z-10 block h-5 w-full cursor-pointer appearance-none rounded-md bg-transparent outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60 disabled:cursor-not-allowed [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:opacity-0 [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:opacity-0"
        />
        {showValue && (
          <div
            className="pointer-events-none absolute -top-6 text-sm font-medium whitespace-nowrap text-white/90 peer-disabled:opacity-40"
            style={{ left: `${progress}%`, transform: `translateX(-${progress}%)` }}
          >
            {formattedValue}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15 peer-disabled:opacity-40">
          <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          {showTicks && ticks.map((tick, index) => (
            <span
              key={`${tick}-${index}`}
              className={cn(
                "absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
                tick <= value ? "bg-white" : "bg-white/30",
              )}
              style={{ left: `${max === min ? 0 : ((tick - min) / (max - min)) * 100}%` }}
            />
          ))}
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{ left: `${progress}%` }}
          />
        </div>
      </div>
      {showLimits && (
        <div className="mt-1 flex justify-between text-xs text-white/40">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      )}
    </div>
  );
};

export { Slider };
export type { SliderProps };
