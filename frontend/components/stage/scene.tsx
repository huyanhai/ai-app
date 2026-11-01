"use client";

import { ComponentRef, Fragment, RefObject, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, createPortal, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
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
import { Film, Route, UserRound } from "lucide-react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { CharacterPose, StageObject, StagePoint, StageSettings, StageTool } from "./types";
import { PROCEDURAL_BY_NAME } from "./procedural-catalog";
import { ProceduralModel } from "./procedural-model";
import { retargetMotionClip } from "./motion";
import { createBezierPath, getCameraPathOrigin, getCameraValue } from "./camera";
import { getCharacterValue } from "./character";

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;
type LabelRefs = RefObject<Map<string, HTMLDivElement>>;

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
  pathDraft?: { objectId: string; kind: "character" | "camera" | "target"; origin: StagePoint; points: StagePoint[] } | null;
  showPath?: boolean;
  onSelect?: (id: string) => void;
  onTransform?: (id: string, object: StageObject) => void;
  onPlace?: (position: [number, number, number]) => void;
  onAddAction?: (id: string) => void;
  onStartPath?: (id: string) => void;
  onPathPoint?: (point: StagePoint) => void;
  poseMode?: boolean;
  selectedBone?: string;
  onSelectBone?: (objectId: string, boneName: string, rotation: StagePoint) => void;
  onPoseChange?: (objectId: string, boneName: string, rotation: StagePoint, position?: StagePoint) => void;
  cameraPreset?: {
    step: 1 | 2 | 3;
    target: StagePoint;
    cameraPath: StagePoint[];
    targetPath: StagePoint[];
    placingTarget: boolean;
    onTargetChange: (target: StagePoint) => void;
    onTargetPlace: (target: StagePoint) => void;
    onAngleChange: (angle: number) => void;
  } | null;
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

function CameraModel({ target = [0, 1, 0], roll = 0 }: { target?: StagePoint; roll?: number }) {
  const body = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!body.current) return;
    body.current.lookAt(...target);
    body.current.rotateY(Math.PI);
    body.current.rotateZ(THREE.MathUtils.degToRad(roll));
  });
  return (
    <>
      <group ref={body}>
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
      </group>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 12]} />
        <meshStandardMaterial color="#747b83" />
      </mesh>
    </>
  );
}

function PathVisualization({ points, origin, color = "#b2d2b7" }: { points: StagePoint[]; origin?: StagePoint; color?: string }) {
  const curve = useMemo(() => createBezierPath(origin && points.length ? [origin, ...points] : points), [origin, points]);
  return (
    <group>
      {curve && <mesh raycast={() => null}><tubeGeometry args={[curve, Math.max(32, points.length * 16), 0.014, 6, false]} /><meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} /></mesh>}
      {origin && <mesh position={[origin[0], origin[1] + 0.07, origin[2]]} raycast={() => null}><octahedronGeometry args={[0.085, 0]} /><meshBasicMaterial color={color} depthTest={false} /></mesh>}
      {points.map((point, index) => <mesh key={`${point.join("-")}-${index}`} position={[point[0], point[1] + 0.07, point[2]]} raycast={() => null}><octahedronGeometry args={[0.085, 0]} /><meshBasicMaterial color={color} depthTest={false} /></mesh>)}
    </group>
  );
}

function CameraPresetVisualization({ preset }: { preset: NonNullable<SceneProps["cameraPreset"]> }) {
  const targetGroup = useRef<THREE.Group>(null!);
  const rotating = useRef(false);
  const path = preset.cameraPath.length > 1 ? preset.cameraPath : preset.targetPath;
  const color = preset.cameraPath.length > 1 ? "#d6a84f" : "#5cc8d7";
  const updateAngle = (point: THREE.Vector3) => {
    preset.onAngleChange(Math.atan2(point.x - preset.target[0], point.z - preset.target[2]));
  };
  const targetMarker = <>
    <mesh raycast={() => null}><sphereGeometry args={[0.09, 20, 16]} /><meshBasicMaterial color="#ff6666" depthTest={false} /></mesh>
    <mesh position={[0, -preset.target[1] / 2, 0]} raycast={() => null}><cylinderGeometry args={[0.008, 0.008, Math.max(0.01, preset.target[1]), 6]} /><meshBasicMaterial color="#ff6666" transparent opacity={0.6} depthTest={false} /></mesh>
  </>;
  if (preset.step === 1) return <>
    {preset.placingTarget ? <GroundPlacement onPlace={preset.onTargetPlace} /> : <TransformControls object={targetGroup} mode="translate" size={0.7} onMouseUp={() => {
      if (targetGroup.current) preset.onTargetChange(targetGroup.current.position.toArray());
    }}><group ref={targetGroup} position={preset.target}>{targetMarker}</group></TransformControls>}
  </>;
  if (preset.step !== 2) return null;
  return <>
    <group position={preset.target}>{targetMarker}</group>
    {path.length > 1 && <PathVisualization points={path} color={color} />}
    {path.length > 1 && <group position={path[0]} scale={0.65}><CameraModel target={preset.target} /></group>}
    {path.length > 1 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        rotating.current = true;
        (event.target as HTMLElement | null)?.setPointerCapture(event.pointerId);
        updateAngle(event.point);
      }}
      onPointerMove={(event) => {
        if (!rotating.current) return;
        event.stopPropagation();
        updateAngle(event.point);
      }}
      onPointerUp={(event) => {
        rotating.current = false;
        const target = event.target as HTMLElement | null;
        if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { rotating.current = false; }}
    ><planeGeometry args={[200, 200]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
  </>;
}

type PoseViewProps = {
  pose?: CharacterPose;
  poseEditing?: boolean;
  selectedBone?: string;
  onSelectBone?: (boneName: string, rotation: StagePoint) => void;
  onPoseChange?: (boneName: string, rotation: StagePoint, position?: StagePoint) => void;
};

function PoseSkeleton({ root, selectedBone, onSelectBone, onPoseChange }: { root: THREE.Object3D; selectedBone?: string; onSelectBone?: PoseViewProps["onSelectBone"]; onPoseChange?: PoseViewProps["onPoseChange"] }) {
  const scene = useThree((state) => state.scene);
  const [bones, setBones] = useState<THREE.Bone[]>([]);
  const helper = useMemo(() => new THREE.SkeletonHelper(root), [root]);
  useEffect(() => {
    const unique = new Map<string, THREE.Bone>();
    root.traverse((child) => { if (child instanceof THREE.Bone && !unique.has(child.name)) unique.set(child.name, child); });
    setBones([...unique.values()]);
    const material = helper.material as THREE.LineBasicMaterial;
    material.color.set("#72e7ed");
    material.transparent = true;
    material.opacity = 0.42;
    material.depthTest = false;
    return () => { helper.geometry.dispose(); material.dispose(); };
  }, [helper, root]);
  const selected = selectedBone ? root.getObjectByName(selectedBone) : undefined;
  return (
    <>
      {createPortal(<primitive object={helper} renderOrder={8} />, scene)}
      {bones.map((bone) => <Fragment key={bone.uuid}>{createPortal(
        <mesh
          renderOrder={10}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelectBone?.(bone.name, [bone.rotation.x, bone.rotation.y, bone.rotation.z]);
          }}
        >
          <sphereGeometry args={[2.2, 12, 8]} />
          <meshBasicMaterial color={selectedBone === bone.name ? "#ffffff" : "#83f4f5"} depthTest={false} toneMapped={false} />
        </mesh>,
        bone,
      )}</Fragment>)}
      {selected && createPortal(<>
        <TransformControls object={selected} mode="rotate" size={0.55} onObjectChange={() => onPoseChange?.(selected.name, [selected.rotation.x, selected.rotation.y, selected.rotation.z], selected.position.toArray())} />
        <TransformControls object={selected} mode="translate" size={0.55} onObjectChange={() => onPoseChange?.(selected.name, [selected.rotation.x, selected.rotation.y, selected.rotation.z], selected.position.toArray())} />
      </>, scene)}
    </>
  );
}

function NormalizedModel({ model, name, mannequin = false, motion, motionTime = 0, pose, poseEditing = false, selectedBone, onSelectBone, onPoseChange }: { model: THREE.Object3D; name: string; mannequin?: boolean; motion?: THREE.Group; motionTime?: number } & PoseViewProps) {
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
    const pickMeshes: THREE.Mesh[] = [];
    const restPositions: Record<string, StagePoint> = {};
    instance.traverse((child) => {
      if (child instanceof THREE.Mesh) pickMeshes.push(child);
      if (child instanceof THREE.Bone) restPositions[child.name] = child.position.toArray();
    });
    const bounds = new THREE.Box3().setFromObject(instance);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 1.8 / Math.max(size.y, 0.001);
    const height = !mannequin ? 1 : name.includes("儿童") ? 0.7 : name.includes("少年") ? 0.86 : 1;
    const width = !mannequin ? 1 : name.includes("纤瘦") ? 0.78 : name.includes("健壮") ? 1.28 : name.includes("丰腴") ? 1.42 : 1;
    return { instance, pickMeshes, restPositions, scale: [scale * width, scale * height, scale * width] as const, y: -bounds.min.y * scale * height };
  }, [mannequin, model, name]);
  useEffect(() => {
    if (!poseEditing) return;
    const restore = normalized.pickMeshes.map((mesh) => {
      const raycast = mesh.raycast;
      mesh.raycast = () => null;
      return () => { mesh.raycast = raycast; };
    });
    return () => restore.forEach((reset) => reset());
  }, [normalized, poseEditing]);
  const mixer = useMemo(() => motion?.animations.length ? new THREE.AnimationMixer(normalized.instance) : null, [motion, normalized]);
  const clipAction = useMemo(() => {
    const source = motion?.animations[0];
    if (!mixer || !source) return null;
    return mixer.clipAction(retargetMotionClip(normalized.instance, source));
  }, [mixer, motion, normalized]);
  useEffect(() => {
    if (!clipAction) return;
    clipAction.play();
    return () => { clipAction.stop(); };
  }, [clipAction]);
  useFrame(() => {
    if (!mixer || !clipAction) return;
    const duration = clipAction.getClip().duration;
    if (duration > 0) clipAction.time = motionTime % duration;
    mixer.update(0);
  });
  const previousPosePositions = useRef<Record<string, StagePoint>>({});
  useEffect(() => {
    const nextPositions = pose?.positions ?? {};
    const boneNames = new Set([...Object.keys(previousPosePositions.current), ...Object.keys(nextPositions)]);
    boneNames.forEach((boneName) => {
      const bone = normalized.instance.getObjectByName(boneName);
      const position = nextPositions[boneName] ?? normalized.restPositions[boneName];
      if (position) bone?.position.set(...position);
    });
    previousPosePositions.current = nextPositions;
    Object.entries(pose?.rotations ?? {}).forEach(([boneName, rotation]) => {
      const bone = normalized.instance.getObjectByName(boneName);
      bone?.rotation.set(...rotation);
    });
  }, [normalized, pose]);
  return <><group scale={normalized.scale} position={[0, normalized.y, 0]}><primitive object={normalized.instance} /></group>{poseEditing && <PoseSkeleton root={normalized.instance} selectedBone={selectedBone} onSelectBone={onSelectBone} onPoseChange={onPoseChange} />}</>;
}

function ImportedModel({ object, currentTime, poseEditing, selectedBone, onSelectBone, onPoseChange }: { object: StageObject; currentTime: number } & Omit<PoseViewProps, "pose">) {
  const action = object.actions?.findLast((item) => currentTime >= item.start && currentTime <= item.start + item.duration);
  const motionUrl = action?.motionAssetId ? `/api/motions/${action.motionAssetId}` : undefined;
  const motionTime = action ? Math.max(0, currentTime - action.start) : 0;
  const poseProps = { pose: !motionUrl ? object.pose : undefined, poseEditing, selectedBone, onSelectBone, onPoseChange };
  return object.modelFormat === "fbx" ? <FBXImportedModel url={object.modelUrl ?? ""} name={object.name} motionUrl={motionUrl} motionTime={motionTime} {...poseProps} /> : <GLTFImportedModel url={object.modelUrl ?? ""} name={object.name} {...poseProps} />;
}

function FBXImportedModel({ url, name, motionUrl, motionTime = 0, ...poseProps }: { url: string; name: string; motionUrl?: string; motionTime?: number } & PoseViewProps) {
  const model = useFBX(url);
  const mannequin = url.endsWith("/xbot.fbx") || url.endsWith("/ybot.fbx");
  if (motionUrl) return <Suspense fallback={<NormalizedModel model={model} name={name} mannequin={mannequin} {...poseProps} />}><FBXMotionModel model={model} name={name} mannequin={mannequin} motionUrl={motionUrl} motionTime={motionTime} {...poseProps} /></Suspense>;
  return <NormalizedModel model={model} name={name} mannequin={mannequin} {...poseProps} />;
}

function FBXMotionModel({ model, name, mannequin, motionUrl, motionTime, ...poseProps }: { model: THREE.Group; name: string; mannequin: boolean; motionUrl: string; motionTime: number } & PoseViewProps) {
  const motion = useFBX(motionUrl);
  return <NormalizedModel model={model} name={name} mannequin={mannequin} motion={motion} motionTime={motionTime} {...poseProps} />;
}

function GLTFImportedModel({ url, name, ...poseProps }: { url: string; name: string } & PoseViewProps) {
  const model = useGLTF(url);
  return <NormalizedModel model={model.scene} name={name} {...poseProps} />;
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

function LabelProjection({ object, labelRefs }: { object: StageObject; labelRefs: LabelRefs }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const element = labelRefs.current.get(object.id);
    if (!element) return;
    const height = object.type === "character" ? 2.15 : object.type === "camera" ? 0.9 : 1.6;
    point.set(object.position[0], object.position[1] + height, object.position[2]).project(camera);
    element.style.transform = `translate3d(${(point.x * 0.5 + 0.5) * size.width}px, ${(-point.y * 0.5 + 0.5) * size.height}px, 0) translate(-50%, -50%)`;
    element.style.visibility = point.z >= -1 && point.z <= 1 ? "visible" : "hidden";
  });
  return null;
}

function SelectableObject({
  object,
  selected,
  tool,
  preview,
  currentTime,
  pathEditing = false,
  onSelect,
  onTransform,
  onAddAction,
  onStartPath,
  poseMode = false,
  selectedBone,
  onSelectBone,
  onPoseChange,
}: {
  object: StageObject;
  selected: boolean;
  tool: StageTool;
  preview: boolean;
  currentTime: number;
  pathEditing?: boolean;
  onSelect?: (id: string) => void;
  onTransform?: (id: string, object: StageObject) => void;
  onAddAction?: (id: string) => void;
  onStartPath?: (id: string) => void;
  poseMode?: boolean;
  selectedBone?: string;
  onSelectBone?: SceneProps["onSelectBone"];
  onPoseChange?: SceneProps["onPoseChange"];
}) {
  const group = useRef<THREE.Group>(null!);
  const boneEditing = poseMode && selected && object.type === "character" && Boolean(object.pose);
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
      {object.modelUrl ? <Suspense fallback={object.type === "character" ? null : <PropModel name={object.name} />}><ImportedModel object={object} currentTime={currentTime} poseEditing={boneEditing} selectedBone={selectedBone} onSelectBone={(boneName, rotation) => onSelectBone?.(object.id, boneName, rotation)} onPoseChange={(boneName, rotation, position) => onPoseChange?.(object.id, boneName, rotation, position)} /></Suspense> : object.type === "camera" ? <CameraModel target={object.target} roll={object.roll} /> : object.type === "character" ? <CharacterModel name={object.name} /> : <PropModel name={object.name} />}
      {selected && !preview && (
        <mesh position={[0, object.type === "camera" ? -0.82 : 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.58, 48]} />
          <meshBasicMaterial color="#70b7ff" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
  if (!selected || tool === "select" || object.locked || preview || pathEditing) return model;
  return (
    <>
      <TransformControls
        object={group}
        mode={tool}
        size={0.75}
        enabled={!boneEditing}
        showX={!boneEditing}
        showY={!boneEditing}
        showZ={!boneEditing}
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
    </>
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
    camera.up.set(0, 1, 0);
    camera.lookAt(...(object?.target ?? [0, 1, 0]));
    camera.rotateZ(THREE.MathUtils.degToRad(object?.roll ?? 0));
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = object?.fov ?? 50;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

function GroundPlacement({ onPlace }: { onPlace?: (position: [number, number, number]) => void }) {
  const [point, setPoint] = useState<[number, number, number]>([0, 0.05, 0]);
  const [visible, setVisible] = useState(false);
  const drag = useRef<{ pointerId: number; ground: StagePoint; startClientY: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          if (drag.current) {
            const height = Math.max(0, (drag.current.startClientY - event.clientY) * 0.01);
            setPoint([drag.current.ground[0], height + 0.05, drag.current.ground[2]]);
          } else {
            setPoint([event.point.x, 0.05, event.point.z]);
          }
          setVisible(true);
        }}
        onPointerOut={() => { if (!drag.current) setVisible(false); }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          const ground: StagePoint = [event.point.x, 0, event.point.z];
          drag.current = { pointerId: event.pointerId, ground, startClientY: event.clientY };
          (event.target as HTMLElement | null)?.setPointerCapture(event.pointerId);
          setPoint([ground[0], 0.05, ground[2]]);
          setVisible(true);
          setDragging(true);
        }}
        onPointerUp={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          event.stopPropagation();
          const height = Math.max(0, (drag.current.startClientY - event.clientY) * 0.01);
          onPlace?.([drag.current.ground[0], height, drag.current.ground[2]]);
          drag.current = null;
          setDragging(false);
          const target = event.target as HTMLElement | null;
          if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          drag.current = null;
          setDragging(false);
          const target = event.target as HTMLElement | null;
          if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
        }}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {visible && (
        <>
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
          {dragging && point[1] > 0.05 && <mesh position={[point[0], point[1] / 2, point[2]]} raycast={() => null}>
            <cylinderGeometry args={[0.008, 0.008, point[1], 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.65} depthTest={false} />
          </mesh>}
        </>
      )}
    </group>
  );
}

function World({ settings, objects, selectedId, tool, preview = false, playing = false, currentTime = 0, resetKey, focusKey, bottomOffset = 0, placing = false, pathDraft, showPath = true, onSelect, onTransform, onPlace, onAddAction, onStartPath, onPathPoint, poseMode, selectedBone, onSelectBone, onPoseChange, cameraPreset, labelRefs }: SceneProps & { labelRefs: LabelRefs }) {
  const animatedObjects = objects.map((object) => {
    if (object.type === "camera") return {
      ...object,
      position: getCameraValue(object, "position", currentTime) as StagePoint,
      target: getCameraValue(object, "target", currentTime) as StagePoint,
      fov: getCameraValue(object, "fov", currentTime) as number,
      roll: getCameraValue(object, "roll", currentTime) as number,
    };
    if (object.type !== "character") return object;
    const animated = {
      ...object,
      position: getCharacterValue(object, "position", currentTime),
      rotation: getCharacterValue(object, "rotation", currentTime),
      scale: getCharacterValue(object, "scale", currentTime),
    };
    const action = object.actions?.findLast((item) => currentTime >= item.start && currentTime <= item.start + item.duration);
    if (!action) return animated;
    const progress = THREE.MathUtils.clamp((currentTime - action.start) / action.duration, 0, 1);
    if (action.kind !== "action" && object.path) {
      const curve = createBezierPath([object.pathOrigin ?? object.position, ...object.path]);
      if (curve) {
        const point = curve.getPoint(progress);
        const tangent = curve.getTangent(progress);
        return { ...animated, position: [point.x, point.y + Math.abs(Math.sin(currentTime * (action.kind === "run" ? 12 : 7))) * 0.035, point.z] as StagePoint, rotation: object.pathAutoRotate ? [animated.rotation[0], Math.atan2(tangent.x, tangent.z), animated.rotation[2]] as StagePoint : animated.rotation };
      }
    }
    if (action.motionAssetId) return animated;
    const lean = ["鞠躬", "低头闪避"].some((name) => action.name.includes(name)) ? Math.sin(progress * Math.PI) * 0.45 : 0;
    const sway = ["祈祷", "听音乐"].some((name) => action.name.includes(name)) ? Math.sin(currentTime * 5) * 0.08 : 0;
    const bounce = action.name.includes("跺脚") ? Math.abs(Math.sin(currentTime * 9)) * 0.06 : 0;
    return { ...animated, position: [animated.position[0], animated.position[1] + bounce, animated.position[2]] as StagePoint, rotation: [animated.rotation[0] + lean, animated.rotation[1], animated.rotation[2] + sway] as StagePoint };
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
      {pathDraft && !preview && <GroundPlacement onPlace={onPathPoint} />}
      {cameraPreset && !preview && <CameraPresetVisualization preset={cameraPreset} />}
      {!preview && showPath && objects.filter((object) => object.path && object.id !== pathDraft?.objectId).map((object) => <PathVisualization key={`path-${object.id}`} points={[object.pathOrigin ?? object.position, ...object.path!]} />)}
      {!preview && showPath && pathDraft && <PathVisualization points={pathDraft.points} origin={pathDraft.origin} color={pathDraft.kind === "camera" ? "#d6a84f" : pathDraft.kind === "target" ? "#5cc8d7" : "#b2d2b7"} />}
      {!preview && showPath && objects.filter((object) => object.id === selectedId && object.cameraPath && object.id !== pathDraft?.objectId).map((object) => <PathVisualization key={`camera-path-${object.id}`} points={object.cameraPath!} origin={object.cameraPathOrigin ?? (object.cameraKeyframes?.position?.[0]?.value as StagePoint | undefined) ?? getCameraPathOrigin(object, "camera", currentTime)} color="#d6a84f" />)}
      {!preview && showPath && objects.filter((object) => object.id === selectedId && object.targetPath && object.id !== pathDraft?.objectId).map((object) => <PathVisualization key={`target-path-${object.id}`} points={object.targetPath!} origin={object.targetPathOrigin ?? (object.cameraKeyframes?.target?.[0]?.value as StagePoint | undefined) ?? getCameraPathOrigin(object, "target", currentTime)} color="#5cc8d7" />)}
      {animatedObjects.filter((object) => preview || object.type !== "camera" || object.id === selectedId).map((object) => (
        <SelectableObject key={object.id} object={object} selected={!placing && object.id === selectedId} tool={tool} preview={preview} currentTime={currentTime} pathEditing={Boolean(pathDraft)} onSelect={onSelect} onTransform={onTransform} onAddAction={onAddAction} onStartPath={onStartPath} poseMode={poseMode} selectedBone={selectedBone} onSelectBone={onSelectBone} onPoseChange={onPoseChange} />
      ))}
      {!preview && animatedObjects.filter((object) => object.type !== "camera" || object.id === selectedId).map((object) => <LabelProjection key={`label-${object.id}`} object={object} labelRefs={labelRefs} />)}
      {preview ? <PreviewCamera object={selected?.type === "camera" ? selected : animatedObjects.find((object) => object.type === "camera")} /> : <DirectorControls resetKey={resetKey} focusKey={focusKey} selected={selected} placing={placing || Boolean(pathDraft) || Boolean(cameraPreset?.placingTarget)} />}
      {!preview && (
        <GizmoHelper alignment="bottom-right" margin={[64, 64 + bottomOffset]}>
          <GizmoViewport axisColors={["#ed6464", "#70c795", "#6d85e8"]} labelColor="#171717" />
        </GizmoHelper>
      )}
    </>
  );
}

export function StageScene(props: SceneProps) {
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  useEffect(() => {
    useFBX.preload("/stage/models/xbot.fbx");
    useFBX.preload("/stage/models/ybot.fbx");
  }, []);

  return (
    <div className="relative size-full overflow-hidden">
      <Canvas
      className={props.preview ? "stage-preview-canvas" : "stage-main-canvas"}
      shadows
      dpr={[1, 1.5]}
      camera={{ position: props.preview ? [0, 1.6, 4] : [7, 5, 8], fov: 50, near: 0.1, far: 200 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ cursor: (props.placing || props.pathDraft) && !props.preview ? "crosshair" : "default" }}
      onPointerMissed={() => props.onSelect?.("")}
    >
        <World {...props} labelRefs={labelRefs} />
      </Canvas>
      {!props.preview && <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
        {props.objects.filter((object) => object.type !== "camera" || object.id === props.selectedId).map((object) => {
          const selected = !props.placing && object.id === props.selectedId;
          return <div key={object.id} ref={(element) => { if (element) labelRefs.current.set(object.id, element); else labelRefs.current.delete(object.id); }} className="pointer-events-auto absolute left-0 top-0 flex flex-col items-center whitespace-nowrap" style={{ visibility: "hidden" }}>
            <span className="text-xs font-medium text-white drop-shadow-[0_1px_3px_black]">{object.name}</span>
            {selected && object.type === "character" && !props.pathDraft && (props.poseMode ? <button type="button" aria-label="预设姿势" className="group/pose relative mt-2 flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/85 text-white/80 shadow-lg hover:bg-[#303030] hover:text-white" onClick={() => props.onAddAction?.(object.id)}><UserRound size={16} /><span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#2b2b2b] px-3 py-2 text-[11px] opacity-0 shadow-xl transition-opacity group-hover/pose:opacity-100">预设姿势</span></button> : <div className="mt-2 flex gap-2">
              <button type="button" aria-label="添加动作到时间轴" className="group/action relative flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/85 text-white/80 shadow-lg hover:bg-[#303030] hover:text-white" onClick={() => props.onAddAction?.(object.id)}><Film size={16} /><span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#2b2b2b] px-3 py-2 text-[11px] opacity-0 shadow-xl transition-opacity group-hover/action:opacity-100">添加动作到时间轴</span></button>
              <button type="button" aria-label="绘制行走路径" className="group/path relative flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/85 text-white/80 shadow-lg hover:bg-[#303030] hover:text-white" onClick={() => props.onStartPath?.(object.id)}><Route size={16} /><span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#2b2b2b] px-3 py-2 text-[11px] opacity-0 shadow-xl transition-opacity group-hover/path:opacity-100">绘制行走路径</span></button>
            </div>)}
          </div>;
        })}
      </div>}
    </div>
  );
}
