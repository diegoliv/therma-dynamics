import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Viewer } from "./scene/Viewer.jsx";
import { createDefaultTimelineConfig, normalizeTimelineConfig } from "./timeline/defaultTimelineConfig.js";
import { stateToProps } from "./timeline/experienceState.js";
import { resolveTimelineState } from "./timeline/interpolateExperienceState.js";
import {
  clampTime,
  normalizeScrollSections,
  timelineTimeForSectionProgress,
} from "./timeline/scrollSections.js";

const EMBED_VERSION = "2026-05-22.1";

function EmbedApp({
  config,
  modelUrl,
  onPerformanceUpdate,
  onReady,
  performanceOverlay,
  renderSettings,
}) {
  const [timelineTime, setTimelineTime] = useState(0);
  const durationSeconds = Math.max(config.durationSeconds ?? 1, 0.0001);
  const animationProgress = timelineTime / durationSeconds;
  const state = useMemo(
    () => resolveTimelineState(config, timelineTime),
    [config, timelineTime],
  );
  const props = stateToProps(state);

  useEffect(() => {
    onReady?.({
      durationSeconds,
      setTime: (time) => setTimelineTime(Math.max(0, Math.min(time, durationSeconds))),
    });
  }, [durationSeconds, onReady]);

  return (
    <Viewer
      orbitEnabled={false}
      modelUrl={modelUrl}
      backgroundColor={props.backgroundColor}
      dofSettings={props.dofSettings}
      thermalSettings={props.thermalSettings}
      coolingSettings={props.coolingSettings}
      glassSettings={props.glassSettings}
      floorSettings={props.floorSettings}
      globalOpacitySettings={props.globalOpacitySettings}
      cameraParallaxAmount={config.camera?.parallaxAmount}
      animationProgress={animationProgress}
      performanceOverlay={performanceOverlay}
      renderSettings={renderSettings}
      onPerformanceUpdate={onPerformanceUpdate}
      onStats={() => {}}
    />
  );
}

async function loadTimelineConfig(options) {
  if (options.config) return normalizeTimelineConfig(options.config);
  if (options.configUrl) {
    const response = await fetch(options.configUrl);
    if (!response.ok) throw new Error(`Unable to load Therma Dynamics config: ${response.status}`);
    return normalizeTimelineConfig(await response.json());
  }
  return createDefaultTimelineConfig();
}

function resolveAssetUrl(url, publicPath) {
  if (!url || !publicPath || /^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  return new URL(url.replace(/^\//, ""), publicPath.endsWith("/") ? publicPath : `${publicPath}/`).toString();
}

function getSectionElements(scrollConfig, durationSeconds) {
  const sectionSelector = scrollConfig.sectionSelector || ".therma-scroll-section";
  const domSections = Array.from(document.querySelectorAll(sectionSelector));
  const configSections = normalizeScrollSections(scrollConfig.sections, durationSeconds);

  if (domSections.length) {
    return domSections.map((element, index) => {
      const configuredSection = configSections[index];
      const from = element.dataset.thermaFrom ?? configuredSection?.from ?? 0;
      const to = element.dataset.thermaTo ?? configuredSection?.to ?? durationSeconds;
      return {
        element,
        start: element.dataset.thermaStart ?? configuredSection?.start,
        end: element.dataset.thermaEnd ?? configuredSection?.end,
        from: clampTime(from, durationSeconds),
        to: clampTime(to, durationSeconds),
      };
    }).filter((section) => section.from !== section.to);
  }

  return configSections
    .map((section) => ({
      ...section,
      element: section.selector ? document.querySelector(section.selector) : null,
    }))
    .filter((section) => section.element && section.from !== section.to);
}

function setupScrollTrigger({ config, options, setTime, durationSeconds }) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger || gsap?.ScrollTrigger;
  if (!gsap || !ScrollTrigger) {
    console.warn("ThermaDynamics: GSAP and ScrollTrigger must be loaded before the embed script.");
    return null;
  }

  gsap.registerPlugin?.(ScrollTrigger);

  const scrollConfig = {
    ...(config.scroll ?? {}),
    ...(options.scrollTrigger ?? {}),
  };
  const sectionTriggers = getSectionElements(scrollConfig, durationSeconds);

  if (sectionTriggers.length) {
    const triggers = sectionTriggers.map((section) => ScrollTrigger.create({
      trigger: section.element,
      start: section.start || scrollConfig.sectionStart || scrollConfig.start || "top top",
      end: section.end || scrollConfig.sectionEnd || scrollConfig.end || "bottom top",
      scrub: scrollConfig.scrub ?? true,
      markers: scrollConfig.markers ?? false,
      invalidateOnRefresh: true,
      onUpdate: (self) => setTime(timelineTimeForSectionProgress(section, self.progress)),
    }));

    return {
      kill() {
        triggers.forEach((trigger) => trigger.kill());
      },
    };
  }

  const trigger = scrollConfig.trigger || scrollConfig.triggerSelector || ".therma-scroll-page";
  return ScrollTrigger.create({
    trigger,
    start: scrollConfig.start || "top top",
    end: scrollConfig.end || "bottom bottom",
    scrub: scrollConfig.scrub ?? true,
    markers: scrollConfig.markers ?? false,
    invalidateOnRefresh: true,
    onUpdate: (self) => setTime(self.progress * durationSeconds),
  });
}

export function mount(options = {}) {
  let container = typeof options.container === "string"
    ? document.querySelector(options.container)
    : options.container;

  if (!container) {
    throw new Error("ThermaDynamics.mount requires a valid container.");
  }

  if (container === document.body) {
    container = document.createElement("div");
    container.className = "therma-dynamics-root";
    document.body.appendChild(container);
  }

  const root = createRoot(container);
  let scrollTrigger = null;
  let setTime = null;
  let pendingTime = null;
  let isDestroyed = false;
  let latestPerformance = null;

  const instance = {
    setTime(time) {
      if (setTime) {
        setTime(time);
        return;
      }
      pendingTime = time;
    },
    getPerformance() {
      return latestPerformance;
    },
    destroy() {
      isDestroyed = true;
      scrollTrigger?.kill?.();
      root.unmount();
    },
  };

  loadTimelineConfig(options)
    .then((config) => {
      if (isDestroyed) return;
      const publicPath = options.publicPath ?? config.publicPath;
      const modelUrl = resolveAssetUrl(config.source?.modelUrl, publicPath);
      const performanceOverlay = Boolean(
        options.performanceOverlay
          ?? config.performance?.overlay
          ?? new URLSearchParams(window.location.search).has("thermaPerf"),
      );
      const renderSettings = {
        ...(config.render ?? {}),
        ...(options.render ?? {}),
      };
      root.render(
        <EmbedApp
          config={config}
          modelUrl={modelUrl}
          performanceOverlay={performanceOverlay}
          renderSettings={renderSettings}
          onPerformanceUpdate={(stats) => {
            latestPerformance = stats;
            options.onPerformanceUpdate?.(stats);
            window.dispatchEvent(new CustomEvent("therma-dynamics:performance", {
              detail: stats,
            }));
          }}
          onReady={({ durationSeconds, setTime: setTimelineTime }) => {
            setTime = setTimelineTime;
            if (pendingTime !== null) {
              setTime(pendingTime);
              pendingTime = null;
            }
            scrollTrigger = setupScrollTrigger({
              config,
              options,
              setTime,
              durationSeconds,
            });
          }}
        />,
      );
    })
    .catch((error) => {
      console.error(error);
    });

  return instance;
}

window.ThermaDynamics = {
  mount,
  version: EMBED_VERSION,
};
