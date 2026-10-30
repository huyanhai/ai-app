import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  tooltipPosition?: "right";
};

export function IconButton({
  label,
  active = false,
  tooltipPosition,
  children,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={tooltipPosition ? undefined : label}
      className={cn(
        "group relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25",
        active && "bg-white/10 text-white",
        className,
      )}
      {...props}
    >
      {children}
      {tooltipPosition === "right" && (
        <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#2b2b2b] px-2.5 py-1.5 text-[11px] font-normal text-white/85 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {label}
        </span>
      )}
    </button>
  );
}
