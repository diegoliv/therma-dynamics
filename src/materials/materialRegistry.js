import * as THREE from "three";
import { USE_COOLING_SHADER_FOR_THERMAL_TEST } from "../app/config.js";
import {
  getOpacityBucket,
  getRackInfluenceNode,
  isCoolingMaterial,
  isCoolingObject,
  isFloorMaterial,
  isGlassMaterial,
  isHeatObject,
  isScreenMaterial,
  isThermalMaterial,
  sourceByName,
} from "../model/classifyNode.js";
import {
  cloneOpacityMaterial,
  createCoolingMaterial,
  createFloorMaterial,
  createGlassMaterial,
  createInvisibleHeatMaterial,
  createThermalMaterial,
  createThermalTestMaterial,
} from "./previewMaterials.js";

export function createDebugPreviewMaterials() {
  return {
    clayMaterial: new THREE.MeshStandardMaterial({
      color: "#dde6ea",
      roughness: 0.52,
      metalness: 0.05,
    }),
    instanceHighlightMaterial: new THREE.MeshStandardMaterial({
      color: "#42f5d7",
      roughness: 0.34,
      metalness: 0.16,
      emissive: "#06362f",
      emissiveIntensity: 0.28,
    }),
    wireMaterial: new THREE.MeshBasicMaterial({
      color: "#78f3ff",
      wireframe: true,
      transparent: true,
      opacity: 0.62,
    }),
  };
}

function withCollectionNames(material, collections) {
  if (material) {
    material.userData.collectionNames = collections;
  }
  return material;
}

export function createPreviewMaterialForNode(node) {
  const originalMaterial = node.material;
  const opacityBucket = getOpacityBucket(node, originalMaterial);

  if (isHeatObject(node)) {
    const sourceMaterial = isThermalMaterial(originalMaterial)
      ? sourceByName(originalMaterial, "heat")
      : originalMaterial;
    return {
      material: withCollectionNames(createInvisibleHeatMaterial(sourceMaterial), []),
      heatObject: node,
      renderOrder: -1,
      collections: [],
    };
  }

  if (isFloorMaterial(originalMaterial)) {
    const material = createFloorMaterial(sourceByName(originalMaterial, "floor"));
    material.userData.opacityBucket = opacityBucket;
    material.userData.collectionNames = ["floor"];
    return {
      material,
      renderOrder: 0,
      collections: ["floor"],
    };
  }

  if (isThermalMaterial(originalMaterial)) {
    const sourceMaterial = sourceByName(originalMaterial, "thermal");
    const material = USE_COOLING_SHADER_FOR_THERMAL_TEST
      ? createThermalTestMaterial(sourceMaterial)
      : createThermalMaterial(sourceMaterial, node.geometry);
    material.userData.opacityBucket = opacityBucket;
    material.userData.renderNode = node;
    material.userData.heatInfluenceNode = getRackInfluenceNode(node);
    material.userData.collectionNames = USE_COOLING_SHADER_FOR_THERMAL_TEST ? ["opacity"] : ["thermal", "opacity"];
    return {
      material,
      renderOrder: 1,
      collections: USE_COOLING_SHADER_FOR_THERMAL_TEST ? ["opacity"] : ["thermal", "opacity"],
    };
  }

  if (isCoolingMaterial(originalMaterial) || isCoolingObject(node)) {
    const sourceMaterial = isCoolingMaterial(originalMaterial)
      ? sourceByName(originalMaterial, "cooling")
      : originalMaterial;
    const material = createCoolingMaterial(sourceMaterial);
    material.userData.opacityBucket = opacityBucket;
    material.userData.collectionNames = ["cooling", "opacity"];
    return {
      material,
      renderOrder: 2,
      collections: ["cooling", "opacity"],
    };
  }

  if (isGlassMaterial(originalMaterial)) {
    const material = createGlassMaterial(sourceByName(originalMaterial, "glass"));
    material.userData.opacityBucket = opacityBucket;
    material.userData.collectionNames = ["glass", "opacity"];
    return {
      material,
      renderOrder: 4,
      collections: ["glass", "opacity"],
    };
  }

  const material = cloneOpacityMaterial(originalMaterial, opacityBucket);
  if (material) {
    material.userData.useCoolingVisibilityMask = isScreenMaterial(originalMaterial);
    material.userData.collectionNames = ["opacity"];
  }
  return {
    material,
    renderOrder: node.renderOrder,
    collections: material ? ["opacity"] : [],
  };
}
