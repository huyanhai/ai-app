import { ArrowLeftRight, Plus, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { TNodeBase, TNodeImage } from "../types";

interface IFrameProps {
  config?: TNodeBase["config"];
  images: TNodeImage[];
  action?: ReactNode;
  changeConfig: (config: TNodeBase["config"]) => void;
}

const Frame = ({ config, images, action, changeConfig }: IFrameProps) => {
  const firstFrameRef = useRef<HTMLInputElement>(null);
  const lastFrameRef = useRef<HTMLInputElement>(null);
  const firstFrameUrl = config?.firstFrameUrl ?? images[0]?.data.url;
  const lastFrameUrl = config?.lastFrameUrl ?? images[1]?.data.url;

  const handleUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "firstFrameUrl" | "lastFrameUrl",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        changeConfig({ [type]: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // reset
  };

  return (
    <div className="nodrag mb-3 flex items-start gap-3">
      <input
        type="file"
        ref={firstFrameRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleUpload(e, "firstFrameUrl")}
      />
      <input
        type="file"
        ref={lastFrameRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleUpload(e, "lastFrameUrl")}
      />
      <button
        type="button"
        aria-label="上传首帧"
        onClick={() => {
          if (!firstFrameUrl) {
            firstFrameRef.current?.click();
          }
        }}
        className="group relative flex size-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        {firstFrameUrl ? (
          <>
            <img
              src={firstFrameUrl}
              className="w-full h-full object-cover"
            />
            {config?.firstFrameUrl && (
              <div
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  changeConfig({ firstFrameUrl: undefined });
                }}
              >
                <X size={16} />
              </div>
            )}
          </>
        ) : (
          <>
            <Plus size={16} />
          </>
        )}
      </button>
      <ArrowLeftRight size={16} className="shrink-0 self-center text-white/30" />
      <button
        type="button"
        aria-label="上传尾帧"
        onClick={() => {
          if (!lastFrameUrl) {
            lastFrameRef.current?.click();
          }
        }}
        className="group relative flex size-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        {lastFrameUrl ? (
          <>
            <img
              src={lastFrameUrl}
              className="w-full h-full object-cover"
            />
            {config?.lastFrameUrl && (
              <div
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  changeConfig({ lastFrameUrl: undefined });
                }}
              >
                <X size={16} />
              </div>
            )}
          </>
        ) : (
          <>
            <Plus size={16} />
          </>
        )}
      </button>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
};

export default Frame;
