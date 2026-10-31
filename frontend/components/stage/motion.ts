import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { StagePoint } from "./types";

export function retargetMotionClip(model: THREE.Object3D, source: THREE.AnimationClip) {
  if (model.getObjectByName("mixamorigHips") || !model.getObjectByName("mixamorig_Hips")) return source;
  const clip = source.clone();
  clip.tracks.forEach((track) => { track.name = track.name.replace(/^mixamorig/, "mixamorig_"); });
  return clip;
}

export async function bakeCharacterPose(modelUrl: string, motionUrl: string) {
  const loader = new FBXLoader();
  const [model, motion] = await Promise.all([loader.loadAsync(modelUrl), loader.loadAsync(motionUrl)]);
  if (!motion.animations.length) throw new Error("动作资源没有动画轨道");
  const target = cloneSkeleton(model);
  const mixer = new THREE.AnimationMixer(target);
  const clip = retargetMotionClip(target, motion.animations[0]);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(Math.max(0, clip.duration - 0.0001));
  const rotations: Record<string, StagePoint> = {};
  target.traverse((child) => {
    if (child instanceof THREE.Bone && !rotations[child.name]) rotations[child.name] = [child.rotation.x, child.rotation.y, child.rotation.z];
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(target);
  return rotations;
}
