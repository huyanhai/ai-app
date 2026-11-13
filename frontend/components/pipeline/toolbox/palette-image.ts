const toHex = (value: number) => value.toString(16).padStart(2, "0");

const colorDistance = (first: number[], second: number[]) =>
  (first[0] - second[0]) ** 2 +
  (first[1] - second[1]) ** 2 +
  (first[2] - second[2]) ** 2;

export async function paletteFromImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("无法读取图片");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const image = canvas.toDataURL("image/jpeg", 0.76);
  const pixels = context.getImageData(0, 0, width, height).data;
  const buckets = new Map<number, { count: number; rgb: number[] }>();
  const step = Math.max(1, Math.floor((width * height) / 12000));

  for (let pixel = 0; pixel < width * height; pixel += step) {
    const offset = pixel * 4;
    if (pixels[offset + 3] < 128) continue;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
    const bucket = buckets.get(key) ?? { count: 0, rgb: [0, 0, 0] };
    bucket.count += 1;
    bucket.rgb[0] += red;
    bucket.rgb[1] += green;
    bucket.rgb[2] += blue;
    buckets.set(key, bucket);
  }

  const dominant = Array.from(buckets.values())
    .sort((first, second) => second.count - first.count)
    .map((bucket) => bucket.rgb.map((value) => Math.round(value / bucket.count)));
  const colors: number[][] = [];

  for (const color of dominant) {
    if (colors.every((selected) => colorDistance(color, selected) > 1600)) {
      colors.push(color);
      if (colors.length === 11) break;
    }
  }

  for (const color of dominant) {
    if (colors.length === 11) break;
    if (!colors.includes(color)) colors.push(color);
  }

  return {
    image,
    colors: colors.map(
      ([red, green, blue]) => `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase(),
    ),
  };
}
