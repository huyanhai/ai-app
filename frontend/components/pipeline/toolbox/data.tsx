import { Aperture, Camera, Focus, MoveHorizontal } from "lucide-react";
import React from "react";

// 相机弹窗四个滚轮列的选项（对齐即梦：默认"自动"位于列表中间，每项带预览图）
export type TCameraKey = "camera" | "lens" | "focal" | "aperture";
export type TCameraSelection = Record<TCameraKey, string>;
export type TCameraOption = { label: string; image: string };

export const CAMERA_AUTO = "自动";

export const CAMERA_DEFAULT: TCameraSelection = {
  camera: CAMERA_AUTO,
  lens: CAMERA_AUTO,
  focal: CAMERA_AUTO,
  aperture: CAMERA_AUTO,
};

const opt = (label: string, image: string): TCameraOption => ({
  label,
  image: `/toolbox/camera/${image}.jpg`,
});

export const CAMERA_COLUMNS: {
  key: TCameraKey;
  label: string;
  icon: React.ReactNode;
  options: TCameraOption[];
}[] = [
  {
    key: "camera",
    label: "相机",
    icon: <Camera size={20} />,
    options: [
      opt("胶片相机", "film"),
      opt("Y2K卡片机", "y2k"),
      opt("拍立得", "pola"),
      opt(CAMERA_AUTO, ""),
      opt("单反相机", "dslr"),
      opt("运动相机", "action"),
      opt("无人机", "drone"),
    ],
  },
  {
    key: "lens",
    label: "镜头",
    icon: <Focus size={20} />,
    options: [
      opt("广角镜头", "wide"),
      opt("标准镜头", "standard"),
      opt("偏光镜头", "polarizer"),
      opt(CAMERA_AUTO, ""),
      opt("长焦镜头", "tele"),
      opt("微距镜头", "macro"),
      opt("鱼眼镜头", "fisheye"),
    ],
  },
  {
    key: "focal",
    label: "焦距",
    icon: <MoveHorizontal size={20} />,
    options: [
      opt("14mm", "f14"),
      opt("24mm", "f24"),
      opt("35mm", "f35"),
      opt(CAMERA_AUTO, ""),
      opt("50mm", "f50"),
      opt("85mm", "f85"),
      opt("135mm", "f135"),
    ],
  },
  {
    key: "aperture",
    label: "光圈",
    icon: <Aperture size={20} />,
    options: [
      opt("f/1.4", "ap14"),
      opt("f/2.0", "ap20"),
      opt("f/2.8", "ap28"),
      opt(CAMERA_AUTO, ""),
      opt("f/4.0", "ap40"),
      opt("f/8.0", "ap80"),
      opt("f/16", "ap160"),
    ],
  },
];

export type TMovement = { name: string; image: string };

export const MOVEMENTS: TMovement[] = [
  { name: "迎面跟拍", image: "/toolbox/movement/front-follow.jpg" },
  { name: "侧面跟拍", image: "/toolbox/movement/side-follow.jpg" },
  { name: "镜头左移", image: "/toolbox/movement/pan-left.jpg" },
  { name: "镜头右移", image: "/toolbox/movement/pan-right.jpg" },
  { name: "镜头上移", image: "/toolbox/movement/tilt-up.jpg" },
  { name: "镜头下移", image: "/toolbox/movement/tilt-down.jpg" },
  { name: "急速推进", image: "/toolbox/movement/push-in.jpg" },
  { name: "急速后移", image: "/toolbox/movement/pull-back.jpg" },
  { name: "FPV穿越机", image: "/toolbox/movement/fpv.jpg" },
  { name: "一镜到底", image: "/toolbox/movement/one-take.jpg" },
];

// 配色方案：名称 + 8 个色板 + 预览图
export type TPalette = { name: string; colors: string[]; image: string };

export const PALETTES: TPalette[] = [
  { name: "港片霓虹色调", colors: ["#1b3a5c", "#f4a261", "#e76f51", "#2a9d8f", "#8ab17d", "#e63956", "#457b9d", "#212529"], image: "/toolbox/palette/1.jpg" },
  { name: "日系清新色调", colors: ["#f5f5f0", "#e8e4da", "#f2d8c9", "#cfd8dc", "#f7e7ce", "#d7ccc8", "#b0bec5", "#546e7a"], image: "/toolbox/palette/2.jpg" },
  { name: "雾蓝米白色调", colors: ["#dbe4e8", "#f2ede4", "#e3d5ca", "#d8b4a0", "#c5d5c0", "#aec6cf", "#d6c6b8", "#5d6d7e"], image: "/toolbox/palette/3.jpg" },
  { name: "复古糖果色调", colors: ["#f8c8dc", "#fdfcf7", "#f9e0b8", "#f4a9a8", "#d8b4e2", "#aec6cf", "#b5a7d6", "#7b6d8d"], image: "/toolbox/palette/4.jpg" },
  { name: "暖黄灰褐色调", colors: ["#d4a017", "#e8d8b8", "#c96f4a", "#a0522d", "#8b8378", "#4a4a44", "#2f2f2a", "#1a1a18"], image: "/toolbox/palette/5.jpg" },
  { name: "冷青琥珀色调", colors: ["#0f4c5c", "#e36414", "#9a6b4f", "#fb8b24", "#5f797b", "#8a1c1c", "#2b2d42", "#121212"], image: "/toolbox/palette/6.jpg" },
  { name: "南法假日色调", colors: ["#9db47c", "#f2f0e6", "#e8e3b8", "#a8d5e5", "#5ec8b8", "#e8b4a0", "#b8a7d6", "#3a4a3a"], image: "/toolbox/palette/7.jpg" },
  { name: "大漠孤烟色调", colors: ["#c99e5f", "#8b5e34", "#e8d0a9", "#6b4226", "#d4b48c", "#a3764a", "#5c4033", "#2e1f14"], image: "/toolbox/palette/8.jpg" },
  { name: "午夜车影色调", colors: ["#1c252e", "#3e4c59", "#f5f5f5", "#ffb347", "#7d8590", "#55606c", "#2f3b47", "#10151b"], image: "/toolbox/palette/9.jpg" },
  { name: "舞台暖光色调", colors: ["#f5c518", "#e8b400", "#8b2323", "#d4af37", "#5c1a1a", "#f0e68c", "#3d2b1f", "#1a0f0a"], image: "/toolbox/palette/10.jpg" },
  { name: "绅士墨绿色调", colors: ["#1e3d2f", "#2f5d46", "#0f241b", "#c8b88a", "#e8e0c8", "#4a6741", "#8a9a5b", "#141414"], image: "/toolbox/palette/11.jpg" },
];

// 风格方案：名称 + 视频预览（走马灯循环轮播，poster 用于首帧兜底）
export type TStyle = { name: string; video: string; poster: string };

const styleAsset = (i: number) => ({
  video: `/toolbox/style/${i}.mp4`,
  poster: `/toolbox/style/${i}.jpg`,
});

export const STYLES: TStyle[] = [
  { name: "复古对称美学", ...styleAsset(1) },
  { name: "赛博朋克", ...styleAsset(2) },
  { name: "水墨国风", ...styleAsset(3) },
  { name: "治愈日漫风", ...styleAsset(4) },
  { name: "胶片颗粒", ...styleAsset(5) },
  { name: "极简主义", ...styleAsset(6) },
  { name: "蒸汽波", ...styleAsset(7) },
  { name: "哥特暗黑", ...styleAsset(8) },
  { name: "波普艺术", ...styleAsset(9) },
  { name: "黑白纪实", ...styleAsset(10) },
];
