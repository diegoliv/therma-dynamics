import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  DEFAULT_CAMERA_FAR,
  DEFAULT_CAMERA_NEAR,
  MODEL_URL,
  USE_COOLING_SHADER_FOR_THERMAL_TEST,
} from "../app/config.js";
import {
  getOpacityBucket,
  getRackInfluenceNode,
  isCoolingMaterial,
  isCoolingObject,
  isFloorMaterial,
  isGlassMaterial,
  isHeatObject,
  isThermalMaterial,
  sourceByName,
} from "../model/classifyNode.js";
import { createHeatBounds, heatInfluenceForNode, updateHeatBounds } from "../model/heatInfluence.js";
import { collectSceneStats } from "../model/sceneStats.js";
import {
  cloneOpacityMaterial,
  createCoolingMaterial,
  createFloorMaterial,
  createGlassMaterial,
  createInvisibleHeatMaterial,
  createThermalMaterial,
  createThermalTestMaterial,
} from "../materials/previewMaterials.js";
import { fitCameraToObject } from "../utils/camera.js";
import { displayOpacityFromControl } from "../utils/colors.js";
import { Controls } from "./Controls.jsx";

export function Model({
  orbitEnabled,
  thermalSettings,
  coolingSettings,
  glassSettings,
  floorSettings,
  globalOpacitySettings,
  animationProgress,
  onStats,
}) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const groupRef = useRef();
  const boundsRef = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const thermalMaterialsRef = useRef([]);
  const coolingMaterialsRef = useRef([]);
  const glassMaterialsRef = useRef([]);
  const floorMaterialsRef = useRef([]);
  const opacityMaterialsRef = useRef([]);
  const heatObjectRef = useRef();
  const heatBoundsRef = useRef(createHeatBounds());
  const mixerRef = useRef();
  const actionsRef = useRef([]);
  const animationDurationRef = useRef(1);
  const sourceCameraRef = useRef();

  const { scene, stats } = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);
    const sceneStats = collectSceneStats(gltf);
    thermalMaterialsRef.current = [];
    coolingMaterialsRef.current = [];
    glassMaterialsRef.current = [];
    floorMaterialsRef.current = [];
    opacityMaterialsRef.current = [];
    heatObjectRef.current = null;
    sourceCameraRef.current = null;
    const clayMaterial = new THREE.MeshStandardMaterial({
      color: "#dde6ea",
      roughness: 0.52,
      metalness: 0.05,
    });
    const instanceHighlightMaterial = new THREE.MeshStandardMaterial({
      color: "#42f5d7",
      roughness: 0.34,
      metalness: 0.16,
      emissive: "#06362f",
      emissiveIntensity: 0.28,
    });
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: "#78f3ff",
      wireframe: true,
      transparent: true,
      opacity: 0.62,
    });

    clonedScene.traverse((node) => {
      if (node.isCamera && !sourceCameraRef.current) {
        sourceCameraRef.current = node;
      }

      if (!node.isMesh && !node.isInstancedMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;

      const originalMaterial = node.material;
      const opacityBucket = getOpacityBucket(node);
      let materialForPreview = originalMaterial;
      if (isHeatObject(node)) {
        const sourceMaterial = isThermalMaterial(originalMaterial)
          ? sourceByName(originalMaterial, "heat")
          : originalMaterial;
        materialForPreview = createInvisibleHeatMaterial(sourceMaterial);
        heatObjectRef.current = node;
        node.renderOrder = -1;
      } else if (isFloorMaterial(originalMaterial)) {
        const sourceMaterial = sourceByName(originalMaterial, "floor");
        materialForPreview = createFloorMaterial(sourceMaterial);
        materialForPreview.userData.opacityBucket = opacityBucket;
        node.renderOrder = 0;
        floorMaterialsRef.current.push(materialForPreview);
      } else if (isThermalMaterial(originalMaterial)) {
        const sourceMaterial = sourceByName(originalMaterial, "thermal");
        materialForPreview = USE_COOLING_SHADER_FOR_THERMAL_TEST
          ? createThermalTestMaterial(sourceMaterial)
          : createThermalMaterial(sourceMaterial, node.geometry);
        materialForPreview.userData.opacityBucket = opacityBucket;
        materialForPreview.userData.renderNode = node;
        materialForPreview.userData.heatInfluenceNode = getRackInfluenceNode(node);
        node.renderOrder = 1;
        if (USE_COOLING_SHADER_FOR_THERMAL_TEST) {
          opacityMaterialsRef.current.push(materialForPreview);
        } else {
          thermalMaterialsRef.current.push(materialForPreview);
          opacityMaterialsRef.current.push(materialForPreview);
        }
      } else if (isCoolingMaterial(originalMaterial) || isCoolingObject(node)) {
        const sourceMaterial = isCoolingMaterial(originalMaterial)
          ? sourceByName(originalMaterial, "cooling")
          : originalMaterial;
        materialForPreview = createCoolingMaterial(sourceMaterial);
        materialForPreview.userData.opacityBucket = opacityBucket;
        node.renderOrder = 2;
        coolingMaterialsRef.current.push(materialForPreview);
        opacityMaterialsRef.current.push(materialForPreview);
      } else if (isGlassMaterial(originalMaterial)) {
        const sourceMaterial = sourceByName(originalMaterial, "glass");
        materialForPreview = createGlassMaterial(sourceMaterial);
        materialForPreview.userData.opacityBucket = opacityBucket;
        node.renderOrder = 4;
        glassMaterialsRef.current.push(materialForPreview);
        opacityMaterialsRef.current.push(materialForPreview);
      } else {
        materialForPreview = cloneOpacityMaterial(originalMaterial, opacityBucket);
        if (materialForPreview) opacityMaterialsRef.current.push(materialForPreview);
      }

      node.material = materialForPreview;
      node.userData.originalMaterial = materialForPreview;
      node.userData.previewMaterials = {
        clay: node.isInstancedMesh ? instanceHighlightMaterial : clayMaterial,
        wire: wireMaterial,
      };
    });

    const mixer = new THREE.AnimationMixer(clonedScene);
    const duration = Math.max(...gltf.animations.map((clip) => clip.duration), 1);
    actionsRef.current = gltf.animations.map((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      return { action, duration: clip.duration };
    });
    mixer.update(0);
    mixerRef.current = mixer;
    animationDurationRef.current = duration;

    return { scene: clonedScene, stats: { ...sceneStats, animationDuration: duration } };
  }, [gltf]);

  useEffect(() => {
    onStats(stats);
  }, [onStats, stats]);

  useEffect(() => {
    if (!groupRef.current) return;
    if (sourceCameraRef.current) return;
    fitCameraToObject(camera, groupRef.current, boundsRef);
  }, [camera, scene]);

  useFrame((_, delta) => {
    const globalAnimationTime = animationProgress >= 1
      ? animationDurationRef.current - 0.0001
      : animationDurationRef.current * animationProgress;
    actionsRef.current.forEach(({ action, duration }) => {
      const actionTime = Math.min(globalAnimationTime, duration - 0.0001);
      action.enabled = true;
      action.paused = false;
      action.time = THREE.MathUtils.clamp(actionTime, 0, Math.max(duration - 0.0001, 0));
    });
    mixerRef.current?.update(0);

    if (!orbitEnabled && sourceCameraRef.current?.isPerspectiveCamera) {
      sourceCameraRef.current.updateMatrixWorld(true);
      sourceCameraRef.current.matrixWorld.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      camera.fov = sourceCameraRef.current.fov;
      camera.near = DEFAULT_CAMERA_NEAR;
      camera.far = DEFAULT_CAMERA_FAR;
      camera.updateProjectionMatrix();
    }

    const getOpacityMultiplier = (bucket) => {
      if (bucket === "outside") return globalOpacitySettings.outsideRack;
      if (bucket === "rack") return globalOpacitySettings.rackWithoutGpu;
      return 1;
    };

    const heatBounds = heatBoundsRef.current;
    updateHeatBounds(heatObjectRef.current, heatBounds);

    thermalMaterialsRef.current.forEach((material) => {
      const visibility = displayOpacityFromControl(getOpacityMultiplier(material.userData.opacityBucket));
      material.uniforms.uTime.value += delta;
      material.uniforms.uEdgeSoftness.value = thermalSettings.gradientSoftness;
      material.uniforms.uThermalRadius.value = thermalSettings.radius;
      material.uniforms.uThermalContrast.value = thermalSettings.contrast;
      material.uniforms.uThermalNoise.value = thermalSettings.noise;
      material.uniforms.uHotEdge.value = thermalSettings.hotEdge;
      material.uniforms.uThermalRadiance.value = thermalSettings.radiance;
      material.uniforms.uGlobalOpacity.value = visibility;
      material.uniforms.uGlobalMaskSoftness.value = globalOpacitySettings.maskSoftness;
      material.uniforms.uHeatFalloff.value = thermalSettings.heatFalloff;
      const influenceNode = material.userData.heatInfluenceNode ?? material.userData.renderNode;
      let rackHeatState = 0;
      rackHeatState = heatInfluenceForNode(
        influenceNode,
        heatObjectRef.current,
        heatBounds,
        thermalSettings.heatFalloff,
      );
      material.uniforms.uThermalState.value = rackHeatState;
      material.transparent = false;
      material.depthWrite = true;
      material.depthTest = true;
      material.needsUpdate = true;
      if (material.userData.renderNode) {
        material.userData.renderNode.renderOrder = 1;
      }
      material.uniforms.uHeatColors.value.forEach((color, index) => {
        color.set(thermalSettings.heatColors[index]);
      });
      material.uniforms.uColdColors.value.forEach((color, index) => {
        color.set(thermalSettings.coldColors[index]);
      });
      material.uniforms.uCameraPosition.value.copy(camera.position);
    });

    floorMaterialsRef.current.forEach((material) => {
      material.uniforms.uDotSize.value = floorSettings.dotSize;
      material.uniforms.uDotSpacing.value = floorSettings.dotSpacing;
      material.uniforms.uDotOpacity.value = floorSettings.dotOpacity;
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    });

    coolingMaterialsRef.current.forEach((material) => {
      const visibility = displayOpacityFromControl(getOpacityMultiplier(material.userData.opacityBucket));
      material.uniforms.uTime.value += delta;
      material.uniforms.uVisibility.value = coolingSettings.visibility;
      material.uniforms.uRoughness.value = coolingSettings.roughness;
      material.uniforms.uColor.value.set(coolingSettings.color);
      material.uniforms.uGlobalOpacity.value = visibility;
      material.uniforms.uGlobalMaskSoftness.value = globalOpacitySettings.maskSoftness;
      material.uniforms.uCameraPosition.value.copy(camera.position);
    });

    glassMaterialsRef.current.forEach((material) => {
      const bucketOpacity = getOpacityMultiplier(material.userData.opacityBucket);
      material.color.set(glassSettings.color);
      material.opacity = glassSettings.opacity * bucketOpacity;
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    });

    opacityMaterialsRef.current.forEach((material) => {
      if (material.isShaderMaterial) return;
      if (material.userData.isGlassPreview) return;
      if (material.userData.isCoolingPreview) return;
      const visibility = displayOpacityFromControl(getOpacityMultiplier(material.userData.opacityBucket));
      const baseOpacity = material.userData.baseOpacity ?? material.opacity ?? 1;
      material.opacity = baseOpacity;
      material.transparent = material.userData.baseTransparent;
      material.depthWrite = true;
      if (material.userData.globalVisibilityUniform) {
        material.userData.globalVisibilityUniform.value = visibility;
      }
      if (material.userData.globalMaskSoftnessUniform) {
        material.userData.globalMaskSoftnessUniform.value = globalOpacitySettings.maskSoftness;
      }
      if (material.userData.globalDissolveTimeUniform) {
        material.userData.globalDissolveTimeUniform.value += delta;
      }
      material.needsUpdate = true;
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
