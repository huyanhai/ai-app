export type AlignmentNode = {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
};

export type NodeAlignment = {
  x: number | null;
  y: number | null;
  deltaX: number;
  deltaY: number;
};

type AxisAlignment = { position: number; delta: number; distance: number };

const axes = (node: AlignmentNode) => {
  const width = node.measured?.width ?? 0;
  const height = node.measured?.height ?? 0;
  return {
    x: [node.position.x, node.position.x + width / 2, node.position.x + width],
    y: [node.position.y, node.position.y + height / 2, node.position.y + height],
  };
};

export const getNodeAlignment = (
  draggedNode: AlignmentNode,
  nodes: AlignmentNode[],
  threshold: number,
): NodeAlignment => {
  const draggedAxes = axes(draggedNode);
  let horizontal: AxisAlignment | null = null;
  let vertical: AxisAlignment | null = null;

  for (const node of nodes) {
    if (node.id === draggedNode.id) continue;
    const nodeAxes = axes(node);

    for (const draggedX of draggedAxes.x) {
      for (const nodeX of nodeAxes.x) {
        const delta = nodeX - draggedX;
        const distance = Math.abs(delta);
        if (distance <= threshold && (!vertical || distance < vertical.distance)) {
          vertical = { position: nodeX, delta, distance };
        }
      }
    }

    for (const draggedY of draggedAxes.y) {
      for (const nodeY of nodeAxes.y) {
        const delta = nodeY - draggedY;
        const distance = Math.abs(delta);
        if (distance <= threshold && (!horizontal || distance < horizontal.distance)) {
          horizontal = { position: nodeY, delta, distance };
        }
      }
    }
  }

  return {
    x: vertical?.position ?? null,
    y: horizontal?.position ?? null,
    deltaX: vertical?.delta ?? 0,
    deltaY: horizontal?.delta ?? 0,
  };
};
