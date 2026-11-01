import { Box, Focus, Grid3X3, PanelsLeftRight, Smile, UserRound, type LucideIcon } from "lucide-react";
import type { TRatio } from "../../../types";

export type ImagePreset = {
  id: string;
  label: string;
  ratio: TRatio;
  prompt: string;
  icon: LucideIcon;
};

export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: "scene-overhead",
    label: "场景俯视图",
    ratio: "16:9",
    prompt: "基于参考图生成同一场景的俯视图，保持场景主体、环境特征、色彩和风格一致，从正上方完整展现场景布局。",
    icon: Focus,
  },
  {
    id: "continuous-storyboard",
    label: "连续分镜图",
    ratio: "1:1",
    prompt: "基于参考图生成连续分镜图，保持人物、主体和场景一致，用连续画面清晰呈现场景发展与关键动作，分镜布局整齐。",
    icon: PanelsLeftRight,
  },
  {
    id: "multi-camera-grid",
    label: "多机位九宫格",
    ratio: "16:9",
    prompt: "基于参考图生成多机位九宫格，保持同一主体和场景一致，从九个不同机位与景别展示画面，按九宫格整齐排列。",
    icon: Grid3X3,
  },
  {
    id: "character-three-view",
    label: "人物三视图",
    ratio: "16:9",
    prompt: "基于参考图生成同一人物的人物设定三视图，保持人物身份、五官、发型、服装、身材和色彩一致。三个人物全身完整展示并按左中右横向排列：左侧为正面，中间为严格的90度正侧面，右侧为背面。中间人物必须完全朝向正侧方，只能看到单侧眼睛和半边脸，清楚呈现鼻尖、嘴唇和下巴的侧面轮廓，禁止四分之三侧面、回头或脸部转向镜头。使用纯白色无场景背景，不要山水、建筑、地面、装饰物或其他背景内容。",
    icon: UserRound,
  },
  {
    id: "face-three-view",
    label: "面部三视图",
    ratio: "16:9",
    prompt: "基于参考图生成同一人物的面部特写三视图，保持身份、五官、发型、发饰、肤色和原始服装一致。三个人物按左中右横向排列：左侧为正视图，头部正直且双眼目视前方；中间为3/4侧视图，仅微微侧头；右侧为严格90度正侧视图，只显示单侧眼睛和完整侧脸轮廓。三个人物的头部大小一致，眼角、鼻尖、下巴分别处于三条水平对齐线上，禁止高低错落。采用以面部为主的头部及肩部特写，头部和面部占据主要画面，下方保留参考图中的原始服装领口、肩部与少量上身，使画面底部自然填满，禁止颈部以下淡出、消失或留下大片空白，不要显示腰部和下半身。使用一致的柔和光照与纯白色无场景背景。",
    icon: Smile,
  },
  {
    id: "product-three-view",
    label: "产品三视图",
    ratio: "16:9",
    prompt: "基于参考图生成同一产品的正面、侧面、背面三视图，保持产品外观、结构、材质、颜色和比例一致，使用简洁背景并横向排列。",
    icon: Box,
  },
];

export const getImagePreset = (id?: string) => IMAGE_PRESETS.find((preset) => preset.id === id);
