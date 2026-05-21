import { createMaterialCollections, registerMaterial } from "../materials/materialCollections.js";
import { createDebugPreviewMaterials, createPreviewMaterialForNode } from "../materials/materialRegistry.js";
import { createAnimationTimeline } from "./animationTimeline.js";
import { collectSceneStats } from "./sceneStats.js";

export function preparePreviewScene(gltf) {
  const scene = gltf.scene.clone(true);
  const sceneStats = collectSceneStats(gltf);
  const materials = createMaterialCollections();
  const previewMaterials = createDebugPreviewMaterials();
  let heatObject = null;
  let sourceCamera = null;

  scene.traverse((node) => {
    if (node.isCamera && !sourceCamera) {
      sourceCamera = node;
    }

    if (!node.isMesh && !node.isInstancedMesh) return;

    node.castShadow = true;
    node.receiveShadow = true;

    const previewMaterial = createPreviewMaterialForNode(node);
    if (previewMaterial.heatObject) {
      heatObject = previewMaterial.heatObject;
    }
    registerMaterial(materials, previewMaterial.material, previewMaterial.collections);

    node.material = previewMaterial.material;
    node.renderOrder = previewMaterial.renderOrder;
    node.userData.originalMaterial = previewMaterial.material;
    node.userData.previewMaterials = {
      clay: node.isInstancedMesh
        ? previewMaterials.instanceHighlightMaterial
        : previewMaterials.clayMaterial,
      wire: previewMaterials.wireMaterial,
    };
  });

  const timeline = createAnimationTimeline(scene, gltf.animations);

  return {
    heatObject,
    materials,
    scene,
    sourceCamera,
    stats: { ...sceneStats, animationDuration: timeline.duration },
    timeline,
  };
}
