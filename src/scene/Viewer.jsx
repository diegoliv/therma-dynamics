import { Suspense, useEffect, useRef, useState } from "react";
import { _roots, createRoot, extend } from "@react-three/fiber";
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
  animationTimeSeconds,
  cameraSettings,
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
          animationTimeSeconds={animationTimeSeconds}
          cameraSettings={cameraSettings}
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

function measureElement(element) {
  const rect = element.getBoundingClientRect();
  return {
    height: Math.max(1, Math.min(rect.height, window.innerHeight)),
    left: rect.left,
    top: rect.top,
    width: Math.max(1, Math.min(rect.width, window.innerWidth)),
  };
}

function waitForReleasedCanvas(canvas) {
  if (!_roots.get(canvas)) return Promise.resolve();

  return new Promise((resolve) => {
    const checkRelease = () => {
      if (!_roots.get(canvas)) {
        resolve();
        return;
      }
      window.setTimeout(checkRelease, 50);
    };

    checkRelease();
  });
}

export function Viewer({
  performanceOverlay = false,
  preserveDrawingBuffer = false,
  renderSettings,
  onPerformanceUpdate,
  onReady,
  ...props
}) {
  const canvasShellRef = useRef(null);
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [performanceStats, setPerformanceStats] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const canvasShell = canvasShellRef.current;
    if (!canvas || !canvasShell) return undefined;

    let root = null;
    let isDisposed = false;
    const configureSize = () => {
      if (isDisposed || !root) return;
      root.configure({ size: measureElement(canvasShell) });
    };
    const resizeObserver = new ResizeObserver(configureSize);

    async function setupRoot() {
      await waitForReleasedCanvas(canvas);
      if (isDisposed) return;

      root = createRoot(canvas);
      await root.configure({
        camera: { position: [2, 1.2, 4], fov: 38 },
        dpr: normalizeDprRange(renderSettings),
        gl: { antialias: true, alpha: true, preserveDrawingBuffer },
        size: measureElement(canvasShell),
        shadows: true,
      });

      if (isDisposed) return;
      rootRef.current = root;
      resizeObserver.observe(canvasShell);
      window.addEventListener("resize", configureSize);
      setIsConfigured(true);
    }

    setupRoot();

    return () => {
      isDisposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", configureSize);
      root?.unmount();
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
      <div ref={canvasShellRef} className="therma-canvas-shell">
        <canvas
          ref={canvasRef}
          className="therma-canvas"
        />
      </div>
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
