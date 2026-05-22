import * as THREE from "three";
import {
  DEFAULT_CAMERA_PARALLAX_AMOUNT,
  DEFAULT_CAMERA_PARALLAX_FOCUS_DISTANCE,
  DEFAULT_CAMERA_FAR,
  DEFAULT_CAMERA_NEAR,
} from "../../app/config.js";

const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const cameraUp = new THREE.Vector3();
const focalPoint = new THREE.Vector3();
const orbitOffset = new THREE.Vector3();
const pitchQuaternion = new THREE.Quaternion();
const sourceScale = new THREE.Vector3();
const yawQuaternion = new THREE.Quaternion();

export function updateSourceCamera({
  camera,
  orbitEnabled,
  pointer,
  parallaxAmount = DEFAULT_CAMERA_PARALLAX_AMOUNT,
  sourceCamera,
}) {
  if (orbitEnabled || !sourceCamera?.isPerspectiveCamera) return;

  sourceCamera.updateMatrixWorld(true);
  sourceCamera.matrixWorld.decompose(camera.position, camera.quaternion, sourceScale);

  if (parallaxAmount > 0) {
    camera.getWorldDirection(cameraForward);
    cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

    focalPoint
      .copy(camera.position)
      .addScaledVector(cameraForward, DEFAULT_CAMERA_PARALLAX_FOCUS_DISTANCE);
    orbitOffset.copy(camera.position).sub(focalPoint);

    yawQuaternion.setFromAxisAngle(cameraUp, -(pointer?.x ?? 0) * parallaxAmount);
    pitchQuaternion.setFromAxisAngle(cameraRight, (pointer?.y ?? 0) * parallaxAmount * 0.55);
    orbitOffset.applyQuaternion(yawQuaternion).applyQuaternion(pitchQuaternion);

    camera.position.copy(focalPoint).add(orbitOffset);
    camera.lookAt(focalPoint);
  }

  camera.fov = sourceCamera.fov;
  camera.near = DEFAULT_CAMERA_NEAR;
  camera.far = DEFAULT_CAMERA_FAR;
  camera.updateProjectionMatrix();
}
