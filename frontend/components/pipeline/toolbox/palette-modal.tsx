"use client";
import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import ToolboxModal from "./toolbox-modal";
import { PALETTES } from "./data";

// 配色弹窗：创建配色 + 色调方案网格，卡片含预览图、色板圆点、名称（对齐即梦）
const PaletteModal = ({
  open,
  value,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) => {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelected(value ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <ToolboxModal
      open={open}
      title="配色"
      width={920}
      onClose={onClose}
      onConfirm={() => selected && onConfirm(selected)}
      confirmDisabled={!selected}
    >
      <div className="grid max-h-[52vh] grid-cols-4 gap-4 overflow-y-auto px-6 pt-4 pb-2">
        {/* 创建配色占位卡 */}
        <div className="flex flex-col">
          <div className="flex h-32 items-center justify-center rounded-xl bg-white/5 text-white/30">
            <Layers size={22} />
          </div>
          <div className="py-2 text-center text-xs text-white/60">
            创建配色
          </div>
        </div>

        {PALETTES.map((palette) => (
          <button
            key={palette.name}
            onClick={() => setSelected(palette.name)}
            className="flex flex-col text-left cursor-pointer"
          >
            <div
              className={`overflow-hidden rounded-xl border-2 transition-colors ${
                selected === palette.name
                  ? "border-white"
                  : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={palette.image}
                alt={palette.name}
                className="h-32 w-full object-cover"
              />
            </div>
            <div className="flex justify-center gap-1 px-1 pt-2">
              {palette.colors.map((color) => (
                <span
                  key={color}
                  className="size-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div
              className={`py-1.5 text-center text-xs transition-colors ${
                selected === palette.name ? "text-white" : "text-white/60"
              }`}
            >
              {palette.name}
            </div>
          </button>
        ))}
      </div>
    </ToolboxModal>
  );
};

export default PaletteModal;
