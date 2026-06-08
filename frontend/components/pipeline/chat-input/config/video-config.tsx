import { useRef } from "react";

import { TNodeBase, VideoModeType } from "../../types/index";
import Popper, { IPopperRef } from "../../popper";
import { BUTTON_ACTIVE, BUTTON_NORMAL } from "@/constants/class-names";

const videoModeMap = {
  [VideoModeType.TextToVideo]: "文生视频",
  [VideoModeType.ImageToVideo]: "图生视频",
  [VideoModeType.FirstAndLastFrameToVideo]: "首尾帧",
};

interface IConfigProps extends TNodeBase {
  changeConfig: (config: TNodeBase["config"]) => void;
}

const VideoConfig = ({ config, changeConfig }: IConfigProps) => {
  const popperRef = useRef<IPopperRef>(null);

  return (
    <Popper
      ref={popperRef}
      content={videoModeMap[config?.videoMode!]}
      trigger={
        <div className="flex flex-col gap-1">
          {Object.values(VideoModeType).map((item, index) => (
            <div
              key={index}
              className={`p-2 ${BUTTON_NORMAL} ${config?.videoMode === item && BUTTON_ACTIVE}`}
              onClick={() => {
                changeConfig({ videoMode: item });
                popperRef.current?.closePopper();
              }}
            >
              {videoModeMap[item]}
            </div>
          ))}
        </div>
      }
    />
  );
};

export default VideoConfig;
