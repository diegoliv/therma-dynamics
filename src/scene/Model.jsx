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

const MOBILE_CAMERA_MAX_WIDTH = 767;
const MOBILE_CAMERA_MAX_ASPECT = 0.9;

function selectResponsiveSourceCamera(previewScene, size) {
  const aspect = size.width / Math.max(size.height, 1);
  const isPortraitViewport = aspect < 1;
  const isMobileViewport = isPortraitViewport
    && (size.width <= MOBILE_CAMERA_MAX_WIDTH || aspect <= MOBILE_CAMERA_MAX_ASPECT);

  if (isMobileViewport) {
    return previewScene.sourceCameras.mobile
      ?? previewScene.sourceCameras.desktop
      ?? previewScene.sourceCamera;
  }

  return previewScene.sourceCameras.desktop
    ?? previewScene.sourceCameras.mobile
    ?? previewScene.sourceCamera;
}

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
  onReady,
}) {
  const gltf = useLoader(GLTFLoader, modelUrl);
  const groupRef = useRef();
  const boundsRef = useRef(new THREE.Vector3());
  const { camera, gl, size } = useThree();
  const heatBoundsRef = useRef(createHeatBounds());
  const targetPointerRef = useRef(new THREE.Vector2());
  const smoothedPointerRef = useRef(new THREE.Vector2());
  const isReadyRef = useRef(false);
  const readyRafRef = useRef(null);

  const previewScene = useMemo(() => preparePreviewScene(gltf), [gltf]);
  const { scene, stats } = previewScene;
  const sourceCamera = selectResponsiveSourceCamera(previewScene, size);

  useEffect(() => {
    onStats(stats);
  }, [onStats, stats]);

  useEffect(() => () => {
    if (readyRafRef.current !== null) {
      window.cancelAnimationFrame(readyRafRef.current);
    }
  }, []);

  useEffect(() => {
    if (!groupRef.current) return;
    if (sourceCamera) return;
    fitCameraToObject(camera, groupRef.current, boundsRef);
  }, [camera, scene, sourceCamera]);

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
      sourceCamera,
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

    if (!isReadyRef.current) {
      isReadyRef.current = true;
      readyRafRef.current = window.requestAnimationFrame(() => {
        onReady?.({
          canvas: gl.domElement,
          modelUrl,
          stats,
        });
      });
    }
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
