import {
  DEFAULT_CAMERA_PARALLAX_AMOUNT,
  DEFAULT_DESKTOP_CAMERA_FOV,
  DEFAULT_MOBILE_CAMERA_FOV,
  DEFAULT_RENDER_MAX_DPR,
  DEFAULT_RENDER_MIN_DPR,
  MODEL_URL,
} from "../app/config.js";
import { createDefaultExperienceState, deepMerge } from "./experienceState.js";
import { createDefaultScrollSections } from "./scrollSections.js";
import { AUTO_TIMELINE_DURATION, FALLBACK_TIMELINE_DURATION_SECONDS } from "./timelineDuration.js";

export const DEFAULT_TIMELINE_DURATION_SECONDS = FALLBACK_TIMELINE_DURATION_SECONDS;
export const DEFAULT_SCROLL_SECTION_COUNT = 9;

export function createDefaultTimelineConfig() {
  return {
    schemaVersion: 1,
    name: "therma-dynamics-webflow-v1",
    durationSeconds: AUTO_TIMELINE_DURATION,
    source: {
      modelUrl: MODEL_URL,
    },
    camera: {
      desktopFov: DEFAULT_DESKTOP_CAMERA_FOV,
      mobileFov: DEFAULT_MOBILE_CAMERA_FOV,
      parallaxAmount: DEFAULT_CAMERA_PARALLAX_AMOUNT,
    },
    render: {
      minDpr: DEFAULT_RENDER_MIN_DPR,
      maxDpr: DEFAULT_RENDER_MAX_DPR,
    },
    scroll: {
      scrub: true,
      triggerSelector: ".therma-scroll-page",
      sectionSelector: ".therma-scroll-section",
      sections: createDefaultScrollSections(DEFAULT_TIMELINE_DURATION_SECONDS),
    },
    defaults: createDefaultExperienceState(),
    keyframes: [
      {
        id: "start",
        time: 0,
        easeToNext: "none",
        state: {},
      },
      {
        id: "end",
        time: DEFAULT_TIMELINE_DURATION_SECONDS,
        state: {},
      },
    ],
  };
}

export function normalizeTimelineConfig(config) {
  const defaults = createDefaultTimelineConfig();
  const merged = deepMerge(defaults, config ?? {});
  return {
    ...merged,
    keyframes: config?.keyframes ?? defaults.keyframes,
  };
}
