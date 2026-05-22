import { DEFAULT_CAMERA_PARALLAX_AMOUNT, MODEL_URL } from "../app/config.js";
import { createDefaultExperienceState, deepMerge } from "./experienceState.js";
import { createDefaultScrollSections } from "./scrollSections.js";

export const DEFAULT_TIMELINE_DURATION_SECONDS = 9;
export const DEFAULT_SCROLL_SECTION_COUNT = 9;

export function createDefaultTimelineConfig() {
  return {
    schemaVersion: 1,
    name: "therma-dynamics-webflow-v1",
    durationSeconds: DEFAULT_TIMELINE_DURATION_SECONDS,
    source: {
      modelUrl: MODEL_URL,
    },
    camera: {
      parallaxAmount: DEFAULT_CAMERA_PARALLAX_AMOUNT,
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
