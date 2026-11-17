import { cn } from "@/lib/utils";

export function ProgressRing({ value, total, className }: { value: number; total: number; className?: string }) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const circumference = 2 * Math.PI * 7;
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-[18px] shrink-0 -rotate-90">
      <circle cx="9" cy="9" r="7" fill="none" strokeWidth="2" className="stroke-zinc-200" />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        className={cn("stroke-zinc-500 transition-[stroke-dashoffset] duration-200", className)}
      />
    </svg>
  );
}

