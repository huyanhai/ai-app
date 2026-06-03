/**
 * 将图片 URL 转换为 Base64
 */
export const imageUrlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // 去掉 data:image/xxx;base64, 前缀，因为很多大模型接口只想要 base64 内容
      // 不过这里我们先保留，由调用方决定是否截取，或者统一返回完整的 data URL
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * 将 HTMLImageElement 转换为 Base64
 */
export const imgElementToBase64 = (img: HTMLImageElement): string => {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
};

// 获取文件的后缀
export const getFileExtension = (fileName: string): string => {
  const ext = fileName.split(".").pop() || "";
  return ext.toLowerCase();
};
