"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ProceduralAsset, ProceduralPart } from "./procedural-catalog";

function lathe(points: number[][], segments: number) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

function roundedBasin() {
  const rings = [[0.38, 0.36, -0.5, 0.12], [0.46, 0.46, -0.37, 0.14], [0.5, 0.5, 0.46, 0.16], [0.49, 0.49, 0.5, 0.16], [0.42, 0.4, 0.47, 0.15], [0.38, 0.35, -0.18, 0.13], [0.3, 0.28, -0.28, 0.12]];
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [width, depth, y, radius] of rings) {
    for (let corner = 0; corner < 4; corner += 1) {
      const start = corner * Math.PI / 2;
      const centerX = (corner === 0 || corner === 3 ? 1 : -1) * (width - radius);
      const centerZ = (corner < 2 ? 1 : -1) * (depth - radius);
      for (let step = 0; step < 5; step += 1) {
        const angle = start + step * Math.PI / 8;
        positions.push(centerX + Math.cos(angle) * radius, y, centerZ + Math.sin(angle) * radius);
      }
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let step = 0; step < 20; step += 1) {
      const current = 20 * ring + step;
      const next = 20 * ring + (step + 1) % 20;
      indices.push(current, current + 20, next, next, current + 20, next + 20);
    }
  }
  const bottom = positions.length / 3;
  positions.push(0, rings[0][2], 0, 0, rings[rings.length - 1][2], 0);
  for (let step = 0; step < 20; step += 1) {
    const next = (step + 1) % 20;
    indices.push(bottom, step, next, bottom + 1, (rings.length - 1) * 20 + next, (rings.length - 1) * 20 + step);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function wedge() {
  const positions = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
    -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  ]);
  for (let index = 0; index < positions.length; index += 9) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index + 3 + axis];
      positions[index + 3 + axis] = positions[index + 6 + axis];
      positions[index + 6 + axis] = value;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function archBand() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  for (let step = 0; step <= 24; step += 1) {
    const angle = Math.PI - Math.PI * step / 24;
    shape.lineTo(0.5 * Math.cos(angle), 0.5 * Math.sin(angle));
  }
  shape.lineTo(0.32, 0);
  for (let step = 0; step <= 24; step += 1) {
    const angle = Math.PI * step / 24;
    shape.lineTo(0.32 * Math.cos(angle), 0.32 * Math.sin(angle));
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false, curveSegments: 1, steps: 1 }).translate(0, 0, -0.14);
}

function createGeometry(shape: string) {
  let geometry: THREE.BufferGeometry;
  switch (shape) {
    case "sphere": geometry = new THREE.IcosahedronGeometry(0.5, 1); break;
    case "leaf": geometry = new THREE.SphereGeometry(0.5, 12, 6); break;
    case "smooth-sphere": geometry = new THREE.SphereGeometry(0.5, 16, 10); break;
    case "cylinder": geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 24); break;
    case "smooth-cylinder": geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
    case "cone": geometry = new THREE.ConeGeometry(0.5, 1, 24); break;
    case "pyramid": geometry = new THREE.ConeGeometry(0.7, 1, 4).rotateY(Math.PI / 4); break;
    case "frustum": geometry = new THREE.CylinderGeometry(0.28, 0.5, 1, 24); break;
    case "torus": geometry = new THREE.TorusGeometry(0.4, 0.1, 8, 24); break;
    case "cup-handle": geometry = new THREE.TorusGeometry(0.37, 0.08, 8, 16, Math.PI).rotateZ(-Math.PI / 2); break;
    case "cup": geometry = lathe([[0, -0.5], [0.4, -0.5], [0.47, -0.47], [0.5, -0.4], [0.5, 0.44], [0.49, 0.49], [0.46, 0.5], [0.43, 0.48], [0.42, 0.43], [0.42, -0.34], [0.38, -0.4], [0, -0.4]], 32); break;
    case "bowl": geometry = lathe([[0, -0.5], [0.22, -0.5], [0.34, -0.4], [0.46, 0.15], [0.5, 0.46], [0.48, 0.5], [0.44, 0.45], [0.4, 0.13], [0.29, -0.28], [0, -0.3]], 24); break;
    case "lampshade": geometry = lathe([[0.5, -0.5], [0.28, 0.5], [0.255, 0.5], [0.47, -0.5], [0.5, -0.5]], 24); break;
    case "trapezoid-prism": {
      const shape2d = new THREE.Shape();
      shape2d.moveTo(-0.5, -0.5);
      shape2d.lineTo(0.5, -0.5);
      shape2d.lineTo(0.27, 0.5);
      shape2d.lineTo(-0.3, 0.5);
      shape2d.closePath();
      geometry = new THREE.ExtrudeGeometry(shape2d, { depth: 1, steps: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2);
      break;
    }
    case "rounded-box": geometry = new RoundedBoxGeometry(1, 1, 1, 1, 0.06); break;
    case "rounded-basin": geometry = roundedBasin(); break;
    case "wedge": geometry = wedge(); break;
    case "arch-band": geometry = archBand(); break;
    default: geometry = new THREE.BoxGeometry(1, 1, 1);
  }
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(size.x > 0 ? 1 / size.x : 1, size.y > 0 ? 1 / size.y : 1, size.z > 0 ? 1 / size.z : 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function ProceduralPartMesh({ part }: { part: ProceduralPart }) {
  const geometry = useMemo(() => createGeometry(part.shape), [part.shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const rotation: [number, number, number] = part.rotation?.map((value) => value * Math.PI / 180) as [number, number, number] ?? [0, 0, 0];
  const flat = ["box", "sphere", "wedge", "pyramid", "arch-band", "trapezoid-prism"].includes(part.shape);
  return <mesh
    geometry={geometry}
    position={part.position}
    scale={part.size}
    rotation={rotation}
    castShadow
    receiveShadow
  >
    <meshStandardMaterial
      color={part.color}
      roughness={part.surface === "ceramic" ? 0.32 : 0.88}
      transparent={part.surface === "glass"}
      opacity={part.surface === "glass" ? 0.2 : 1}
      depthWrite={part.surface !== "glass"}
      metalness={0.02}
      flatShading={flat}
    />
  </mesh>;
}

export function ProceduralModel({ asset }: { asset: ProceduralAsset }) {
  return <group name={`procedural-content:${asset.id}`}>
    {asset.parts.map((part, index) => <ProceduralPartMesh key={`${asset.id}:${index}`} part={part} />)}
  </group>;
}
