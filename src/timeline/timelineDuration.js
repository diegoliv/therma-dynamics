export const AUTO_TIMELINE_DURATION = "auto";
export const FALLBACK_TIMELINE_DURATION_SECONDS = 10;

export function isAutoTimelineDuration(durationSeconds) {
  return durationSeconds === AUTO_TIMELINE_DURATION || durationSeconds == null;
}

export function resolveTimelineDuration(config, modelDurationSeconds) {
  const configuredDuration = Number(config?.durationSeconds);
  if (Number.isFinite(configuredDuration) && configuredDuration > 0) {
    return configuredDuration;
  }

  const modelDuration = Number(modelDurationSeconds);
  if (Number.isFinite(modelDuration) && modelDuration > 0) {
    return modelDuration;
  }

  return FALLBACK_TIMELINE_DURATION_SECONDS;
}
