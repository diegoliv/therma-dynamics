import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { updateAnimationTimeline, updateCameraAnimationSample } from "../model/animationTimeline.js";
import { updatePreviewFrame, updateSourceCamera } from "../model/frameUpdaters.js";
import { createHeatBounds } from "../model/heatInfluence.js";
import { preparePreviewScene } from "../model/preparePreviewScene.js";
import { fitCameraToObject } from "../utils/camera.js";
import { Controls } from "./Controls.jsx";

const MOBILE_CAMERA_MEDIA_QUERY = "(max-width: 720px) and (orientation: portrait)";
const MOBILE_CAMERA_MAX_ASPECT = 0.9;

function getViewportCameraMode(viewportSize) {
  const aspect = viewportSize.width / Math.max(viewportSize.height, 1);
  const isPortraitViewport = aspect < 1;
  const matchesMobileMedia = window.matchMedia?.(MOBILE_CAMERA_MEDIA_QUERY).matches ?? false;
  const isMobileViewport = matchesMobileMedia || (isPortraitViewport && aspect <= MOBILE_CAMERA_MAX_ASPECT);

  return {
    aspect,
    height: viewportSize.height,
    isMobileViewport,
    matchesMobileMedia,
    mode: isMobileViewport ? "mobile" : "desktop",
    width: viewportSize.width,
  };
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
  animationTimeSeconds,
  cameraSettings,
  cameraParallaxAmount,
  onStats,
  onReady,
}) {
  const gltf = useLoader(GLTFLoader, modelUrl);
  const groupRef = useRef();
  const boundsRef = useRef(new THREE.Vector3());
  const { camera, gl } = useThree();
  const heatBoundsRef = useRef(createHeatBounds());
  const activeCameraNameRef = useRef(null);
  const targetPointerRef = useRef(new THREE.Vector2());
  const smoothedPointerRef = useRef(new THREE.Vector2());
  const isReadyRef = useRef(false);
  const readyRafRef = useRef(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    height: window.innerHeight,
    width: window.innerWidth,
  }));

  const previewScene = useMemo(() => preparePreviewScene(gltf), [gltf]);
  const { scene, stats } = previewScene;
  const viewportCameraMode = getViewportCameraMode(viewportSize);
  const { sourceCamera } = previewScene;

  useEffect(() => {
    onStats(stats);
  }, [onStats, stats]);

  useEffect(() => () => {
    if (readyRafRef.current !== null) {
      window.cancelAnimationFrame(readyRafRef.current);
    }
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  useEffect(() => {
    if (!groupRef.current) return;
    if (sourceCamera) return;
    fitCameraToObject(camera, groupRef.current, boundsRef);
  }, [camera, scene, sourceCamera]);

  useEffect(() => {
    const detail = {
      mode: viewportCameraMode.mode,
      selectedCameraName: sourceCamera?.name ?? null,
      viewport: viewportCameraMode,
    };

    window.THERMADYNAMICS_CAMERA_STATE = detail;
    window.dispatchEvent(new CustomEvent("therma-dynamics:camera-change", { detail }));
  }, [
    viewportCameraMode.aspect,
    viewportCameraMode.height,
    viewportCameraMode.isMobileViewport,
    viewportCameraMode.matchesMobileMedia,
    viewportCameraMode.mode,
    viewportCameraMode.width,
    sourceCamera,
  ]);

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
    const modelAnimationTime = Number.isFinite(animationTimeSeconds)
      ? animationTimeSeconds
      : previewScene.timeline.duration * animationProgress;
    smoothedPointerRef.current.lerp(targetPointerRef.current, 1 - Math.exp(-delta * 8));
    updateAnimationTimeline(previewScene.timeline, modelAnimationTime);
    const sampledCameraTime = updateCameraAnimationSample(
      previewScene.timeline,
      "primary",
      sourceCamera,
      modelAnimationTime,
    );
    const canvasAspect = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1);
    const fovOverride = viewportCameraMode.mode === "mobile"
      ? cameraSettings?.mobileFov
      : cameraSettings?.desktopFov;
    const cameraProjection = updateSourceCamera({
      aspect: canvasAspect,
      camera,
      fovOverride,
      orbitEnabled,
      pointer: smoothedPointerRef.current,
      parallaxAmount: cameraParallaxAmount,
      sourceCamera,
    });
    const activeCameraKey = [
      viewportCameraMode.mode,
      sourceCamera?.name ?? "none",
      viewportCameraMode.width,
      viewportCameraMode.height,
      canvasAspect,
    ].join("|");
    window.THERMADYNAMICS_ACTIVE_CAMERA_APPLIED = {
      aspect: camera.aspect,
      canvasAspect,
      fov: camera.fov,
      fovOverride: cameraProjection?.fovOverride ?? null,
      hasCameraSampler: Boolean(previewScene.timeline.cameraSamplers.primary),
      mode: viewportCameraMode.mode,
      modelAnimationTime,
      position: camera.position.toArray(),
      projection: cameraProjection,
      quaternion: camera.quaternion.toArray(),
      sampledCameraTime,
      selectedCameraName: sourceCamera?.name ?? null,
      sourceAspect: sourceCamera?.aspect ?? null,
      sourcePosition: sourceCamera?.position.toArray?.() ?? null,
      sourceQuaternion: sourceCamera?.quaternion.toArray?.() ?? null,
      viewport: viewportCameraMode,
    };

    if (activeCameraNameRef.current !== activeCameraKey) {
      activeCameraNameRef.current = activeCameraKey;
    }
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
          camera: window.THERMADYNAMICS_CAMERA_STATE,
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
