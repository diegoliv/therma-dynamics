import * as THREE from "three";
import { cloneValue, deepMerge } from "./experienceState.js";
import { resolveTimelineDuration } from "./timelineDuration.js";

const colorA = new THREE.Color();
const colorB = new THREE.Color();
const colorOut = new THREE.Color();
const KEYFRAME_TIME_EPSILON = 0.0005;

export function interpolateExperienceState(fromState, toState, amount) {
  return interpolateValue(fromState, toState, THREE.MathUtils.clamp(amount, 0, 1));
}

function interpolateValue(fromValue, toValue, amount) {
  if (typeof fromValue === "number" && typeof toValue === "number") {
    return THREE.MathUtils.lerp(fromValue, toValue, amount);
  }

  if (isColor(fromValue) && isColor(toValue)) {
    colorA.set(fromValue);
    colorB.set(toValue);
    colorOut.copy(colorA).lerp(colorB, amount);
    return `#${colorOut.getHexString()}`;
  }

  if (Array.isArray(fromValue) && Array.isArray(toValue)) {
    return fromValue.map((item, index) => interpolateValue(item, toValue[index] ?? item, amount));
  }

  if (fromValue && toValue && typeof fromValue === "object" && typeof toValue === "object") {
    const keys = new Set([...Object.keys(fromValue), ...Object.keys(toValue)]);
    const output = {};
    keys.forEach((key) => {
      output[key] = interpolateValue(fromValue[key], toValue[key], amount);
    });
    return output;
  }

  return amount < 0.5 ? cloneValue(fromValue) : cloneValue(toValue);
}

export function resolveTimelineState(config, timelineTime) {
  const durationSeconds = Math.max(resolveTimelineDuration(config), 0.0001);
  const clampedTime = THREE.MathUtils.clamp(timelineTime, 0, durationSeconds);
  const keyframes = normalizeKeyframes(config.keyframes, durationSeconds);

  if (!keyframes.length) return cloneValue(config.defaults);

  const exactKeyframe = findExactKeyframe(keyframes, clampedTime);
  if (exactKeyframe) return resolveKeyframeState(config.defaults, exactKeyframe);

  let previousIndex = 0;
  let nextIndex = keyframes.length - 1;
  for (let index = 0; index < keyframes.length; index += 1) {
    if (keyframes[index].time <= clampedTime) previousIndex = index;
    if (keyframes[index].time >= clampedTime) {
      nextIndex = index;
      break;
    }
  }

  const previousState = resolveKeyframeState(config.defaults, keyframes[previousIndex]);
  const nextState = resolveKeyframeState(config.defaults, keyframes[nextIndex]);
  const previousTime = keyframes[previousIndex].time;
  const nextTime = keyframes[nextIndex].time;

  if (previousIndex === nextIndex || nextTime <= previousTime) return previousState;

  const rawAmount = (clampedTime - previousTime) / (nextTime - previousTime);
  return interpolateExperienceState(previousState, nextState, easeAmount(rawAmount, keyframes[previousIndex].easeToNext));
}

export function normalizeKeyframes(keyframes, durationSeconds) {
  return [...(keyframes ?? [])]
    .map((keyframe, index) => ({
      id: keyframe.id || `state-${index}`,
      time: THREE.MathUtils.clamp(Number(keyframe.time) || 0, 0, durationSeconds),
      easeToNext: keyframe.easeToNext || "none",
      state: keyframe.state ?? {},
    }))
    .sort((a, b) => a.time - b.time);
}

function findExactKeyframe(keyframes, timelineTime) {
  return [...keyframes]
    .reverse()
    .find((keyframe) => Math.abs(keyframe.time - timelineTime) <= KEYFRAME_TIME_EPSILON);
}

function resolveKeyframeState(defaults, keyframe) {
  return deepMerge(cloneValue(defaults), keyframe.state);
}

function easeAmount(amount, easeName) {
  if (easeName === "power1.in") return amount * amount;
  if (easeName === "power1.out") return 1 - ((1 - amount) * (1 - amount));
  if (easeName === "power1.inOut") {
    return amount < 0.5
      ? 2 * amount * amount
      : 1 - ((-2 * amount + 2) ** 2) / 2;
  }
  return amount;
}

function isColor(value) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}
