import { useRef } from "react";

import Ratio from "./ratio";
import { TNodeBase } from "../types/index";
import Popper, { IPopperRef } from "../popper";
import { BUTTON_ACTIVE, BUTTON_NORMAL } from "@/constants/class-names";

const RATIO_CONFIG: `${number}:${number}`[] = [
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

interface IConfigProps extends TNodeBase {
  changeConfig: (config: TNodeBase["config"]) => void;
}

const RadioConfig = ({ config, changeConfig }: IConfigProps) => {
  const popperRef = useRef<IPopperRef>(null);

  return (
    <Popper
      ref={popperRef}
      content={config?.ratio}
      trigger={
        <div className="grid grid-cols-4 gap-2 w-[300px]">
          {RATIO_CONFIG.map((item, index) => (
            <Ratio
              className={`${BUTTON_NORMAL} ${config?.ratio === item && BUTTON_ACTIVE}`}
              key={index}
              ratio={item}
              onClick={() => {
                changeConfig({ ratio: item });
                popperRef.current?.closePopper();
              }}
            />
          ))}
        </div>
      }
    />
  );
};

export default RadioConfig;
