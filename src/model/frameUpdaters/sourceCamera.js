import * as THREE from "three";
import {
  DEFAULT_CAMERA_FAR,
  DEFAULT_CAMERA_NEAR,
} from "../../app/config.js";

export function updateSourceCamera({ camera, orbitEnabled, sourceCamera }) {
  if (orbitEnabled || !sourceCamera?.isPerspectiveCamera) return;

  sourceCamera.updateMatrixWorld(true);
  sourceCamera.matrixWorld.decompose(camera.position, camera.quaternion, new THREE.Vector3());
  camera.fov = sourceCamera.fov;
  camera.near = DEFAULT_CAMERA_NEAR;
  camera.far = DEFAULT_CAMERA_FAR;
  camera.updateProjectionMatrix();
}
