import { useRef } from "react";

import Ratio from "./ratio";
import { TNodeBase } from "../types/index";
import Popper, { IPopperRef } from "../popper";

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
        <>
          {RATIO_CONFIG.map((item, index) => (
            <Ratio
              className={
                config?.ratio === item
                  ? "border border-white/20 bg-black/50 rounded-md"
                  : "border border-white/0 rounded-md cursor-pointer hover:border-white/20 hover:bg-white/5"
              }
              key={index}
              ratio={item}
              onClick={() => {
                changeConfig({ ratio: item });
                popperRef.current?.closePopper();
              }}
            />
          ))}
        </>
      }
    />
  );
};

export default RadioConfig;
