"use client";
import {
  memo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { NodeProps } from "@xyflow/react";
import { AudioLines, Pause, Play } from "lucide-react";
import { AnimatePresence } from "motion/react";
import NodeShell from "./shell";
import { TNodeAudio, NodeType } from "../../types";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import Loading from "../loading";

// 即梦风格音频内容卡片：空态居中音频图标
const AudioNode = ({ id, data, selected }: NodeProps<TNodeAudio>) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const formatTime = (value: number) => {
    if (!Number.isFinite(value)) return "00:00:00";
    const hours = Math.floor(value / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((value % 3600) / 60).toString().padStart(2, "0");
    const seconds = Math.floor(value % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  const scrub = (
    element: HTMLElement,
    clientX: number,
  ) => {
    if (!audioRef.current || !duration) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time = ratio * duration;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const startScrubbing = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub(event.currentTarget, event.clientX);
  };

  const stopScrubbing = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <NodeShell
      id={id}
      type={NodeType.AudioNode}
      selected={selected}
      title={data.title}
      icon={<AudioLines size={12} />}
    >
      <div className="relative flex size-[250px] items-center justify-center overflow-hidden rounded-2xl bg-[#1f1f22] border border-white/5">
        <AnimatePresence>
          {data.status === ChunkStatus.PROCESSING && <Loading />}
        </AnimatePresence>
        {data.url ? (
          <div className="relative h-full w-full px-5 py-5">
            <audio
              ref={audioRef}
              src={data.url}
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            />
            <div
              role="slider"
              aria-label="播放进度"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              tabIndex={0}
              onPointerDown={startScrubbing}
              onPointerMove={(event) => {
                if (draggingRef.current) {
                  scrub(event.currentTarget, event.clientX);
                }
              }}
              onPointerUp={stopScrubbing}
              onPointerCancel={stopScrubbing}
              className={`nodrag nopan absolute left-5 right-5 top-1/2 flex h-24 -translate-y-15 touch-none select-none items-center ${
                dragging ? "cursor-ew-resize" : "cursor-pointer"
              }`}
            >
              <div className="flex h-12 w-full items-center justify-between gap-px">
                {Array.from({ length: 64 }, (_, index) => {
                  const height = 3 + Math.abs(Math.sin(index * 0.53) * Math.cos(index * 0.17)) * 40;
                  const played = duration
                    ? index / 63 <= currentTime / duration
                    : index === 0;
                  return (
                    <span
                      key={index}
                      className={`w-px ${played ? "bg-white" : "bg-white/20"}`}
                      style={{ height }}
                    />
                  );
                })}
              </div>
              <div
                className="absolute top-1/2 h-20 w-px -translate-y-1/2 cursor-ew-resize bg-cyan-400"
                style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                <span className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-cyan-400" />
              </div>
            </div>
            <div className="absolute left-5 right-5 bottom-5 flex items-center justify-between">
              <span className="font-mono text-sm text-white/50">
                {formatTime(currentTime)}
              </span>
              <button
                aria-label={playing ? "暂停" : "播放"}
                onClick={togglePlay}
                className="nodrag flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white cursor-pointer"
              >
                {playing ? (
                  <Pause size={13} fill="currentColor" />
                ) : (
                  <Play size={13} fill="currentColor" className="translate-x-px" />
                )}
              </button>
            </div>
          </div>
        ) : (
          data.status !== ChunkStatus.PROCESSING && (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <AudioLines size={32} className="text-white/25" strokeWidth={1.5} />
              {data.status === ChunkStatus.FAILED && (
                <p className="line-clamp-3 text-xs text-red-300/80">
                  {data.error || "音频生成失败"}
                </p>
              )}
            </div>
          )
        )}
      </div>
    </NodeShell>
  );
};

export default memo(AudioNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
