import { Suspense, useEffect, useRef, useState } from "react";
import { createRoot, extend } from "@react-three/fiber";
import * as THREE from "three";
import { DEFAULT_GLOBAL_LIGHT_SETTINGS, MODEL_URL } from "../app/config.js";
import { BokehDepthOfField } from "./BokehDepthOfField.jsx";
import { EnvironmentSetup } from "./EnvironmentSetup.jsx";
import { Model } from "./Model.jsx";
import { RendererSettings } from "./RendererSettings.jsx";

extend(THREE);

function SceneContent({
  orbitEnabled,
  dofSettings,
  thermalSettings,
  coolingSettings,
  glassSettings,
  floorSettings,
  globalOpacitySettings,
  animationProgress,
  cameraParallaxAmount,
  modelUrl = MODEL_URL,
  onStats,
}) {
  return (
    <>
      <RendererSettings />
      <ambientLight
        color={DEFAULT_GLOBAL_LIGHT_SETTINGS.ambientColor}
        intensity={DEFAULT_GLOBAL_LIGHT_SETTINGS.ambientIntensity}
      />
      <hemisphereLight
        args={[
          DEFAULT_GLOBAL_LIGHT_SETTINGS.hemisphereSkyColor,
          DEFAULT_GLOBAL_LIGHT_SETTINGS.hemisphereGroundColor,
          DEFAULT_GLOBAL_LIGHT_SETTINGS.hemisphereIntensity,
        ]}
      />
      <EnvironmentSetup />
      <Suspense fallback={null}>
        <Model
          orbitEnabled={orbitEnabled}
          modelUrl={modelUrl}
          thermalSettings={thermalSettings}
          coolingSettings={coolingSettings}
          glassSettings={glassSettings}
          floorSettings={floorSettings}
          globalOpacitySettings={globalOpacitySettings}
          animationProgress={animationProgress}
          cameraParallaxAmount={cameraParallaxAmount}
          onStats={onStats}
        />
      </Suspense>
      <BokehDepthOfField settings={dofSettings} />
    </>
  );
}

export function Viewer(props) {
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let isDisposed = false;
    const root = createRoot(canvas);
    root
      .configure({
        camera: { position: [2, 1.2, 4], fov: 38 },
        dpr: [1, 2],
        gl: { antialias: true, alpha: true, preserveDrawingBuffer: true },
        shadows: true,
      })
      .then(() => {
        if (isDisposed) return;
        rootRef.current = root;
        setIsConfigured(true);
      });

    return () => {
      isDisposed = true;
      root.unmount();
      rootRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isConfigured || !rootRef.current) return;
    rootRef.current.render(<SceneContent {...props} />);
  }, [isConfigured, props]);

  return (
    <canvas
      ref={canvasRef}
      className="therma-canvas"
    />
  );
}
