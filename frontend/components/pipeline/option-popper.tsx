"use client";

import { useRef } from "react";
import { BUTTON_ACTIVE, BUTTON_NORMAL } from "@/constants/class-names";
import Popper, { type IPopperRef } from "./popper";

interface OptionPopperProps {
  label: string;
  labelClassName?: string;
  options: (string | number)[];
  value?: string | number;
  onChange?: (value: string | number) => void;
}

export default function OptionPopper({ label, labelClassName, options, value, onChange }: OptionPopperProps) {
  const popperRef = useRef<IPopperRef>(null);

  return (
    <Popper
      ref={popperRef}
      content={<span className={labelClassName} title={label}>{label}</span>}
      trigger={
        <div className="flex min-w-24 flex-col gap-1">
          {options.map((item) => (
            <div
              key={item}
              className={`px-3 py-2 text-xs ${BUTTON_NORMAL} ${value === item ? BUTTON_ACTIVE : ""}`}
              onClick={() => {
                onChange?.(item);
                popperRef.current?.closePopper();
              }}
            >
              {item}
            </div>
          ))}
        </div>
      }
    />
  );
}
