import { Suspense, useEffect, useRef, useState } from "react";
import { createRoot, extend } from "@react-three/fiber";
import * as THREE from "three";
import { DEFAULT_GLOBAL_LIGHT_SETTINGS, MODEL_URL } from "../app/config.js";
import { BokehDepthOfField } from "./BokehDepthOfField.jsx";
import { EnvironmentSetup } from "./EnvironmentSetup.jsx";
import { Model } from "./Model.jsx";
import { PerformanceProbe } from "./PerformanceProbe.jsx";
import { RendererSettings } from "./RendererSettings.jsx";

extend(THREE);

const PERFORMANCE_OVERLAY_STYLE = {
  position: "fixed",
  right: "16px",
  bottom: "16px",
  zIndex: 5,
  display: "grid",
  gridTemplateColumns: "repeat(2, auto)",
  gap: "4px 10px",
  minWidth: "154px",
  padding: "10px 12px",
  border: "1px solid rgba(216, 232, 236, 0.16)",
  borderRadius: "6px",
  color: "rgba(236, 244, 247, 0.72)",
  background: "rgba(9, 13, 18, 0.78)",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSize: "11px",
  fontWeight: 720,
  lineHeight: 1.25,
  pointerEvents: "none",
  backdropFilter: "blur(14px)",
};

const PERFORMANCE_OVERLAY_TITLE_STYLE = {
  gridColumn: "1 / -1",
  color: "#8af8e5",
  fontSize: "17px",
  fontWeight: 820,
  letterSpacing: 0,
};

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
  performanceMonitoring,
  onPerformanceUpdate,
  onReady,
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
          onReady={onReady}
        />
      </Suspense>
      <BokehDepthOfField settings={dofSettings} />
      <PerformanceProbe
        enabled={performanceMonitoring}
        onUpdate={onPerformanceUpdate}
      />
    </>
  );
}

function normalizeDprRange(renderSettings) {
  const min = Math.max(0.5, renderSettings?.minDpr ?? 1);
  const max = Math.max(min, renderSettings?.maxDpr ?? 1.5);
  return [min, max];
}

export function Viewer({
  performanceOverlay = false,
  preserveDrawingBuffer = false,
  renderSettings,
  onPerformanceUpdate,
  onReady,
  ...props
}) {
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [performanceStats, setPerformanceStats] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let isDisposed = false;
    const root = createRoot(canvas);
    root
      .configure({
        camera: { position: [2, 1.2, 4], fov: 38 },
        dpr: normalizeDprRange(renderSettings),
        gl: { antialias: true, alpha: true, preserveDrawingBuffer },
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

  const handlePerformanceUpdate = (stats) => {
    setPerformanceStats(stats);
    onPerformanceUpdate?.(stats);
  };

  useEffect(() => {
    if (!isConfigured || !rootRef.current) return;
    rootRef.current.render(
      <SceneContent
        {...props}
        performanceMonitoring={performanceOverlay || Boolean(onPerformanceUpdate)}
        onPerformanceUpdate={handlePerformanceUpdate}
        onReady={onReady}
      />,
    );
  }, [isConfigured, props, performanceOverlay, onPerformanceUpdate, onReady]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="therma-canvas"
      />
      {performanceOverlay && performanceStats && (
        <div className="therma-performance-overlay" style={PERFORMANCE_OVERLAY_STYLE}>
          <strong style={PERFORMANCE_OVERLAY_TITLE_STYLE}>{performanceStats.fps.toFixed(0)} FPS</strong>
          <span>{performanceStats.frameMs.toFixed(1)} ms</span>
          <span>DPR {performanceStats.dpr.toFixed(2)}</span>
          <span>{performanceStats.drawCalls} calls</span>
          <span>{performanceStats.triangles.toLocaleString()} tris</span>
        </div>
      )}
    </>
  );
}
