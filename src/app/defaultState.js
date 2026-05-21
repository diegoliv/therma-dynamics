import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_COLD_GRADIENT,
  DEFAULT_COOLING_COLOR,
  DEFAULT_COOLING_ROUGHNESS,
  DEFAULT_COOLING_VISIBILITY,
  DEFAULT_DOF_SETTINGS,
  DEFAULT_FLOOR_DOT_OPACITY,
  DEFAULT_FLOOR_DOT_SIZE,
  DEFAULT_FLOOR_DOT_SPACING,
  DEFAULT_GLASS_COLOR,
  DEFAULT_GLASS_OPACITY,
  DEFAULT_GLOBAL_MASK_SOFTNESS,
  DEFAULT_GRADIENT_SOFTNESS,
  DEFAULT_HEAT_FALLOFF,
  DEFAULT_HEAT_GRADIENT,
  DEFAULT_THERMAL_CONTRAST,
  DEFAULT_THERMAL_HOT_EDGE,
  DEFAULT_THERMAL_NOISE,
  DEFAULT_THERMAL_RADIANCE,
  DEFAULT_THERMAL_RADIUS,
} from "./config.js";

export function createDefaultThermalSettings() {
  return {
    gradientSoftness: DEFAULT_GRADIENT_SOFTNESS,
    radius: DEFAULT_THERMAL_RADIUS,
    contrast: DEFAULT_THERMAL_CONTRAST,
    noise: DEFAULT_THERMAL_NOISE,
    hotEdge: DEFAULT_THERMAL_HOT_EDGE,
    radiance: DEFAULT_THERMAL_RADIANCE,
    heatFalloff: DEFAULT_HEAT_FALLOFF,
    heatColors: DEFAULT_HEAT_GRADIENT,
    coldColors: DEFAULT_COLD_GRADIENT,
  };
}

export function createDefaultCoolingSettings() {
  return {
    visibility: DEFAULT_COOLING_VISIBILITY,
    color: DEFAULT_COOLING_COLOR,
    roughness: DEFAULT_COOLING_ROUGHNESS,
  };
}

export function createDefaultGlassSettings() {
  return {
    opacity: DEFAULT_GLASS_OPACITY,
    color: DEFAULT_GLASS_COLOR,
  };
}

export function createDefaultFloorSettings() {
  return {
    dotSize: DEFAULT_FLOOR_DOT_SIZE,
    dotSpacing: DEFAULT_FLOOR_DOT_SPACING,
    dotOpacity: DEFAULT_FLOOR_DOT_OPACITY,
  };
}

export function createDefaultGlobalOpacitySettings() {
  return {
    outsideRack: 1,
    rackWithoutGpu: 1,
    maskSoftness: DEFAULT_GLOBAL_MASK_SOFTNESS,
  };
}

export { DEFAULT_BACKGROUND_COLOR, DEFAULT_DOF_SETTINGS };
