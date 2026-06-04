import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TRatio } from "../types";

interface IRatioProps {
  ratio: TRatio;
  className?: string;
  onClick: () => void;
}

const Ratio = ({ ratio, className, onClick }: IRatioProps) => {
  let [width, height] = ratio.split(":").map((s) => Number(s));

  const [realWidth, realHeight] = useMemo(() => {
    if (width < 12 && height < 12) {
      const max = Math.max(12 / width, height / 12);
      return [width * max, height * max];
    }
    return [width, height];
  }, [width, height]);

  return (
    <button
      type="button"
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border-solid px-1 py-3 transition-colors duration-200",
        className,
      )}
      onClick={onClick}
    >
      <span className="flex size-[17px] items-center justify-center">
        <span
          className="flex-none rounded-[2px] border-[1.5px] border-current"
          style={{ width: realWidth, height: realHeight }}
        ></span>
      </span>
      <span className="text-xs">
        {width}:{height}
      </span>
    </button>
  );
};

export default Ratio;
