import { Slider } from "@/components/ui/slider";
import { TNodeBase } from "../../types/index";

const DURATION = Array.from({ length: 12 }, (_, index) => index + 4);

interface IConfigProps extends TNodeBase {
  durations?: number[];
  changeConfig: (config: TNodeBase["config"]) => void;
}

const DurationConfig = ({ config, durations = DURATION, changeConfig }: IConfigProps) => {
  const options = [...(durations.length ? durations : DURATION)].sort((a, b) => a - b);
  const min = options[0];
  const max = options[options.length - 1];
  const duration = config?.duration && options.includes(config.duration) ? config.duration : min;

  return (
    <div className="w-full px-2 pb-1">
      <Slider
        aria-label="视频时长"
        aria-valuetext={`${duration}秒`}
        min={min}
        max={max}
        value={duration}
        showTicks
        tickValues={options}
        formatValue={(value) => `${value}s`}
        onValueChange={(value) => {
          const next = options.reduce((nearest, item) =>
            Math.abs(item - value) < Math.abs(nearest - value) ? item : nearest,
          );
          changeConfig({ duration: next, durationTouched: true });
        }}
      />
    </div>
  );
};

export default DurationConfig;
