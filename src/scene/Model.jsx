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
  cameraParallaxAmount,
  onStats,
}) {
  const gltf = useLoader(GLTFLoader, modelUrl);
  const groupRef = useRef();
  const boundsRef = useRef(new THREE.Vector3());
  const { camera, gl } = useThree();
  const heatBoundsRef = useRef(createHeatBounds());
  const targetPointerRef = useRef(new THREE.Vector2());
  const smoothedPointerRef = useRef(new THREE.Vector2());

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

  useEffect(() => {
    const updatePointer = (event) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      targetPointerRef.current.set(
        THREE.MathUtils.clamp(x, -1, 1),
        THREE.MathUtils.clamp(y, -1, 1),
      );
    };

    const resetPointer = () => {
      targetPointerRef.current.set(0, 0);
    };

    window.addEventListener("pointermove", updatePointer);
    window.addEventListener("pointerleave", resetPointer);
    return () => {
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", resetPointer);
    };
  }, [gl]);

  useFrame((_, delta) => {
    smoothedPointerRef.current.lerp(targetPointerRef.current, 1 - Math.exp(-delta * 8));
    updateAnimationTimeline(previewScene.timeline, animationProgress);
    updateSourceCamera({
      camera,
      orbitEnabled,
      pointer: smoothedPointerRef.current,
      parallaxAmount: cameraParallaxAmount,
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
