import { useRef } from "react";

import { TNodeBase, VideoModeType } from "../../types/index";
import Popper, { IPopperRef } from "../../popper";
import { BUTTON_ACTIVE, BUTTON_NORMAL } from "@/constants/class-names";

const DURATION = [5, 10, 15];

interface IConfigProps extends TNodeBase {
  changeConfig: (config: TNodeBase["config"]) => void;
}

const DurationConfig = ({ config, changeConfig }: IConfigProps) => {
  const popperRef = useRef<IPopperRef>(null);

  return (
    <Popper
      ref={popperRef}
      content={config?.duration! + "s"}
      trigger={
        <div className="flex flex-col gap-1">
          {DURATION.map((item, index) => (
            <div
              key={index}
              className={`p-2 ${BUTTON_NORMAL} ${config?.duration === item && BUTTON_ACTIVE}`}
              onClick={() => {
                changeConfig({ duration: item });
                popperRef.current?.closePopper();
              }}
            >
              {item}s
            </div>
          ))}
        </div>
      }
    />
  );
};

export default DurationConfig;
