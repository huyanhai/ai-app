import { Aperture, Camera, Focus, MoveHorizontal } from "lucide-react";
import React from "react";
import type { TPaletteSelection } from "../types";

// 相机弹窗四个滚轮列的选项（对齐即梦：默认"自动"位于列表中间，每项带预览图）
export type TCameraKey = "camera" | "lens" | "focal" | "aperture";
export type TCameraSelection = Record<TCameraKey, string>;
export type TCameraOption = { label: string; image: string; thumbnail: string | null };

export const CAMERA_AUTO = "自动";

export const CAMERA_DEFAULT: TCameraSelection = {
  camera: CAMERA_AUTO,
  lens: CAMERA_AUTO,
  focal: CAMERA_AUTO,
  aperture: CAMERA_AUTO,
};

const opt = (label: string, image: string, thumbnail: string | null): TCameraOption => ({
  label,
  image: image ? `/toolbox/camera/${image}.webp` : "",
  thumbnail: thumbnail ? `/toolbox/camera/${thumbnail}.png` : null,
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
      opt("纪实胶片", "documentary", "model-documentary"),
      opt("黑白纪实", "bw-documentary", "model-bw"),
      opt("Y2K卡片机", "y2k", "model-y2k"),
      opt(CAMERA_AUTO, "", "model-auto"),
      opt("现代数字", "modern", "model-modern"),
      opt("电影胶片", "film", "model-film"),
      opt("VHS磁带", "vhs", "model-vhs"),
    ],
  },
  {
    key: "lens",
    label: "镜头",
    icon: <Focus size={20} />,
    options: [
      opt("黑柔滤镜镜头", "black-mist", "lens-black-mist"),
      opt("鱼眼广角镜头", "fisheye", "lens-fisheye"),
      opt("漏光镜头", "light-leak", "lens-light-leak"),
      opt(CAMERA_AUTO, "", "lens-auto"),
      opt("干净锐利镜头", "clean-sharp", "lens-clean"),
      opt("银幕电影镜头", "cinema-screen", "lens-cinema"),
      opt("暖调复古镜头", "warm-vintage", "lens-warm"),
    ],
  },
  {
    key: "focal",
    label: "焦距",
    icon: <MoveHorizontal size={20} />,
    options: [
      opt("85mm", "f85", null),
      opt("135mm", "f135", null),
      opt(CAMERA_AUTO, "", "focal-auto"),
      opt("24mm", "f24", null),
      opt("35mm", "f35", null),
    ],
  },
  {
    key: "aperture",
    label: "光圈",
    icon: <Aperture size={20} />,
    options: [
      opt("f4中景深", "ap40", "aperture-f4"),
      opt("f11深景深", "ap110", "aperture-f11"),
      opt(CAMERA_AUTO, "", "aperture-auto"),
      opt("f1.4浅景深", "ap14", "aperture-f14"),
    ],
  },
];

export type TMovement = { name: string; image: string; video: string };

export const MOVEMENTS: TMovement[] = [
  { name: "迎面跟拍", image: "/toolbox/movement/lead_follow.jpg", video: "/toolbox/movement/lead_follow.mp4" },
  { name: "侧面跟拍", image: "/toolbox/movement/side_tracking.jpg", video: "/toolbox/movement/side_tracking.mp4" },
  { name: "镜头左移", image: "/toolbox/movement/truck_left.jpg", video: "/toolbox/movement/truck_left.mp4" },
  { name: "镜头右移", image: "/toolbox/movement/truck_right.jpg", video: "/toolbox/movement/truck_right.mp4" },
  { name: "镜头上移", image: "/toolbox/movement/pedestal_up.jpg", video: "/toolbox/movement/pedestal_up.mp4" },
  { name: "镜头下移", image: "/toolbox/movement/pedestal_down.jpg", video: "/toolbox/movement/pedestal_down.mp4" },
  { name: "急速推进", image: "/toolbox/movement/rapid_dolly_in.jpg", video: "/toolbox/movement/rapid_dolly_in.mp4" },
  { name: "急速后移", image: "/toolbox/movement/rapid_dolly_out.jpg", video: "/toolbox/movement/rapid_dolly_out.mp4" },
  { name: "FPV穿越机", image: "/toolbox/movement/fpv_drone.jpg", video: "/toolbox/movement/fpv_drone.mp4" },
  { name: "一镜到底", image: "/toolbox/movement/oner.jpg", video: "/toolbox/movement/oner.mp4" },
  { name: "盘旋抬升", image: "/toolbox/movement/orbit_rise.jpg", video: "/toolbox/movement/orbit_rise.mp4" },
  { name: "手持拍摄", image: "/toolbox/movement/handheld.jpg", video: "/toolbox/movement/handheld.mp4" },
  { name: "低角度环绕", image: "/toolbox/movement/low_angle_orbit.jpg", video: "/toolbox/movement/low_angle_orbit.mp4" },
  { name: "第一视角", image: "/toolbox/movement/pov.jpg", video: "/toolbox/movement/pov.mp4" },
  { name: "希区柯克", image: "/toolbox/movement/dolly_zoom.jpg", video: "/toolbox/movement/dolly_zoom.mp4" },
  { name: "子弹时间", image: "/toolbox/movement/bullet_time.jpg", video: "/toolbox/movement/bullet_time.mp4" },
  { name: "快速摇摄", image: "/toolbox/movement/whip_pan.jpg", video: "/toolbox/movement/whip_pan.mp4" },
  { name: "定格抽帧", image: "/toolbox/movement/stop_motion.jpg", video: "/toolbox/movement/stop_motion.mp4" },
  { name: "焦点转移", image: "/toolbox/movement/rack_focus.jpg", video: "/toolbox/movement/rack_focus.mp4" },
  { name: "机械臂", image: "/toolbox/movement/robotic_arm.jpg", video: "/toolbox/movement/robotic_arm.mp4" },
];

// 配色方案：名称 + 8 个色板 + 预览图
export type TPalette = TPaletteSelection & { image: string };

export const PALETTES: TPalette[] = [
  { name: "雾蓝米白色调", colors: ["#A8BAC4", "#E3DED0", "#B7AA8E", "#C7A08D", "#8F9A82", "#7F98A8", "#9B8975", "#414A50"], image: "/toolbox/palette/1.webp" },
  { name: "港片霓虹色调", colors: ["#1C3B54", "#C9926B", "#D9803A", "#2FA37E", "#5E7A3E", "#A62A4E", "#24413A", "#0C0E10"], image: "/toolbox/palette/2.webp" },
  { name: "日系清新色调", colors: ["#F1EEE7", "#D8E6E9", "#F0DCCF", "#C7D5DF", "#DDBAA9", "#B8B7CB", "#8E98B2", "#555F75"], image: "/toolbox/palette/3.webp" },
  { name: "复古糖果色调", colors: ["#F4A8B9", "#FFE9EC", "#F5CBA7", "#E8A798", "#D4A8C7", "#8FA0B3", "#7E7089", "#5B4A63"], image: "/toolbox/palette/4.webp" },
  { name: "暖黄灰褐色调", colors: ["#C69A48", "#D2BB86", "#B98262", "#A84335", "#66634A", "#4F615B", "#59402D", "#1D1A15"], image: "/toolbox/palette/5.webp" },
  { name: "冷青琥珀色调", colors: ["#123C40", "#CAC8A6", "#9B9948", "#A8795C", "#B66F25", "#315C66", "#70272A", "#061719"], image: "/toolbox/palette/6.webp" },
  { name: "南法假日色调", colors: ["#8E9A5E", "#F3EAD7", "#D9D2A0", "#A9C6D5", "#5FB0A4", "#C88A66", "#9C8FB8", "#3A3F24"], image: "/toolbox/palette/7.webp" },
  { name: "沙漠史诗色调", colors: ["#C99A5B", "#EDE0C6", "#E4C48C", "#C0885E", "#8C8578", "#B9743E", "#6E4A2E", "#3A342C"], image: "/toolbox/palette/8.webp" },
  { name: "复古好莱坞色调", colors: ["#D8A840", "#F4EDDF", "#F6E6B8", "#D8A898", "#2A8A3A", "#3A7ABA", "#A83B44", "#3A2E22"], image: "/toolbox/palette/9.webp" },
  { name: "幻彩史诗色调", colors: ["#8F0B18", "#9B7A3B", "#607FA3", "#A66F54", "#A76522", "#777033", "#315D5A", "#101516"], image: "/toolbox/palette/10.webp" },
  { name: "过期暖黄色调", colors: ["#B88932", "#E2D09A", "#D2A84B", "#B27A55", "#747632", "#514B32", "#673B32", "#1F2417"], image: "/toolbox/palette/11.webp" },
  { name: "琥珀棕褐色调", colors: ["#9A6434", "#D5BE91", "#B8874E", "#A87557", "#6B4228", "#494534", "#5B302B", "#241A15"], image: "/toolbox/palette/12.webp" },
  { name: "法式红绿色调", colors: ["#315E28", "#D4C68E", "#B89A2E", "#B77C56", "#477B78", "#A63828", "#6F2725", "#182719"], image: "/toolbox/palette/13.webp" },
  { name: "墨绿暖黄色调", colors: ["#33483A", "#C8B276", "#B28A2E", "#A8755C", "#B3543E", "#4F7770", "#76523A", "#121A16"], image: "/toolbox/palette/14.webp" },
  { name: "灰绿砖红色调", colors: ["#87A99A", "#B8C8B4", "#A9785A", "#B65C49", "#6A442D", "#24543C", "#182B43", "#101614"], image: "/toolbox/palette/15.webp" },
  { name: "韩系冷青色调", colors: ["#647776", "#C5CBC6", "#A28C79", "#7D877A", "#77705E", "#674E49", "#293738", "#111817"], image: "/toolbox/palette/16.webp" },
  { name: "赛博冷绿色调", colors: ["#607B68", "#DCE2CD", "#B4C1AC", "#A79E79", "#7C7150", "#4B7469", "#243B2D", "#0B1510"], image: "/toolbox/palette/17.webp" },
  { name: "灰蓝海岸色调", colors: ["#146F75", "#E5DFC0", "#B3A075", "#AC927B", "#78918B", "#414235", "#123F43", "#081918"], image: "/toolbox/palette/18.webp" },
  { name: "米黄天蓝色调", colors: ["#2FA5A5", "#E7D6A2", "#91C4BD", "#D6AA63", "#83A98D", "#C98B6F", "#B96543", "#284A4A"], image: "/toolbox/palette/19.webp" },
  { name: "青橙色调", colors: ["#C87A2A", "#EDE3CE", "#E8B85E", "#C9976B", "#6E7A80", "#1F5D78", "#6E3D1E", "#241611"], image: "/toolbox/palette/20.webp" },
  { name: "孔雀蓝色调", colors: ["#0D4059", "#D8D6CE", "#B49362", "#B77C78", "#6F8791", "#A91424", "#071C2B", "#05090D"], image: "/toolbox/palette/21.webp" },
  { name: "单色蓝色调", colors: ["#56718A", "#D5E0E2", "#A9C2CF", "#899AA5", "#789AA5", "#3F4D5B", "#243B5A", "#0D1724"], image: "/toolbox/palette/22.webp" },
  { name: "暗黑冷色调", colors: ["#35424E", "#C4C8C8", "#77818A", "#927B6C", "#4A4B3E", "#5A3734", "#202B35", "#090C10"], image: "/toolbox/palette/23.webp" },
  { name: "单色红色调", colors: ["#A3131A", "#E7AAA0", "#B77A78", "#E05B50", "#C92A28", "#681017", "#4B2020", "#230609"], image: "/toolbox/palette/24.webp" },
  { name: "绛红紫灰色调", colors: ["#B00018", "#C28B91", "#B77C78", "#686777", "#754849", "#721F25", "#292632", "#2A0C0B"], image: "/toolbox/palette/25.webp" },
  { name: "都市暮色蓝调", colors: ["#5A5566", "#F0E4C8", "#E0B79A", "#CAB9B2", "#C8A6AE", "#6E5A4A", "#2A2838", "#0D0B0E"], image: "/toolbox/palette/26.webp" },
  { name: "黑白纪实色调", colors: ["#808080", "#E4E0D6", "#D6D0C4", "#C9C9C9", "#A6A6A6", "#5A5A5A", "#363636", "#0E0E0E"], image: "/toolbox/palette/27.webp" },
];

// 风格方案：名称 + 视频预览（走马灯循环轮播，poster 用于首帧兜底）
export type TStyle = { name: string; video: string; poster: string };

const styleAsset = (i: number) => ({
  video: `/toolbox/style/${i}.mp4`,
  poster: `/toolbox/style/${i}.jpg`,
});

export const STYLES: TStyle[] = [
  { name: "复古对称美学", ...styleAsset(1) },
  { name: "3D动画风", ...styleAsset(2) },
  { name: "治愈日漫风", ...styleAsset(3) },
  { name: "港夜迷离风", ...styleAsset(4) },
  { name: "哥特式恐怖", ...styleAsset(5) },
  { name: "邵氏武侠风", ...styleAsset(6) },
  { name: "丧尸列车", ...styleAsset(7) },
  { name: "美式迷幻青春", ...styleAsset(8) },
  { name: "台湾偶像剧", ...styleAsset(9) },
  { name: "异常阈限空间", ...styleAsset(10) },
];
