import * as THREE from "three";

export function fitCameraToObject(camera, object, targetRef) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.abs(maxSize / Math.sin(fov / 2)) * 0.62;

  camera.position.set(center.x + distance * 0.45, center.y + distance * 0.24, center.z + distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  targetRef.current.copy(center);
}
