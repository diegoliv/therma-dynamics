import * as THREE from "three";

const scratchMatrix = new THREE.Matrix4();

function isInstancingCandidate(node) {
  if ((!node.isMesh && !node.isInstancedMesh) || !node.geometry || Array.isArray(node.material)) return false;
  if (node.morphTargetInfluences?.length || node.skeleton) return false;

  const material = node.material;
  if (material.userData.collectionNames?.includes("thermal")) return true;
  if (material.userData.isCoolingPreview) return true;
  if (material.userData.isGlassPreview) return true;

  return material.userData.collectionNames?.length === 1
    && material.userData.collectionNames[0] === "opacity"
    && !material.userData.isThermalOpacityTest
    && !material.userData.isHeatDriver;
}

function instanceCountForNode(node) {
  return node.isInstancedMesh ? node.count : 1;
}

function instancingKeyForNode(node) {
  const material = node.material;
  const kind = material.userData.collectionNames?.includes("thermal")
    ? "thermal"
    : material.userData.isCoolingPreview
    ? "cooling"
    : material.userData.isGlassPreview
      ? "glass"
      : "opacity";

  return [
    kind,
    node.geometry.uuid,
    material.name,
    material.userData.opacityBucket ?? "none",
  ].join("|");
}

function removeMaterialFromCollections(collections, material) {
  material.userData.collectionNames?.forEach((collectionName) => {
    const collection = collections[collectionName];
    if (!collection) return;
    collections[collectionName] = collection.filter((entry) => entry !== material);
  });
}

function addMaterialToCollections(collections, material) {
  material.userData.collectionNames?.forEach((collectionName) => {
    collections[collectionName]?.push(material);
  });
}

export function optimizeRepeatedMeshes(scene, collections) {
  const groups = new Map();

  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!isInstancingCandidate(node)) return;

    const key = instancingKeyForNode(node);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  });

  const stats = {
    groups: 0,
    sourceMeshes: 0,
    instances: 0,
    savedMeshes: 0,
  };

  groups.forEach((nodes) => {
    if (nodes.length < 2) return;

    const sourceNode = nodes[0];
    const instanceCount = nodes.reduce((sum, node) => sum + instanceCountForNode(node), 0);
    const instancedGeometry = sourceNode.geometry.clone();
    const instancedMesh = new THREE.InstancedMesh(
      instancedGeometry,
      sourceNode.material,
      instanceCount,
    );
    instancedMesh.name = `${sourceNode.name || sourceNode.geometry.name || "mesh"}_instanced_${instanceCount}`;
    instancedMesh.castShadow = sourceNode.castShadow;
    instancedMesh.receiveShadow = sourceNode.receiveShadow;
    instancedMesh.frustumCulled = sourceNode.frustumCulled;
    instancedMesh.renderOrder = sourceNode.renderOrder;
    instancedMesh.matrixAutoUpdate = false;
    instancedMesh.userData.instancedFromRepeatedMeshes = true;
    instancedMesh.material.userData.renderNode = instancedMesh;

    let instanceIndex = 0;
    nodes.forEach((node) => {
      node.updateMatrixWorld(true);
      if (node.isInstancedMesh) {
        for (let index = 0; index < node.count; index += 1) {
          node.getMatrixAt(index, scratchMatrix);
          scratchMatrix.premultiply(node.matrixWorld);
          instancedMesh.setMatrixAt(instanceIndex, scratchMatrix);
          instanceIndex += 1;
        }
      } else {
        scratchMatrix.copy(node.matrixWorld);
        instancedMesh.setMatrixAt(instanceIndex, scratchMatrix);
        instanceIndex += 1;
      }
      node.visible = false;
      removeMaterialFromCollections(collections, node.material);
    });
    instancedMesh.instanceMatrix.needsUpdate = true;

    scene.add(instancedMesh);
    addMaterialToCollections(collections, instancedMesh.material);

    stats.groups += 1;
    stats.sourceMeshes += nodes.length;
    stats.instances += instanceCount;
    stats.savedMeshes += nodes.length - 1;
  });

  return stats;
}
