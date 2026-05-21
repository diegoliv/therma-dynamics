import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { SHOW_INSPECTOR_PANEL } from "./app/config.js";
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

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const TIMELINE_ENDPOINT_EPSILON = 0.0005;

function keyframeIdForTimelineTime(config, timelineTime) {
  const durationSeconds = Math.max(config.durationSeconds ?? 1, 0.0001);
  if (Math.abs(timelineTime) <= TIMELINE_ENDPOINT_EPSILON) return "start";
  if (Math.abs(timelineTime - durationSeconds) <= TIMELINE_ENDPOINT_EPSILON) return "end";

  const existingKeyframe = config.keyframes.find(
    (keyframe) => Math.abs(keyframe.time - timelineTime) <= TIMELINE_ENDPOINT_EPSILON,
  );
  return existingKeyframe?.id ?? `state-${timelineTime.toFixed(3).replace(".", "-")}`;
}

function keyframeTimeForId(config, keyframeId, timelineTime) {
  if (keyframeId === "start") return 0;
  if (keyframeId === "end") return config.durationSeconds;
  return Number(timelineTime.toFixed(3));
}

function sortKeyframes(keyframes) {
  return [...keyframes].sort((a, b) => a.time - b.time);
}

function syncEndToLastTimelineState(config) {
  const durationSeconds = Math.max(config.durationSeconds ?? 1, 0.0001);
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

function App() {
  const [stats, setStats] = useState(null);
  const [orbitEnabled, setOrbitEnabled] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [timelineConfig, setTimelineConfig] = useState(createDefaultTimelineConfig);
  const [timelineTime, setTimelineTime] = useState(0);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState("start");
  const [scrollSimulationEnabled, setScrollSimulationEnabled] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [dofSettings, setDofSettings] = useState(DEFAULT_DOF_SETTINGS);
  const [thermalSettings, setThermalSettings] = useState(createDefaultThermalSettings);
  const [coolingSettings, setCoolingSettings] = useState(createDefaultCoolingSettings);
  const [glassSettings, setGlassSettings] = useState(createDefaultGlassSettings);
  const [floorSettings, setFloorSettings] = useState(createDefaultFloorSettings);
  const [globalOpacitySettings, setGlobalOpacitySettings] = useState(createDefaultGlobalOpacitySettings);
  const durationSeconds = timelineConfig.durationSeconds;
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

  useEffect(() => {
    applyExperienceState(resolveTimelineState(timelineConfig, timelineTime));
  }, [applyExperienceState, timelineConfig, timelineTime]);

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
        ScrollTrigger.create({
          trigger: ".authoring-scroll-sim",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => setTimelineTime(self.progress * durationSeconds),
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
    const state = cloneValue(currentExperienceState);
    const selectedId = keyframeIdForTimelineTime(timelineConfig, timelineTime);

    setTimelineConfig((config) => {
      const keyframeId = keyframeIdForTimelineTime(config, timelineTime);
      const nextConfig = upsertTimelineKeyframe(config, {
        id: keyframeId,
        time: keyframeTimeForId(config, keyframeId, timelineTime),
        easeToNext: "power1.inOut",
        state,
      });

      return keyframeId === "end" ? nextConfig : syncEndToLastTimelineState(nextConfig);
    });
    setSelectedKeyframeId(selectedId);
  }, [currentExperienceState, timelineConfig, timelineTime]);

  const updateTimelineState = useCallback(() => {
    if (!selectedKeyframeId) return;
    const state = cloneValue(currentExperienceState);
    const idAtCurrentTime = keyframeIdForTimelineTime(timelineConfig, timelineTime);
    const id = idAtCurrentTime === "start" || idAtCurrentTime === "end"
      ? idAtCurrentTime
      : selectedKeyframeId;
    setTimelineConfig((config) => {
      const nextConfig = upsertTimelineKeyframe(config, {
        id,
        time: keyframeTimeForId(config, id, timelineTime),
        easeToNext: "power1.inOut",
        state,
      });

      return id === "end" ? nextConfig : syncEndToLastTimelineState(nextConfig);
    });
    setSelectedKeyframeId(id);
  }, [currentExperienceState, selectedKeyframeId, timelineConfig, timelineTime]);

  const deleteTimelineState = useCallback(() => {
    if (!selectedKeyframeId || selectedKeyframeId === "start" || selectedKeyframeId === "end") return;
    setTimelineConfig((config) => {
      const keyframes = config.keyframes.filter((keyframe) => keyframe.id !== selectedKeyframeId);
      setSelectedKeyframeId(keyframes[0]?.id ?? null);
      return syncEndToLastTimelineState({ ...config, keyframes });
    });
  }, [selectedKeyframeId, timelineConfig.keyframes]);

  const exportTimelineConfig = useCallback(() => {
    downloadJson("therma-dynamics-timeline.json", timelineConfig);
    window.THERMADYNAMICS_TIMELINE_STATE = timelineConfig;
  }, [timelineConfig]);

  const importTimelineConfig = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const importedConfig = normalizeTimelineConfig(JSON.parse(await file.text()));
      setTimelineConfig(importedConfig);
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
          animationProgress={animationProgress}
          onStats={setStats}
        />
      </section>
      {scrollSimulationEnabled && (
        <div className="authoring-scroll-sim" aria-hidden="true">
          {Array.from({ length: timelineConfig.scroll.sectionCount }, (_, index) => (
            <section className="authoring-scroll-section" key={index} />
          ))}
        </div>
      )}
      <GuiControls
        orbitEnabled={orbitEnabled}
        setOrbitEnabled={setOrbitEnabled}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        dofSettings={dofSettings}
        setDofSettings={setDofSettings}
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
        timelineConfig={timelineConfig}
        selectedKeyframeId={selectedKeyframeId}
        setSelectedKeyframeId={setSelectedKeyframeId}
        scrollSimulationEnabled={scrollSimulationEnabled}
        setScrollSimulationEnabled={setScrollSimulationEnabled}
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
