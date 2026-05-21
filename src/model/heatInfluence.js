import * as THREE from "three";

export function createHeatBounds() {
  return {
    box: new THREE.Box3(),
    center: new THREE.Vector3(),
    halfSize: new THREE.Vector3(0.0001, 0.0001, 0.0001),
    sampleBox: new THREE.Box3(),
    sampleCenter: new THREE.Vector3(),
    minHalfSize: new THREE.Vector3(0.0001, 0.0001, 0.0001),
  };
}

export function updateHeatBounds(heatObject, heatBounds) {
  if (!heatObject) return;
  heatObject.updateMatrixWorld(true);
  heatBounds.box.setFromObject(heatObject);
  if (heatBounds.box.isEmpty()) return;

  heatBounds.box.getCenter(heatBounds.center);
  heatBounds.box.getSize(heatBounds.halfSize).multiplyScalar(0.5);
  heatBounds.halfSize.max(heatBounds.minHalfSize);
}

export function heatInfluenceAtPoint(point, heatCenter, heatHalfSize, heatFalloff) {
  const qx = Math.abs(point.x - heatCenter.x) - heatHalfSize.x;
  const qy = Math.abs(point.y - heatCenter.y) - heatHalfSize.y;
  const qz = Math.abs(point.z - heatCenter.z) - heatHalfSize.z;
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideZ = Math.max(qz, 0);
  const outsideDistance = Math.sqrt(
    outsideX * outsideX + outsideY * outsideY + outsideZ * outsideZ,
  );
  const inside = Math.max(qx, qy, qz) <= 0;
  if (inside) return 1;

  const falloff = Math.max(heatFalloff, 0.0001);
  const t = THREE.MathUtils.clamp(outsideDistance / falloff, 0, 1);
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}

export function heatInfluenceForNode(node, heatObject, heatBounds, heatFalloff) {
  if (!node || !heatObject || heatBounds.box.isEmpty()) return 0;

  node.updateMatrixWorld(true);
  heatBounds.sampleBox.setFromObject(node);
  if (heatBounds.sampleBox.isEmpty()) return 0;

  heatBounds.sampleBox.getCenter(heatBounds.sampleCenter);
  return heatInfluenceAtPoint(
    heatBounds.sampleCenter,
    heatBounds.center,
    heatBounds.halfSize,
    heatFalloff,
  );
}
