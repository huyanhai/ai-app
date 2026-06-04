import { RefObject, useEffect } from "react";

/**
 * 监听点击目标元素外部的事件，并执行回调
 * @param refs - 目标元素的 ref 或 ref 数组，点击任意一个元素内部都不会触发回调
 * @param callback - 点击外部时触发的回调函数
 * @param enabled - 是否启用监听，默认为 true
 */
export function useClickOutSide<T extends HTMLElement>(
  refs: RefObject<T | null> | RefObject<T | null>[],
  callback: () => void,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const refList = Array.isArray(refs) ? refs : [refs];

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInside = refList.some(
        (ref) => ref.current && ref.current.contains(target),
      );
      if (!isInside) {
        callback();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [refs, callback, enabled]);
}
