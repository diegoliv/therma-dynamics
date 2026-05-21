export const MODEL_URL = "/models/therma_dynamics_v2.glb";

export const THERMAL_PRESETS = {
  industrialRainbow: {
    state: 0.84,
    gradientSoftness: 0.24,
    radius: 1,
    contrast: 1.52,
    noise: 0.095,
    hotEdge: 0.48,
    heatColors: ["#00105c", "#00d8ff", "#a7ff00", "#ff1600"],
    coldColors: ["#000000", "#00084c", "#0026b8", "#00a8ff"],
  },
  datacenterMagma: {
    state: 0.9,
    gradientSoftness: 0.32,
    radius: 1.08,
    contrast: 1.34,
    noise: 0.06,
    hotEdge: 0.28,
    heatColors: ["#12006f", "#c000ff", "#ff2464", "#fff233"],
    coldColors: ["#020016", "#11006e", "#2d17d9", "#ff00b8"],
  },
};

export const DEFAULT_THERMAL_PRESET = THERMAL_PRESETS.industrialRainbow;
export const DEFAULT_GRADIENT_SOFTNESS = DEFAULT_THERMAL_PRESET.gradientSoftness;
export const DEFAULT_THERMAL_RADIUS = DEFAULT_THERMAL_PRESET.radius;
export const DEFAULT_THERMAL_CONTRAST = DEFAULT_THERMAL_PRESET.contrast;
export const DEFAULT_THERMAL_NOISE = DEFAULT_THERMAL_PRESET.noise;
export const DEFAULT_THERMAL_HOT_EDGE = DEFAULT_THERMAL_PRESET.hotEdge;
export const DEFAULT_THERMAL_RADIANCE = 0.16;
export const DEFAULT_HEAT_GRADIENT = DEFAULT_THERMAL_PRESET.heatColors;
export const DEFAULT_COLD_GRADIENT = DEFAULT_THERMAL_PRESET.coldColors;
export const DEFAULT_COOLING_COLOR = "#65d7ff";
export const DEFAULT_COOLING_VISIBILITY = 1;
export const DEFAULT_COOLING_ROUGHNESS = 0.16;
export const DEFAULT_GLASS_COLOR = "#c8f8ff";
export const DEFAULT_GLASS_OPACITY = 0.06;
export const DEFAULT_GLOBAL_MASK_SOFTNESS = 0.14;
export const DEFAULT_HEAT_FALLOFF = 1.25;
export const DEFAULT_FLOOR_DOT_SIZE = 0.025;
export const DEFAULT_FLOOR_DOT_SPACING = 0.22;
export const DEFAULT_FLOOR_DOT_OPACITY = 0.35;
export const DEFAULT_BACKGROUND_COLOR = "#080b0f";
export const DEFAULT_DOF_SETTINGS = {
  enabled: false,
  focus: 40,
  aperture: 0.018,
  maxblur: 0.012,
};
export const USE_COOLING_SHADER_FOR_THERMAL_TEST = false;
export const DEFAULT_CAMERA_NEAR = 0.01;
export const DEFAULT_CAMERA_FAR = 2000;
export const DEFAULT_GLOBAL_LIGHT_SETTINGS = {
  ambientColor: "#ffffff",
  ambientIntensity: 1.2,
  hemisphereSkyColor: "#d8f7ff",
  hemisphereGroundColor: "#111827",
  hemisphereIntensity: 1.6,
};
export const SHOW_INSPECTOR_PANEL = false;
