export type CharacterAsset = {
  id: string;
  name: string;
  image: string;
};

export const CHARACTER_ASSETS: CharacterAsset[] = [
  { id: "dpa_50b43d8c7e355ddf9f202709712d0418", name: "男性 · 标准", image: "/stage/assets/male-standard.png" },
  { id: "dpa_ccf8cd225c85573785dde64062461062", name: "女性 · 标准", image: "/stage/assets/female-standard.png" },
  { id: "dpa_9c96d03aecc7523091149792e44cde8a", name: "男性 · 少年", image: "/stage/assets/male-teen.png" },
  { id: "dpa_6a92d6b2d8b8510685e78b2e24623a26", name: "女性 · 少年", image: "/stage/assets/female-teen.png" },
  { id: "dpa_92ab1de2eaac5ee5a5725a2ad3e106f2", name: "男性·儿童", image: "/stage/assets/male-child.png" },
  { id: "dpa_db76101d2c4155498bd2204e484c014e", name: "女性·儿童", image: "/stage/assets/female-child.png" },
  { id: "dpa_25d178ab33585c4f9c178eb33392fa7e", name: "男性·纤瘦", image: "/stage/assets/male-slim.png" },
  { id: "dpa_052ff2802f7e559f9c0c5f65bffd9bd7", name: "女性·纤瘦", image: "/stage/assets/female-slim.png" },
  { id: "dpa_53b574918a1058aea0c3637b3a4bae7f", name: "男性·健壮", image: "/stage/assets/male-strong.png" },
  { id: "dpa_f74ff5702fee5ec4885c6644159089e2", name: "女性·健壮", image: "/stage/assets/female-strong.png" },
  { id: "dpa_83183da3ca0d5706abd1ae09f9682a34", name: "男性·丰腴", image: "/stage/assets/male-full.png" },
  { id: "dpa_2053ea52d54a5efead0f3ab4127cfb11", name: "女性·丰腴", image: "/stage/assets/female-full.png" },
];

export const GEOMETRY_ASSETS = [
  { id: "simple-human", name: "简化人体" },
  { id: "cube", name: "立方体" },
  { id: "sphere", name: "球体" },
  { id: "cuboid", name: "长方体" },
  { id: "cylinder", name: "圆柱体" },
  { id: "cone", name: "圆锥体" },
  { id: "pyramid", name: "四棱锥" },
  { id: "torus", name: "圆环体" },
  { id: "plane", name: "基础平面" },
  { id: "capsule", name: "胶囊体" },
  { id: "disc", name: "圆盘" },
  { id: "semicircle-arc", name: "半圆弧" },
  { id: "half-cylinder", name: "半圆柱" },
];
