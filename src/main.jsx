import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  DEFAULT_CAMERA_PARALLAX_AMOUNT,
  DEFAULT_DESKTOP_CAMERA_FOV,
  DEFAULT_MOBILE_CAMERA_FOV,
  SHOW_INSPECTOR_PANEL,
} from "./app/config.js";
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_DOF_SETTINGS,
  createDefaultCoolingSettings,
  createDefaultFloorSettings,
  createDefaultGlassSettings,
  createDefaultGlobalOpacitySettings,
  createDefaultThermalSettings,
} from "./app/defaultState.js";
import { GuiControls } from "./gui/GuiControls.jsx";
import { InspectorPanel } from "./inspector/InspectorPanel.jsx";
import { Viewer } from "./scene/Viewer.jsx";
import { createDefaultTimelineConfig, normalizeTimelineConfig } from "./timeline/defaultTimelineConfig.js";
import {
  cloneValue,
  createExperienceState,
  stateToProps,
} from "./timeline/experienceState.js";
import { resolveTimelineState } from "./timeline/interpolateExperienceState.js";
import {
  normalizeScrollSections,
  timelineTimeForSectionProgress,
} from "./timeline/scrollSections.js";
import { resolveTimelineDuration } from "./timeline/timelineDuration.js";

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

const TIMELINE_ENDPOINT_EPSILON = 0.0005;

function keyframeIdForTimelineTime(config, timelineTime) {
  const durationSeconds = Math.max(resolveTimelineDuration(config), 0.0001);
  if (Math.abs(timelineTime) <= TIMELINE_ENDPOINT_EPSILON) return "start";
  if (Math.abs(timelineTime - durationSeconds) <= TIMELINE_ENDPOINT_EPSILON) return "end";

  const existingKeyframe = config.keyframes.find(
    (keyframe) => Math.abs(keyframe.time - timelineTime) <= TIMELINE_ENDPOINT_EPSILON,
  );
  return existingKeyframe?.id ?? `state-${timelineTime.toFixed(3).replace(".", "-")}`;
}

function keyframeTimeForId(config, keyframeId, timelineTime) {
  if (keyframeId === "start") return 0;
  if (keyframeId === "end") return resolveTimelineDuration(config);
  return Number(timelineTime.toFixed(3));
}

function sortKeyframes(keyframes) {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

function syncEndToLastTimelineState(config) {
  const durationSeconds = Math.max(resolveTimelineDuration(config), 0.0001);
  const sortedKeyframes = sortKeyframes(config.keyframes);
  const lastAuthoredState = [...sortedKeyframes]
    .reverse()
    .find((keyframe) => keyframe.id !== "end" && keyframe.time < durationSeconds - TIMELINE_ENDPOINT_EPSILON);

  if (!lastAuthoredState) return { ...config, keyframes: sortedKeyframes };

  const endKeyframe = sortedKeyframes.find((keyframe) => keyframe.id === "end");
  const syncedEnd = {
    ...(endKeyframe ?? {}),
    id: "end",
    time: durationSeconds,
    state: cloneValue(lastAuthoredState.state),
  };

  return {
    ...config,
    keyframes: sortKeyframes([
      ...sortedKeyframes.filter((keyframe) => keyframe.id !== "end"),
      syncedEnd,
    ]),
  };
}

function upsertTimelineKeyframe(config, keyframe) {
  return {
    ...config,
    keyframes: sortKeyframes([
      ...config.keyframes.filter((existingKeyframe) => existingKeyframe.id !== keyframe.id),
      keyframe,
    ]),
  };
}

function removeDofEnabledFromState(state) {
  if (!state?.dof || state.dof.enabled === undefined) return state;
  const { enabled, ...dofWithoutEnabled } = state.dof;
  return {
    ...state,
    dof: dofWithoutEnabled,
  };
}

function App() {
  const initialTimelineConfig = useMemo(() => createDefaultTimelineConfig(), []);
  const [stats, setStats] = useState(null);
  const [orbitEnabled, setOrbitEnabled] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [timelineConfig, setTimelineConfig] = useState(initialTimelineConfig);
  const [timelineTime, setTimelineTime] = useState(0);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState("start");
  const [scrollSimulationEnabled, setScrollSimulationEnabled] = useState(false);
  const [performanceOverlayEnabled, setPerformanceOverlayEnabled] = useState(false);
  const [cameraParallaxAmount, setCameraParallaxAmount] = useState(
    initialTimelineConfig.camera?.parallaxAmount ?? DEFAULT_CAMERA_PARALLAX_AMOUNT,
  );
  const [desktopCameraFov, setDesktopCameraFov] = useState(
    initialTimelineConfig.camera?.desktopFov ?? DEFAULT_DESKTOP_CAMERA_FOV,
  );
  const [mobileCameraFov, setMobileCameraFov] = useState(
    initialTimelineConfig.camera?.mobileFov ?? DEFAULT_MOBILE_CAMERA_FOV,
  );
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [dofSettings, setDofSettings] = useState(DEFAULT_DOF_SETTINGS);
  const [thermalSettings, setThermalSettings] = useState(createDefaultThermalSettings);
  const [coolingSettings, setCoolingSettings] = useState(createDefaultCoolingSettings);
  const [glassSettings, setGlassSettings] = useState(createDefaultGlassSettings);
  const [floorSettings, setFloorSettings] = useState(createDefaultFloorSettings);
  const [globalOpacitySettings, setGlobalOpacitySettings] = useState(createDefaultGlobalOpacitySettings);
  const durationSeconds = resolveTimelineDuration(timelineConfig, stats?.animationDuration);
  const effectiveTimelineConfig = useMemo(
    () => ({ ...timelineConfig, durationSeconds }),
    [durationSeconds, timelineConfig],
  );
  const animationProgress = durationSeconds > 0 ? timelineTime / durationSeconds : 0;

  const currentExperienceState = useMemo(() => createExperienceState({
    backgroundColor,
    dofSettings,
    thermalSettings,
    coolingSettings,
    glassSettings,
    floorSettings,
    globalOpacitySettings,
  }), [
    backgroundColor,
    coolingSettings,
    dofSettings,
    floorSettings,
    glassSettings,
    globalOpacitySettings,
    thermalSettings,
  ]);
  const currentExperienceStateRef = useRef(currentExperienceState);

  useEffect(() => {
    currentExperienceStateRef.current = currentExperienceState;
  }, [currentExperienceState]);

  const applyExperienceState = useCallback((state) => {
    const props = stateToProps(state);
    setBackgroundColor(props.backgroundColor);
    setDofSettings(props.dofSettings);
    setThermalSettings(props.thermalSettings);
    setCoolingSettings(props.coolingSettings);
    setGlassSettings(props.glassSettings);
    setFloorSettings(props.floorSettings);
    setGlobalOpacitySettings(props.globalOpacitySettings);
  }, []);

  const updateDofSettings = useCallback((nextDofSettings) => {
    const nextDof = cloneValue(nextDofSettings);
    setDofSettings(nextDof);
    setTimelineConfig((config) => {
      if (Boolean(config.defaults?.dof?.enabled) === Boolean(nextDof.enabled)) return config;
      return {
        ...config,
        defaults: {
          ...(config.defaults ?? {}),
          dof: {
            ...(config.defaults?.dof ?? DEFAULT_DOF_SETTINGS),
            enabled: Boolean(nextDof.enabled),
          },
        },
      };
    });
  }, []);

  useEffect(() => {
    applyExperienceState(resolveTimelineState(effectiveTimelineConfig, timelineTime));
  }, [applyExperienceState, effectiveTimelineConfig, timelineTime]);

  useEffect(() => {
    window.__THERMA_TEST_SET_TIME = (time) => {
      setTimelineTime(Math.max(0, Math.min(Number(time) || 0, durationSeconds)));
    };
    return () => {
      delete window.__THERMA_TEST_SET_TIME;
    };
  }, [durationSeconds]);

  useEffect(() => {
    document.body.style.backgroundColor = backgroundColor;
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, [backgroundColor]);

  useEffect(() => {
    document.documentElement.classList.toggle("is-therma-scroll-sim", scrollSimulationEnabled);
    document.body.classList.toggle("is-therma-scroll-sim", scrollSimulationEnabled);
    return () => {
      document.documentElement.classList.remove("is-therma-scroll-sim");
      document.body.classList.remove("is-therma-scroll-sim");
    };
  }, [scrollSimulationEnabled]);

  useEffect(() => {
    if (!scrollSimulationEnabled) return undefined;

    let context;
    let isDisposed = false;

    async function setupScrollSimulation() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (isDisposed) return;

      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        const sections = normalizeScrollSections(timelineConfig.scroll.sections, durationSeconds);
        if (!sections.length) {
          ScrollTrigger.create({
            trigger: ".authoring-scroll-sim",
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => setTimelineTime(self.progress * durationSeconds),
          });
          return;
        }

        sections.forEach((section) => {
          const trigger = document.querySelector(`[data-therma-authoring-section="${section.id}"]`);
          if (!trigger) return;
          ScrollTrigger.create({
            trigger,
            start: section.start || "top top",
            end: section.end || "bottom top",
            scrub: true,
            onUpdate: (self) => setTimelineTime(timelineTimeForSectionProgress(section, self.progress)),
          });
        });
      });
      ScrollTrigger.refresh();
    }

    setupScrollSimulation();

    return () => {
      isDisposed = true;
      context?.revert();
    };
  }, [durationSeconds, scrollSimulationEnabled]);

  const captureTimelineState = useCallback(() => {
    const state = removeDofEnabledFromState(cloneValue(currentExperienceStateRef.current));
    const selectedId = keyframeIdForTimelineTime(effectiveTimelineConfig, timelineTime);

    setTimelineConfig((config) => {
      const scopedConfig = { ...config, durationSeconds };
      const keyframeId = keyframeIdForTimelineTime(scopedConfig, timelineTime);
      const nextConfig = upsertTimelineKeyframe(config, {
        id: keyframeId,
        time: keyframeTimeForId(scopedConfig, keyframeId, timelineTime),
        easeToNext: "power1.inOut",
        state,
      });

      return keyframeId === "end" ? nextConfig : syncEndToLastTimelineState({ ...nextConfig, durationSeconds });
    });
    setSelectedKeyframeId(selectedId);
  }, [durationSeconds, effectiveTimelineConfig, timelineTime]);

  const updateTimelineState = useCallback(() => {
    if (!selectedKeyframeId) return;
    const state = removeDofEnabledFromState(cloneValue(currentExperienceStateRef.current));
    const idAtCurrentTime = keyframeIdForTimelineTime(effectiveTimelineConfig, timelineTime);
    const id = idAtCurrentTime === "start" || idAtCurrentTime === "end"
      ? idAtCurrentTime
      : selectedKeyframeId;
    setTimelineConfig((config) => {
      const scopedConfig = { ...config, durationSeconds };
      const nextConfig = upsertTimelineKeyframe(config, {
        id,
        time: keyframeTimeForId(scopedConfig, id, timelineTime),
        easeToNext: "power1.inOut",
        state,
      });

      return id === "end" ? nextConfig : syncEndToLastTimelineState({ ...nextConfig, durationSeconds });
    });
    setSelectedKeyframeId(id);
  }, [durationSeconds, effectiveTimelineConfig, selectedKeyframeId, timelineTime]);

  const deleteTimelineState = useCallback(() => {
    if (!selectedKeyframeId || selectedKeyframeId === "start" || selectedKeyframeId === "end") return;
    setTimelineConfig((config) => {
      const keyframes = config.keyframes.filter((keyframe) => keyframe.id !== selectedKeyframeId);
      setSelectedKeyframeId(keyframes[0]?.id ?? null);
      return syncEndToLastTimelineState({ ...config, keyframes });
    });
  }, [selectedKeyframeId, timelineConfig.keyframes]);

  const exportTimelineConfig = useCallback(() => {
    const exportedConfig = {
      ...timelineConfig,
      camera: {
        ...(timelineConfig.camera ?? {}),
        desktopFov: desktopCameraFov,
        mobileFov: mobileCameraFov,
        parallaxAmount: cameraParallaxAmount,
      },
    };
    downloadJson("therma-dynamics-timeline.json", exportedConfig);
    window.THERMADYNAMICS_TIMELINE_STATE = exportedConfig;
  }, [cameraParallaxAmount, desktopCameraFov, mobileCameraFov, timelineConfig]);

  const importTimelineConfig = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const importedConfig = normalizeTimelineConfig(JSON.parse(await file.text()));
      setTimelineConfig(importedConfig);
      setCameraParallaxAmount(importedConfig.camera?.parallaxAmount ?? DEFAULT_CAMERA_PARALLAX_AMOUNT);
      setDesktopCameraFov(importedConfig.camera?.desktopFov ?? DEFAULT_DESKTOP_CAMERA_FOV);
      setMobileCameraFov(importedConfig.camera?.mobileFov ?? DEFAULT_MOBILE_CAMERA_FOV);
      setTimelineTime(0);
      setSelectedKeyframeId(importedConfig.keyframes?.[0]?.id ?? null);
    }, { once: true });
    input.click();
  }, []);

  return (
    <main className={`preview-app${scrollSimulationEnabled ? " is-scroll-sim" : ""}`}>
      <section className="stage">
        <Viewer
          orbitEnabled={orbitEnabled}
          backgroundColor={backgroundColor}
          dofSettings={dofSettings}
          thermalSettings={thermalSettings}
          coolingSettings={coolingSettings}
          glassSettings={glassSettings}
          floorSettings={floorSettings}
          globalOpacitySettings={globalOpacitySettings}
          cameraSettings={{
            ...(timelineConfig.camera ?? {}),
            desktopFov: desktopCameraFov,
            mobileFov: mobileCameraFov,
          }}
          cameraParallaxAmount={cameraParallaxAmount}
          animationProgress={animationProgress}
          animationTimeSeconds={timelineTime}
          performanceOverlay={performanceOverlayEnabled}
          preserveDrawingBuffer
          renderSettings={timelineConfig.render}
          onStats={setStats}
        />
      </section>
      {scrollSimulationEnabled && (
        <div className="authoring-scroll-sim" aria-hidden="true">
          {normalizeScrollSections(timelineConfig.scroll.sections, durationSeconds).map((section) => (
            <section
              className="authoring-scroll-section"
              data-therma-authoring-section={section.id}
              key={section.id}
              style={{ height: `${section.heightVh}vh` }}
            />
          ))}
        </div>
      )}
      <GuiControls
        orbitEnabled={orbitEnabled}
        setOrbitEnabled={setOrbitEnabled}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        dofSettings={dofSettings}
        setDofSettings={updateDofSettings}
        thermalSettings={thermalSettings}
        setThermalSettings={setThermalSettings}
        coolingSettings={coolingSettings}
        setCoolingSettings={setCoolingSettings}
        glassSettings={glassSettings}
        setGlassSettings={setGlassSettings}
        floorSettings={floorSettings}
        setFloorSettings={setFloorSettings}
        globalOpacitySettings={globalOpacitySettings}
        setGlobalOpacitySettings={setGlobalOpacitySettings}
        timelineTime={timelineTime}
        setTimelineTime={setTimelineTime}
        timelineConfig={effectiveTimelineConfig}
        selectedKeyframeId={selectedKeyframeId}
        setSelectedKeyframeId={setSelectedKeyframeId}
        scrollSimulationEnabled={scrollSimulationEnabled}
        setScrollSimulationEnabled={setScrollSimulationEnabled}
        performanceOverlayEnabled={performanceOverlayEnabled}
        setPerformanceOverlayEnabled={setPerformanceOverlayEnabled}
        cameraParallaxAmount={cameraParallaxAmount}
        setCameraParallaxAmount={setCameraParallaxAmount}
        desktopCameraFov={desktopCameraFov}
        setDesktopCameraFov={setDesktopCameraFov}
        mobileCameraFov={mobileCameraFov}
        setMobileCameraFov={setMobileCameraFov}
        captureTimelineState={captureTimelineState}
        updateTimelineState={updateTimelineState}
        deleteTimelineState={deleteTimelineState}
        exportTimelineConfig={exportTimelineConfig}
        importTimelineConfig={importTimelineConfig}
      />
      {SHOW_INSPECTOR_PANEL && (
        <InspectorPanel
          stats={stats}
          isCollapsed={isInspectorCollapsed}
          setIsCollapsed={setIsInspectorCollapsed}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
