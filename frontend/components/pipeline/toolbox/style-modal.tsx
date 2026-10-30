"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ToolboxModal from "./toolbox-modal";
import { STYLES } from "./data";

// 尺寸对齐即梦设计稿：弹窗 1040，中卡 740×416（16:9），两侧各叠两层，每层露出 60px
const MODAL_W = 1040;
const CARD_W = 740;
const CARD_H = 416;
const PEEK = 60;
const PERSPECTIVE = 1200;
// 3D Coverflow：侧卡绕自身中心 rotateY，外侧边远离观者（向内折叠），向后沉降。
// scale 需压过透视放大（内侧边朝观者会显大），保证视觉高度逐层递减：416 → ~370 → ~300
// x 控制露边间隔，间距较紧凑（约 35px）
const POSE: Record<
  number,
  { x: number; deg: number; z: number; scale: number; opacity: number; dim: number }
> = {
  0: { x: 0, deg: 0, z: 0, scale: 1, opacity: 1, dim: 0 },
  1: { x: 130, deg: 45, z: -60, scale: 0.78, opacity: 1, dim: 0.45 },
  2: { x: 245, deg: 65, z: -120, scale: 0.66, opacity: 1, dim: 0.6 },
  // 第 3 层藏在第 2 层身后（透明度 0），切换时从身后浮现，避免凭空闪现
  3: { x: 245, deg: 65, z: -120, scale: 0.66, opacity: 0, dim: 0.6 },
};

// 循环偏移：i 相对 index 的最短有向距离（-N/2, N/2]
const cyclicOffset = (i: number, index: number, total: number) => {
  let offset = (i - index) % total;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
};

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

// 风格弹窗：层叠卡片循环轮播 + 圆点分页（对齐即梦，两侧卡片层叠露边并调暗）
const StyleModal = ({
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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      const current = STYLES.findIndex((s) => s.name === value);
      setIndex(current >= 0 ? current : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 循环切换
  const go = (next: number) =>
    setIndex(((next % STYLES.length) + STYLES.length) % STYLES.length);

  return (
    <ToolboxModal
      open={open}
      title="风格"
      width={MODAL_W}
      onClose={onClose}
      onConfirm={() => onConfirm(STYLES[index].name)}
      closeIconSize={30}
      classNames={{
        panel: "rounded-[28px] border-0 bg-[#1b1b1b]",
        header: "px-10 pt-[38px]",
        title: "font-medium",
        close: "text-white hover:bg-white/10",
        footer: "px-8 pt-[21px] pb-8",
        confirm:
          "h-[46px] w-[104px] rounded-xl px-0 py-0 text-base font-medium",
      }}
    >
      {/* 循环走马灯（层叠式，两侧各露两层窄边） */}
      <div className="relative mt-[75px]" style={{ height: CARD_H }}>
        {STYLES.map((style, i) => {
          const offset = cyclicOffset(i, index, STYLES.length);
          const depth = Math.abs(offset);
          if (depth > 3) return null;
          const pose = POSE[depth];
          const side = Math.sign(offset);
          return (
            <motion.button
              key={style.name}
              aria-label={style.name}
              onClick={() => go(index + offset)}
              initial={false}
              animate={{
                x: side * pose.x,
                z: pose.z,
                scale: pose.scale,
                // 外侧边远离观者（向内折叠）
                rotateY: -side * pose.deg,
                opacity: pose.opacity,
              }}
              transition={SPRING}
              className="absolute top-0 left-1/2 cursor-pointer overflow-hidden rounded-2xl bg-black"
              style={{
                width: CARD_W,
                height: CARD_H,
                marginLeft: -CARD_W / 2,
                transformPerspective: PERSPECTIVE,
                // 层级不做动画：切换瞬间新中卡即压在最上层
                zIndex: 10 - depth,
              }}
            >
              <video
                src={style.video}
                poster={style.poster}
                autoPlay
                muted
                loop
                playsInline
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              {/* 侧卡调暗遮罩 */}
              <motion.div
                initial={false}
                animate={{ opacity: pose.dim }}
                transition={SPRING}
                className="pointer-events-none absolute inset-0 bg-black"
              />
            </motion.button>
          );
        })}
      </div>

      {/* 当前风格名 */}
      <div className="mt-[11px] text-center text-[15px] leading-[22px] font-medium text-white">
        {STYLES[index].name}
      </div>

      {/* 圆点分页 + 左右箭头（循环） */}
      <div className="mt-[55px] flex items-center justify-center gap-5">
        <button
          aria-label="上一个"
          onClick={() => go(index - 1)}
          className="flex size-9 items-center justify-center rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.12] transition-colors cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        {STYLES.map((style, i) => (
          <button
            key={style.name}
            aria-label={style.name}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              i === index ? "w-[26px] bg-white" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
        <button
          aria-label="下一个"
          onClick={() => go(index + 1)}
          className="flex size-9 items-center justify-center rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.12] transition-colors cursor-pointer"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </ToolboxModal>
  );
};

export default StyleModal;
