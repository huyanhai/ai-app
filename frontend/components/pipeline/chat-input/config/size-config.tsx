import { useRef } from "react";

import Ratio from "../ratio";
import { TNodeBase, TRatio } from "../../types/index";
import Popper, { IPopperRef } from "../../popper";
import { BUTTON_ACTIVE, BUTTON_NORMAL } from "@/constants/class-names";

const RATIO_CONFIG: TRatio[] = [
  "1:1",
  "9:16",
  "16:9",
  "3:4",
  "4:3",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

const COUNTS = [1, 2, 4];

interface IConfigProps extends TNodeBase {
  resolutions: string[];
  changeConfig: (config: TNodeBase["config"]) => void;
}

// 「比例 · 清晰度 · 数量」合并配置弹层（对齐即梦底部配置条）
const SizeConfig = ({ config, resolutions, changeConfig }: IConfigProps) => {
  const popperRef = useRef<IPopperRef>(null);

  return (
    <Popper
      ref={popperRef}
      content={`${config?.ratio} · ${config?.resolution} · ${config?.count}`}
      trigger={
        <div className="flex w-[300px] flex-col gap-2 p-1">
          <div className="grid grid-cols-4 gap-2">
            {RATIO_CONFIG.map((item) => (
              <Ratio
                key={item}
                ratio={item}
                className={`${BUTTON_NORMAL} ${
                  config?.ratio === item ? BUTTON_ACTIVE : ""
                }`}
                onClick={() => changeConfig({ ratio: item })}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {resolutions.map((item) => (
              <div
                key={item}
                className={`flex-1 px-3 py-2 text-center text-xs ${BUTTON_NORMAL} ${
                  config?.resolution === item ? BUTTON_ACTIVE : ""
                }`}
                onClick={() => changeConfig({ resolution: item })}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {COUNTS.map((item) => (
              <div
                key={item}
                className={`flex-1 px-3 py-2 text-center text-xs ${BUTTON_NORMAL} ${
                  config?.count === item ? BUTTON_ACTIVE : ""
                }`}
                onClick={() => changeConfig({ count: item })}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
};

export default SizeConfig;
