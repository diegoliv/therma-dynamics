import * as THREE from "three";
import {
  DEFAULT_COLD_GRADIENT,
  DEFAULT_COOLING_COLOR,
  DEFAULT_COOLING_ROUGHNESS,
  DEFAULT_COOLING_VISIBILITY,
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
} from "../app/config.js";
import {
  coolingFragmentShader,
  coolingVertexShader,
  floorFragmentShader,
  floorVertexShader,
  thermalFragmentShader,
  thermalVertexShader,
} from "../shaders/previewShaders.js";
import { colorsFromHexList, getMaterialBaseColor } from "../utils/colors.js";

export function injectGlobalDissolve(material) {
  if (!material || material.userData.hasGlobalDissolve) return material;
  material.userData.hasGlobalDissolve = true;
  material.userData.globalVisibilityUniform = { value: 1 };
  material.userData.globalMaskSoftnessUniform = { value: DEFAULT_GLOBAL_MASK_SOFTNESS };
  material.userData.globalDissolveTimeUniform = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlobalVisibility = material.userData.globalVisibilityUniform;
    shader.uniforms.uGlobalMaskSoftness = material.userData.globalMaskSoftnessUniform;
    shader.uniforms.uGlobalDissolveTime = material.userData.globalDissolveTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        "varying vec3 vGlobalDissolveWorldPosition;\nvoid main() {",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\n  vGlobalDissolveWorldPosition = worldPosition.xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `
varying vec3 vGlobalDissolveWorldPosition;
uniform float uGlobalVisibility;
uniform float uGlobalMaskSoftness;
uniform float uGlobalDissolveTime;

float globalDissolveHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float globalDissolveNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = globalDissolveHash(i + vec3(0.0, 0.0, 0.0));
  float n100 = globalDissolveHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = globalDissolveHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = globalDissolveHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = globalDissolveHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = globalDissolveHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = globalDissolveHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = globalDissolveHash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float globalDissolveDither(vec3 p) {
  return globalDissolveHash(floor(p * 46.0));
}

void applyGlobalDissolveMask(float visibility, float noiseValue, float softness, vec3 ditherPosition) {
  if (visibility <= 0.001) discard;
  if (visibility >= 0.999) return;
  float edgeSoftness = max(softness, 0.001);
  float coverage = 1.0 - smoothstep(visibility - edgeSoftness, visibility + edgeSoftness, noiseValue);
  if (globalDissolveDither(ditherPosition) > coverage) discard;
}

void main() {`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `
if (uGlobalVisibility < 0.999) {
  float globalDissolve = globalDissolveNoise(vGlobalDissolveWorldPosition * 1.12 + vec3(0.3, uGlobalDissolveTime * 0.035, 1.7));
  applyGlobalDissolveMask(uGlobalVisibility, globalDissolve, uGlobalMaskSoftness, vGlobalDissolveWorldPosition);
}
#include <alphatest_fragment>`,
      );
  };
  material.transparent = false;
  material.depthWrite = true;
  material.needsUpdate = true;
  return material;
}

export function cloneOpacityMaterial(sourceMaterial, bucket) {
  const material = sourceMaterial?.clone ? sourceMaterial.clone() : sourceMaterial;
  if (!material) return material;
  material.userData.opacityBucket = bucket;
  material.userData.baseOpacity = material.opacity ?? 1;
  material.userData.baseTransparent = Boolean(material.transparent);
  return injectGlobalDissolve(material);
}

export function createGlassMaterial(sourceMaterial) {
  const baseColor = sourceMaterial?.color?.isColor ? sourceMaterial.color : new THREE.Color("#77d9ff");
  const material = new THREE.MeshBasicMaterial({
    name: `${sourceMaterial?.name || "glass"}_preview`,
    color: baseColor.lerp(new THREE.Color(DEFAULT_GLASS_COLOR), 0.65),
    transparent: false,
    opacity: DEFAULT_GLASS_OPACITY,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
  material.userData.isGlassPreview = true;
  return material;
}

export function createCoolingMaterial(sourceMaterial) {
  const color = sourceMaterial?.color?.isColor ? sourceMaterial.color.clone() : new THREE.Color(DEFAULT_COOLING_COLOR);
  const material = new THREE.ShaderMaterial({
    name: `${sourceMaterial?.name || "cooling"}_shader`,
    vertexShader: coolingVertexShader,
    fragmentShader: coolingFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uVisibility: { value: DEFAULT_COOLING_VISIBILITY },
      uRoughness: { value: DEFAULT_COOLING_ROUGHNESS },
      uGlobalOpacity: { value: 1 },
      uGlobalMaskSoftness: { value: DEFAULT_GLOBAL_MASK_SOFTNESS },
      uColor: { value: color },
      uCameraPosition: { value: new THREE.Vector3() },
    },
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
  material.userData.isCoolingPreview = true;
  material.userData.baseOpacity = 1;
  material.userData.baseTransparent = false;
  return material;
}

export function createFloorMaterial(sourceMaterial) {
  const material = new THREE.ShaderMaterial({
    name: `${sourceMaterial?.name || "floor"}_dot_shader`,
    vertexShader: floorVertexShader,
    fragmentShader: floorFragmentShader,
    uniforms: {
      uDotSize: { value: DEFAULT_FLOOR_DOT_SIZE },
      uDotSpacing: { value: DEFAULT_FLOOR_DOT_SPACING },
      uDotOpacity: { value: DEFAULT_FLOOR_DOT_OPACITY },
      uDotColor: { value: new THREE.Color("#ffffff") },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  material.userData.isFloorPreview = true;
  material.userData.baseOpacity = 1;
  material.userData.baseTransparent = true;
  return material;
}

export function createInvisibleHeatMaterial(sourceMaterial) {
  const material = new THREE.MeshBasicMaterial({
    name: `${sourceMaterial?.name || "heat"}_invisible_driver`,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    colorWrite: false,
  });
  material.userData.isHeatDriver = true;
  return material;
}

export function createThermalTestMaterial(sourceMaterial) {
  const sourceColor = sourceMaterial?.color?.isColor
    ? sourceMaterial.color.clone()
    : new THREE.Color(DEFAULT_COOLING_COLOR);
  const luminance = sourceColor.r * 0.2126 + sourceColor.g * 0.7152 + sourceColor.b * 0.0722;
  const color = luminance < 0.18
    ? sourceColor.lerp(new THREE.Color("#55bfe8"), 0.82)
    : sourceColor.lerp(new THREE.Color("#55bfe8"), 0.32);
  const material = new THREE.MeshStandardMaterial({
    name: `${sourceMaterial?.name || "thermal"}_solid_opacity_test`,
    color,
    roughness: 0.38,
    metalness: 0.02,
    envMapIntensity: 0.95,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });
  material.userData.isThermalOpacityTest = true;
  material.userData.baseOpacity = 1;
  material.userData.baseTransparent = false;
  return material;
}

export function createThermalMaterial(sourceMaterial, geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3(
    new THREE.Vector3(-0.5, -0.5, -0.5),
    new THREE.Vector3(0.5, 0.5, 0.5),
  );

  const material = new THREE.ShaderMaterial({
    name: `${sourceMaterial?.name || "thermal"}_shader`,
    vertexShader: thermalVertexShader,
    fragmentShader: thermalFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uThermalState: { value: 0 },
      uEdgeSoftness: { value: DEFAULT_GRADIENT_SOFTNESS },
      uThermalRadius: { value: DEFAULT_THERMAL_RADIUS },
      uCoreStrength: { value: 0.92 },
      uThermalContrast: { value: DEFAULT_THERMAL_CONTRAST },
      uThermalNoise: { value: DEFAULT_THERMAL_NOISE },
      uHotEdge: { value: DEFAULT_THERMAL_HOT_EDGE },
      uThermalRadiance: { value: DEFAULT_THERMAL_RADIANCE },
      uGlobalOpacity: { value: 1 },
      uGlobalMaskSoftness: { value: DEFAULT_GLOBAL_MASK_SOFTNESS },
      uHeatFalloff: { value: DEFAULT_HEAT_FALLOFF },
      uHeatCenter: { value: new THREE.Vector3() },
      uHeatHalfSize: { value: new THREE.Vector3(0.0001, 0.0001, 0.0001) },
      uBaseColor: { value: getMaterialBaseColor(sourceMaterial) },
      uBoxCenter: { value: box.getCenter(new THREE.Vector3()) },
      uBoxHalfSize: { value: box.getSize(new THREE.Vector3()).multiplyScalar(0.5) },
      uCameraPosition: { value: new THREE.Vector3() },
      uHeatColors: { value: colorsFromHexList(DEFAULT_HEAT_GRADIENT) },
      uColdColors: { value: colorsFromHexList(DEFAULT_COLD_GRADIENT) },
    },
    transparent: true,
    depthWrite: true,
    depthTest: true,
  });

  return material;
}
