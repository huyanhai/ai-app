import { useState } from "react";
import { IMenu } from "@/components/pipeline/types";
import { useReactFlow } from "@xyflow/react";

export const useMenu = () => {
  const [menu, setMenu] = useState<IMenu | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  return { menu, setMenu, screenToFlowPosition };
};
