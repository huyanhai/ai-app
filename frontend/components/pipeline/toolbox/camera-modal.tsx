"use client";
import { useEffect, useRef, useState } from "react";
import ToolboxModal from "./toolbox-modal";
import {
  CAMERA_AUTO,
  CAMERA_COLUMNS,
  CAMERA_DEFAULT,
  TCameraKey,
  TCameraOption,
  TCameraSelection,
} from "./data";

const ITEM_H = 56;
// 上下各露出 2 个弱化项（对齐即梦滚轮）
const VISIBLE_PAD = 2;

// 垂直滚轮列：滚动吸附 + 点击居中，居中的项高亮，上下渐隐
const Wheel = ({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  options: TCameraOption[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 打开时滚到当前选中项
  useEffect(() => {
    const index = Math.max(0, options.findIndex((o) => o.label === value));
    listRef.current?.scrollTo({ top: index * ITEM_H });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const top = listRef.current?.scrollTop ?? 0;
      const index = Math.min(
        Math.max(Math.round(top / ITEM_H), 0),
        options.length - 1,
      );
      if (options[index].label !== value) onChange(options[index].label);
    }, 80);
  };

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-2 text-sm text-white/70">{label}</div>
      <div
        className="relative w-full"
        style={{ height: ITEM_H * (VISIBLE_PAD * 2 + 1) }}
      >
        {/* 中心高亮框 */}
        <div
          className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-xl bg-white/5 border border-white/5"
          style={{ height: ITEM_H }}
        />
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="h-full snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]"
        >
          <div style={{ height: ITEM_H * VISIBLE_PAD }} />
          {options.map((option, index) => (
            <button
              key={option.label}
              onClick={() => {
                listRef.current?.scrollTo({
                  top: index * ITEM_H,
                  behavior: "smooth",
                });
                onChange(option.label);
              }}
              className="flex w-full snap-center flex-col items-center justify-center gap-0.5 cursor-pointer"
              style={{ height: ITEM_H }}
            >
              {option.label === value && (
                <span className="text-white/80">{icon}</span>
              )}
              <span
                className={`text-sm transition-colors ${
                  option.label === value ? "text-white" : "text-white/30"
                }`}
              >
                {option.label}
              </span>
            </button>
          ))}
          <div style={{ height: ITEM_H * VISIBLE_PAD }} />
        </div>
      </div>
    </div>
  );
};

// 相机弹窗：顶部预览图 + 相机/镜头/焦距/光圈四个滚轮（对齐即梦，预览跟随最近调整的选项）
const CameraModal = ({
  open,
  value,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value?: Partial<TCameraSelection>;
  onClose: () => void;
  onConfirm: (v: TCameraSelection) => void;
}) => {
  const [selection, setSelection] = useState<TCameraSelection>(CAMERA_DEFAULT);
  // 最近调整的列，预览图优先跟随它
  const [lastChanged, setLastChanged] = useState<TCameraKey | null>(null);

  useEffect(() => {
    if (open) {
      setSelection({ ...CAMERA_DEFAULT, ...value });
      setLastChanged(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const change = (key: TCameraKey) => (v: string) => {
    setSelection((s) => ({ ...s, [key]: v }));
    setLastChanged(key);
  };

  // 预览图：最近调整列的非"自动"选项 > 按列顺序第一个非"自动"选项 > 默认图
  const optionImage = (key: TCameraKey) => {
    const label = selection[key];
    if (label === CAMERA_AUTO) return null;
    const column = CAMERA_COLUMNS.find((c) => c.key === key);
    return column?.options.find((o) => o.label === label)?.image || null;
  };
  const preview =
    (lastChanged && optionImage(lastChanged)) ||
    CAMERA_COLUMNS.map((c) => optionImage(c.key)).find(Boolean) ||
    "/toolbox/camera-preview.jpg";

  return (
    <ToolboxModal
      open={open}
      title="相机"
      width={920}
      onClose={onClose}
      onConfirm={() => onConfirm(selection)}
    >
      {/* 预览图（跟随选项切换） */}
      <div className="flex justify-center px-6 pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="相机预览"
          className="h-56 w-[420px] rounded-xl object-cover"
        />
      </div>

      {/* 四个滚轮列 */}
      <div className="flex gap-2 px-6 pt-4">
        {CAMERA_COLUMNS.map((column) => (
          <Wheel
            key={column.key}
            label={column.label}
            icon={column.icon}
            options={column.options}
            value={selection[column.key]}
            onChange={change(column.key)}
          />
        ))}
      </div>
    </ToolboxModal>
  );
};

export default CameraModal;
