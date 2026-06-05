import { useRef } from "react";

import Ratio from "./ratio";
import { TNodeBase, VideoModeType } from "../types/index";
import Popper, { IPopperRef } from "../popper";
import { BUTTON_ACTIVE, BUTTON_NORMAL } from "@/constants/class-names";

interface IConfigProps extends TNodeBase {
  changeConfig: (config: TNodeBase["config"]) => void;
}

const VideoConfig = ({ config, changeConfig }: IConfigProps) => {
  const popperRef = useRef<IPopperRef>(null);

  return (
    <Popper
      ref={popperRef}
      content={config?.videoMode}
      trigger={
        <div className="flex flex-col">
          {Object.values(VideoModeType).map((item, index) => (
            <div
              key={index}
              className={`p-2 ${BUTTON_NORMAL} ${config?.videoMode === item && BUTTON_ACTIVE}`}
              onClick={() => {
                changeConfig({ videoMode: item });
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
};

export default VideoConfig;
