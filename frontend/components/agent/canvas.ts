export function focusAgentNodes(ids: readonly string[], fit = false) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("agent:focus-nodes", { detail: { ids: [...ids], fit } }));
}

