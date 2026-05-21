import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function Controls({ target, enabled }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef();
  const hasInitializedTargetRef = useRef(false);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.panSpeed = 0.85;
    controls.screenSpacePanning = true;
    controls.target.copy(target.current);
    controls.minDistance = 0.25;
    controls.maxDistance = 20;
    controls.enabled = enabled;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, enabled, gl, target]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = enabled;
    }
  }, [enabled]);

  useFrame(() => {
    if (!controlsRef.current) return;
    if (!hasInitializedTargetRef.current) {
      controlsRef.current.target.copy(target.current);
      hasInitializedTargetRef.current = true;
    }
    controlsRef.current.update();
  });

  return null;
}
