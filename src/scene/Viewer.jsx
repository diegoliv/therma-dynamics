import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { DEFAULT_GLOBAL_LIGHT_SETTINGS } from "../app/config.js";
import { BokehDepthOfField } from "./BokehDepthOfField.jsx";
import { EnvironmentSetup } from "./EnvironmentSetup.jsx";
import { Model } from "./Model.jsx";
import { RendererSettings } from "./RendererSettings.jsx";

export function Viewer({
  orbitEnabled,
  backgroundColor,
  dofSettings,
  thermalSettings,
  coolingSettings,
  glassSettings,
  floorSettings,
  globalOpacitySettings,
  animationProgress,
  onStats,
}) {
  return (
    <Canvas
      camera={{ position: [2, 1.2, 4], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      shadows
    >
      <RendererSettings />
      <color attach="background" args={[backgroundColor]} />
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
          thermalSettings={thermalSettings}
          coolingSettings={coolingSettings}
          glassSettings={glassSettings}
          floorSettings={floorSettings}
          globalOpacitySettings={globalOpacitySettings}
          animationProgress={animationProgress}
          onStats={onStats}
        />
      </Suspense>
      <BokehDepthOfField settings={dofSettings} />
    </Canvas>
  );
}
