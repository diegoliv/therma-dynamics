import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { updateAnimationTimeline } from "../model/animationTimeline.js";
import { updatePreviewFrame, updateSourceCamera } from "../model/frameUpdaters.js";
import { createHeatBounds } from "../model/heatInfluence.js";
import { preparePreviewScene } from "../model/preparePreviewScene.js";
import { fitCameraToObject } from "../utils/camera.js";
import { Controls } from "./Controls.jsx";

export function Model({
  orbitEnabled,
  modelUrl,
  thermalSettings,
  coolingSettings,
  glassSettings,
  floorSettings,
  globalOpacitySettings,
  animationProgress,
  onStats,
}) {
  const gltf = useLoader(GLTFLoader, modelUrl);
  const groupRef = useRef();
  const boundsRef = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const heatBoundsRef = useRef(createHeatBounds());

  const previewScene = useMemo(() => preparePreviewScene(gltf), [gltf]);
  const { scene, stats } = previewScene;

  useEffect(() => {
    onStats(stats);
  }, [onStats, stats]);

  useEffect(() => {
    if (!groupRef.current) return;
    if (previewScene.sourceCamera) return;
    fitCameraToObject(camera, groupRef.current, boundsRef);
  }, [camera, previewScene.sourceCamera, scene]);

  useFrame((_, delta) => {
    updateAnimationTimeline(previewScene.timeline, animationProgress);
    updateSourceCamera({
      camera,
      orbitEnabled,
      sourceCamera: previewScene.sourceCamera,
    });
    updatePreviewFrame({
      camera,
      coolingSettings,
      delta,
      floorSettings,
      glassSettings,
      globalOpacitySettings,
      heatBounds: heatBoundsRef.current,
      heatObject: previewScene.heatObject,
      materials: previewScene.materials,
      thermalSettings,
    });
  });

  return (
    <>
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
      <Controls target={boundsRef} enabled={orbitEnabled} />
    </>
  );
}
