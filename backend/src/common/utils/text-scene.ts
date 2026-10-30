// 文本节点的生成场景（前后端共用，前端直接从此处引入）
export enum TextScene {
  Auto = 'auto', // 根据输入自动判断
  Image = 'image', // 图片提示词
  Video = 'video', // 视频提示词
  Script = 'script', // 剧本
}
