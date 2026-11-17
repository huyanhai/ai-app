import { useEffect, useRef } from "react";

import { subscribeLiveAgentEvents } from "@/store/agent";
import { notificationFor, showNotice } from "@/lib/agent/watch";

export function useAgentNotifications(canvasId: string, canvasTitle: string) {
  const title = useRef(canvasTitle);
  useEffect(() => {
    title.current = canvasTitle;
  }, [canvasTitle]);
  useEffect(
    () =>
      subscribeLiveAgentEvents((event) => {
        if (event.canvas_id !== canvasId) return;
        const notice = notificationFor(event, {
          canvasTitle: title.current,
          hidden: typeof document !== "undefined" && document.hidden,
        });
        if (notice) showNotice(notice);
      }),
    [canvasId],
  );
}
