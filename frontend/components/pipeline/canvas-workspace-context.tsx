"use client";

import { createContext, useContext } from "react";
import { useParams } from "next/navigation";

const CanvasWorkspaceContext = createContext("default");

export const useCanvasId = () => useContext(CanvasWorkspaceContext);

export const CanvasWorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const params = useParams<{ canvasId?: string }>();
  return (
    <CanvasWorkspaceContext.Provider value={params.canvasId || "default"}>
      {children}
    </CanvasWorkspaceContext.Provider>
  );
};
