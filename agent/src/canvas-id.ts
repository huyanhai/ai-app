export const MAX_CANVAS_ID_LENGTH = 128;

export function validateCanvasId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    Array.from(value).length > MAX_CANVAS_ID_LENGTH
  ) {
    throw new Error(`canvas_id 必须是长度不超过 ${MAX_CANVAS_ID_LENGTH} 的非空字符串`);
  }
  return value;
}
