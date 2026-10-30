"use client";

import { ComponentRef, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Lightformer,
  OrbitControls,
  TransformControls,
  useFBX,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { StageObject, StageSettings, StageTool } from "./types";
import { PROCEDURAL_BY_NAME } from "./procedural-catalog";
import { ProceduralModel } from "./procedural-model";

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

type SceneProps = {
  settings: StageSettings;
  objects: StageObject[];
  selectedId: string;
  tool: StageTool;
  preview?: boolean;
  playing?: boolean;
  currentTime?: number;
  resetKey?: number;
  focusKey?: number;
  bottomOffset?: number;
  placing?: boolean;
  onSelect?: (id: string) => void;
  onTransform?: (id: string, object: StageObject) => void;
  onPlace?: (position: [number, number, number]) => void;
};

function SceneLights({ settings }: { settings: StageSettings }) {
  const horizontal = THREE.MathUtils.degToRad(settings.mainLight.horizontal ?? -34);
  const elevation = THREE.MathUtils.degToRad(settings.mainLight.elevation ?? 51);
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[Math.sin(horizontal) * 8, Math.sin(elevation) * 8, Math.cos(horizontal) * 8]}
        color={settings.mainLight.color}
        intensity={settings.mainLight.intensity}
        castShadow={settings.mainLight.shadow}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 3, 2]} color={settings.fillLight.color} intensity={settings.fillLight.intensity} />
      <directionalLight position={[2, 4, -6]} color={settings.rimLight.color} intensity={settings.rimLight.intensity} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={1.5} position={[-5, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} />
        <Lightformer intensity={1} position={[5, 3, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3, 1]} />
      </Environment>
    </>
  );
}

function CameraModel() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.65, 0.42, 0.55]} />
        <meshStandardMaterial color="#b9c0c7" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.22, 0.36, 24]} />
        <meshStandardMaterial color="#353a40" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.28, 0.12, 0.22]} />
        <meshStandardMaterial color="#69737e" />
      </mesh>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 12]} />
        <meshStandardMaterial color="#747b83" />
      </mesh>
    </group>
  );
}

function NormalizedModel({ model, name, mannequin = false }: { model: THREE.Object3D; name: string; mannequin?: boolean }) {
  const normalized = useMemo(() => {
    const instance = cloneSkeleton(model);
    if (mannequin) {
      instance.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const cloned = materials.map((material) => {
          const next = material.clone();
          next.color.set(child.name.includes("Joints") ? "#343840" : "#b7bbc3");
          return next;
        });
        child.material = Array.isArray(child.material) ? cloned : cloned[0];
      });
    }
    instance.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(instance);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 1.8 / Math.max(size.y, 0.001);
    const height = !mannequin ? 1 : name.includes("儿童") ? 0.7 : name.includes("少年") ? 0.86 : 1;
    const width = !mannequin ? 1 : name.includes("纤瘦") ? 0.78 : name.includes("健壮") ? 1.28 : name.includes("丰腴") ? 1.42 : 1;
    return { instance, scale: [scale * width, scale * height, scale * width] as const, y: -bounds.min.y * scale * height };
  }, [mannequin, model, name]);
  return <group scale={normalized.scale} position={[0, normalized.y, 0]}><primitive object={normalized.instance} /></group>;
}

function ImportedModel({ object }: { object: StageObject }) {
  return object.modelFormat === "fbx" ? <FBXImportedModel url={object.modelUrl ?? ""} name={object.name} /> : <GLTFImportedModel url={object.modelUrl ?? ""} name={object.name} />;
}

function FBXImportedModel({ url, name }: { url: string; name: string }) {
  const model = useFBX(url);
  return <NormalizedModel model={model} name={name} mannequin={url.endsWith("/xbot.fbx") || url.endsWith("/ybot.fbx")} />;
}

function GLTFImportedModel({ url, name }: { url: string; name: string }) {
  const model = useGLTF(url);
  return <NormalizedModel model={model.scene} name={name} />;
}

function CharacterModel({ name }: { name: string }) {
  const child = name.includes("儿童");
  const teen = name.includes("少年");
  const slim = name.includes("纤瘦");
  const strong = name.includes("健壮");
  const full = name.includes("丰腴");
  const height = child ? 0.68 : teen ? 0.86 : 1;
  const width = slim ? 0.78 : strong ? 1.28 : full ? 1.42 : 1;
  const headScale = child ? 1.22 : teen ? 1.08 : 1;
  const bodyMaterial = <meshStandardMaterial color="#b7bbc3" metalness={0.28} roughness={0.46} />;
  const jointMaterial = <meshStandardMaterial color="#343840" metalness={0.45} roughness={0.5} />;
  return (
    <group scale={[width, height, width]}>
      <mesh position={[0, 1.75, 0]} scale={[0.12 * headScale, 0.16 * headScale, 0.115 * headScale]} castShadow>
        <sphereGeometry args={[1, 28, 20]} />
        {bodyMaterial}
      </mesh>
      <mesh position={[0, 1.58, 0]} castShadow>
        <cylinderGeometry args={[0.065, 0.075, 0.12, 20]} />
        {jointMaterial}
      </mesh>
      <mesh position={[0, 1.39, 0]} scale={[0.3, 0.25, 0.16]} castShadow>
        <sphereGeometry args={[1, 28, 20]} />
        {bodyMaterial}
      </mesh>
      <mesh position={[0, 1.22, 0]} scale={[0.2, 0.07, 0.13]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        {jointMaterial}
      </mesh>
      <mesh position={[0, 1.14, 0]} scale={[0.19, 0.17, 0.135]} castShadow>
        <sphereGeometry args={[1, 28, 18]} />
        {bodyMaterial}
      </mesh>
      <mesh position={[0, 1.015, 0]} scale={[0.19, 0.055, 0.13]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        {jointMaterial}
      </mesh>
      <mesh position={[0, 0.94, 0]} scale={[0.235, 0.16, 0.15]} castShadow>
        <sphereGeometry args={[1, 28, 18]} />
        {bodyMaterial}
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.285, 1.48, 0]} scale={[0.12, 0.105, 0.11]} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
            {bodyMaterial}
          </mesh>
          <mesh position={[side * 0.46, 1.445, 0]} rotation={[0, 0, -side * (Math.PI / 2 + 0.12)]} castShadow>
            <capsuleGeometry args={[0.075, 0.2, 8, 16]} />
            {bodyMaterial}
          </mesh>
          <mesh position={[side * 0.625, 1.42, 0]} castShadow>
            <sphereGeometry args={[0.066, 18, 14]} />
            {jointMaterial}
          </mesh>
          <mesh position={[side * 0.775, 1.39, 0]} rotation={[0, 0, -side * (Math.PI / 2 + 0.12)]} castShadow>
            <capsuleGeometry args={[0.065, 0.17, 8, 16]} />
            {bodyMaterial}
          </mesh>
          <mesh position={[side * 0.93, 1.36, 0]} castShadow>
            <sphereGeometry args={[0.045, 16, 12]} />
            {jointMaterial}
          </mesh>
          <mesh position={[side * 0.99, 1.345, 0]} rotation={[0, 0, -side * (Math.PI / 2 + 0.12)]} scale={[1, 1, 0.72]} castShadow>
            <capsuleGeometry args={[0.05, 0.065, 6, 12]} />
            {bodyMaterial}
          </mesh>
          {[-0.035, 0, 0.035].map((offset) => (
            <mesh key={offset} position={[side * 1.065, 1.325 + offset * 0.3, offset]} rotation={[0, 0, -side * (Math.PI / 2 + 0.12)]} castShadow>
              <capsuleGeometry args={[0.013, 0.055, 4, 8]} />
              {bodyMaterial}
            </mesh>
          ))}
          <mesh position={[side * 1.01, 1.285, 0.045]} rotation={[0.35, 0, -side * 0.75]} castShadow>
            <capsuleGeometry args={[0.016, 0.05, 4, 8]} />
            {bodyMaterial}
          </mesh>
          <mesh position={[side * 0.13, 0.9, 0]} castShadow>
            <sphereGeometry args={[0.09, 20, 14]} />
            {jointMaterial}
          </mesh>
          <mesh position={[side * 0.13, 0.72, 0]} scale={[1, 1, 0.92]} castShadow>
            <capsuleGeometry args={[0.105, 0.25, 8, 18]} />
            {bodyMaterial}
          </mesh>
          <mesh position={[side * 0.13, 0.52, 0]} scale={[1, 0.85, 0.9]} castShadow>
            <sphereGeometry args={[0.083, 20, 14]} />
            {jointMaterial}
          </mesh>
          <mesh position={[side * 0.13, 0.325, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.09, 0.3, 20]} />
            {bodyMaterial}
          </mesh>
          <mesh position={[side * 0.13, 0.455, 0]} scale={[0.09, 0.11, 0.085]} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
            {bodyMaterial}
          </mesh>
          <mesh position={[side * 0.13, 0.155, 0]} castShadow>
            <cylinderGeometry args={[0.052, 0.052, 0.075, 16]} />
            {jointMaterial}
          </mesh>
          <mesh position={[side * 0.13, 0.065, 0.075]} castShadow>
            <boxGeometry args={[0.16, 0.11, 0.32]} />
            {bodyMaterial}
          </mesh>
        </group>
      ))}
    </group>
  );
}

function HalfCylinderModel() {
  const geometry = useMemo(() => {
    const side = new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
    const cap = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
    const merged = mergeGeometries([side, cap]);
    side.dispose();
    cap.dispose();
    if (!merged) throw new Error("无法创建半圆柱");
    merged.computeBoundingBox();
    const bounds = merged.boundingBox!;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    merged.translate(-center.x, -center.y, -center.z).scale(1 / size.x, 1 / size.y, 1 / size.z);
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[0, 0.5, 0]} castShadow receiveShadow><meshStandardMaterial color="#ffffff" roughness={0.86} metalness={0.02} /></mesh>;
}

function PropModel({ name }: { name: string }) {
  const proceduralAsset = PROCEDURAL_BY_NAME.get(name);
  if (proceduralAsset) return <ProceduralModel asset={proceduralAsset} />;
  const material = <meshStandardMaterial color="#ffffff" roughness={0.86} metalness={0.02} side={name === "基础平面" ? THREE.DoubleSide : THREE.FrontSide} polygonOffset={name === "基础平面"} polygonOffsetFactor={-1} polygonOffsetUnits={-1} />;
  if (name === "简化人体") {
    const bodyHeight = 1.28;
    const headRadius = 0.21;
    const phiLength = 2 * Math.asin(0.24 / (2 * headRadius));
    const thetaLength = 2 * Math.asin(0.055 / (2 * headRadius));
    const directionMaterial = <meshStandardMaterial color="#16b8dc" roughness={0.68} metalness={0.02} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />;
    return <group>
      <mesh position={[0, bodyHeight + headRadius, 0]} castShadow receiveShadow><sphereGeometry args={[headRadius, 24, 16]} />{material}</mesh>
      <mesh position={[0, bodyHeight / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.46, bodyHeight, 0.3]} />{material}</mesh>
      <mesh position={[0, bodyHeight + headRadius, 0]} castShadow receiveShadow><sphereGeometry args={[headRadius, 16, 4, Math.PI / 2 - phiLength / 2, phiLength, Math.PI / 2 - thetaLength / 2, thetaLength]} />{directionMaterial}</mesh>
      <mesh position={[0, bodyHeight * 0.8, 0.15]} castShadow receiveShadow><planeGeometry args={[0.3, 0.06]} />{directionMaterial}</mesh>
    </group>;
  }
  if (name === "球体") return <mesh position={[0, 0.5, 0]} castShadow receiveShadow><sphereGeometry args={[0.5, 48, 32]} />{material}</mesh>;
  if (name === "长方体") return <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[1.6, 1, 0.8]} />{material}</mesh>;
  if (name === "圆柱体") return <mesh position={[0, 0.5, 0]} castShadow receiveShadow><cylinderGeometry args={[0.5, 0.5, 1, 48]} />{material}</mesh>;
  if (name === "圆锥体") return <mesh position={[0, 0.5, 0]} castShadow receiveShadow><coneGeometry args={[0.5, 1, 48]} />{material}</mesh>;
  if (name === "四棱锥") return <mesh position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow><coneGeometry args={[0.7, 1, 4]} />{material}</mesh>;
  if (name === "圆环体") return <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow><torusGeometry args={[0.58, 0.16, 24, 64]} />{material}</mesh>;
  if (name === "基础平面") return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[2, 2]} />{material}</mesh>;
  if (name === "胶囊体") return <mesh position={[0, 1, 0]} castShadow receiveShadow><capsuleGeometry args={[0.4, 1.2, 12, 28]} />{material}</mesh>;
  if (name === "圆盘") return <mesh position={[0, 0.02, 0]} castShadow receiveShadow><cylinderGeometry args={[0.5, 0.5, 0.04, 48]} />{material}</mesh>;
  if (name === "半圆弧") return <group position={[0, 0.06, 0]}>
    <mesh castShadow receiveShadow><torusGeometry args={[0.44, 0.06, 16, 48, Math.PI]} />{material}</mesh>
    {[-0.44, 0.44].map((x) => <mesh key={x} position={[x, 0, 0]} castShadow receiveShadow><sphereGeometry args={[0.06, 16, 8]} />{material}</mesh>)}
  </group>;
  if (name === "半圆柱") return <HalfCylinderModel />;
  return <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} />{material}</mesh>;
}

function SelectableObject({
  object,
  selected,
  tool,
  preview,
  onSelect,
  onTransform,
}: {
  object: StageObject;
  selected: boolean;
  tool: StageTool;
  preview: boolean;
  onSelect?: (id: string) => void;
  onTransform?: (id: string, object: StageObject) => void;
}) {
  const group = useRef<THREE.Group>(null!);
  if (preview && object.type === "camera") return null;
  const model = (
    <group
      ref={group}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect?.(object.id);
      }}
    >
      {object.modelUrl ? <Suspense fallback={object.type === "character" ? null : <PropModel name={object.name} />}><ImportedModel object={object} /></Suspense> : object.type === "camera" ? <CameraModel /> : object.type === "character" ? <CharacterModel name={object.name} /> : <PropModel name={object.name} />}
      {selected && !preview && (
        <mesh position={[0, object.type === "camera" ? -0.82 : 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.58, 48]} />
          <meshBasicMaterial color="#70b7ff" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
  if (!selected || tool === "select" || object.locked || preview) return model;
  return (
    <TransformControls
      object={group}
      mode={tool}
      size={0.75}
      onMouseUp={() => {
        if (!group.current || !onTransform) return;
        const current = group.current;
        onTransform(object.id, {
          ...object,
          position: current.position.toArray(),
          rotation: [current.rotation.x, current.rotation.y, current.rotation.z],
          scale: current.scale.toArray(),
        });
      }}
    >
      {model}
    </TransformControls>
  );
}

function DirectorControls({ resetKey = 0, focusKey = 0, selected, placing = false }: { resetKey?: number; focusKey?: number; selected?: StageObject; placing?: boolean }) {
  const controls = useRef<OrbitControlsRef>(null);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(7, 5, 8);
    camera.lookAt(0, 0.8, 0);
    controls.current?.target.set(0, 0.8, 0);
    controls.current?.update();
  }, [camera, resetKey]);
  useEffect(() => {
    if (!focusKey || !selected) return;
    controls.current?.target.set(...selected.position);
    camera.position.set(selected.position[0] + 3, selected.position[1] + 2, selected.position[2] + 4);
    controls.current?.update();
  }, [camera, focusKey, selected]);
  return <OrbitControls ref={controls} makeDefault enabled={!placing} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.02} />;
}

function Exposure({ value }: { value: number }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

function PreviewCamera({ object }: { object?: StageObject }) {
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    const position = object?.position ?? [0, 1.6, 4];
    camera.position.set(...position);
    camera.lookAt(0, 0.9, 0);
  });
  return null;
}

function GroundPlacement({ onPlace }: { onPlace?: (position: [number, number, number]) => void }) {
  const [point, setPoint] = useState<[number, number, number]>([0, 0.05, 0]);
  const [visible, setVisible] = useState(false);
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          setPoint([event.point.x, 0.05, event.point.z]);
          setVisible(true);
        }}
        onPointerOut={() => setVisible(false)}
        onClick={(event) => {
          event.stopPropagation();
          onPlace?.([event.point.x, 0, event.point.z]);
        }}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {visible && (
        <group position={point}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.14, 0.19, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.025, 0.04, 20]} />
            <meshBasicMaterial color="#ffffff" depthTest={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function World({ settings, objects, selectedId, tool, preview = false, playing = false, currentTime = 0, resetKey, focusKey, bottomOffset = 0, placing = false, onSelect, onTransform, onPlace }: SceneProps) {
  const animatedObjects = objects.map((object) => {
    if (!playing || object.type !== "camera") return object;
    return {
      ...object,
      position: [
        object.position[0] + Math.sin(currentTime * 0.5) * 1.5,
        object.position[1],
        object.position[2] + Math.cos(currentTime * 0.5) * 1.5 - 1.5,
      ] as [number, number, number],
    };
  });
  const selected = animatedObjects.find((object) => object.id === selectedId);
  return (
    <>
      <color attach="background" args={[settings.backgroundColor]} />
      <fog attach="fog" args={[settings.backgroundColor, 18, 55]} />
      <Exposure value={settings.exposure} />
      <SceneLights settings={settings} />
      {settings.showGround && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial color={settings.groundColor} transparent opacity={Math.max(0.65, settings.groundOpacity / 100)} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {settings.showGrid && (
        <Grid position={[0, 0.02, 0]} args={[10, 10]} infiniteGrid cellSize={1} cellColor="#4a4a4a" sectionSize={5} sectionColor="#707070" fadeDistance={42} fadeStrength={1.5} />
      )}
      {placing && !preview && <GroundPlacement onPlace={onPlace} />}
      {animatedObjects.filter((object) => preview || object.type !== "camera" || object.id === selectedId).map((object) => (
        <SelectableObject key={object.id} object={object} selected={!placing && object.id === selectedId} tool={tool} preview={preview} onSelect={onSelect} onTransform={onTransform} />
      ))}
      {preview ? <PreviewCamera object={selected?.type === "camera" ? selected : animatedObjects.find((object) => object.type === "camera")} /> : <DirectorControls resetKey={resetKey} focusKey={focusKey} selected={selected} placing={placing} />}
      {!preview && (
        <GizmoHelper alignment="bottom-right" margin={[64, 64 + bottomOffset]}>
          <GizmoViewport axisColors={["#ed6464", "#70c795", "#6d85e8"]} labelColor="#171717" />
        </GizmoHelper>
      )}
    </>
  );
}

export function StageScene(props: SceneProps) {
  useEffect(() => {
    useFBX.preload("/stage/models/xbot.fbx");
    useFBX.preload("/stage/models/ybot.fbx");
  }, []);

  return (
    <Canvas
      className={props.preview ? "stage-preview-canvas" : "stage-main-canvas"}
      shadows
      dpr={[1, 1.5]}
      camera={{ position: props.preview ? [0, 1.6, 4] : [7, 5, 8], fov: 50, near: 0.1, far: 200 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ cursor: props.placing && !props.preview ? "crosshair" : "default" }}
      onPointerMissed={() => props.onSelect?.("")}
    >
      <World {...props} />
    </Canvas>
  );
}
