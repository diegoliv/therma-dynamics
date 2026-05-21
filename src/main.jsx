import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import GUI from "lil-gui";
import "./styles.css";

const MODEL_URL = "/models/therma_dynamics_v2.glb";
const THERMAL_PRESETS = {
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
const DEFAULT_THERMAL_PRESET = THERMAL_PRESETS.industrialRainbow;
const DEFAULT_GRADIENT_SOFTNESS = DEFAULT_THERMAL_PRESET.gradientSoftness;
const DEFAULT_THERMAL_RADIUS = DEFAULT_THERMAL_PRESET.radius;
const DEFAULT_THERMAL_CONTRAST = DEFAULT_THERMAL_PRESET.contrast;
const DEFAULT_THERMAL_NOISE = DEFAULT_THERMAL_PRESET.noise;
const DEFAULT_THERMAL_HOT_EDGE = DEFAULT_THERMAL_PRESET.hotEdge;
const DEFAULT_THERMAL_RADIANCE = 0.16;
const DEFAULT_HEAT_GRADIENT = DEFAULT_THERMAL_PRESET.heatColors;
const DEFAULT_COLD_GRADIENT = DEFAULT_THERMAL_PRESET.coldColors;
const DEFAULT_COOLING_COLOR = "#65d7ff";
const DEFAULT_COOLING_VISIBILITY = 1;
const DEFAULT_COOLING_ROUGHNESS = 0.16;
const DEFAULT_GLASS_COLOR = "#c8f8ff";
const DEFAULT_GLASS_OPACITY = 0.06;
const DEFAULT_GLOBAL_MASK_SOFTNESS = 0.14;
const DEFAULT_HEAT_FALLOFF = 1.25;
const DEFAULT_FLOOR_DOT_SIZE = 0.025;
const DEFAULT_FLOOR_DOT_SPACING = 0.22;
const DEFAULT_FLOOR_DOT_OPACITY = 0.35;
const DEFAULT_BACKGROUND_COLOR = "#080b0f";
const DEFAULT_DOF_SETTINGS = {
  enabled: false,
  focus: 40,
  aperture: 0.018,
  maxblur: 0.012,
};
const USE_COOLING_SHADER_FOR_THERMAL_TEST = false;
const DEFAULT_CAMERA_NEAR = 0.01;
const DEFAULT_CAMERA_FAR = 2000;
const DEFAULT_GLOBAL_LIGHT_SETTINGS = {
  ambientColor: "#ffffff",
  ambientIntensity: 1.2,
  hemisphereSkyColor: "#d8f7ff",
  hemisphereGroundColor: "#111827",
  hemisphereIntensity: 1.6,
};

const thermalVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vObjectPosition;
  varying vec3 vObjectNormal;
  varying vec3 vWorldNormal;

  void main() {
    vec4 objectPosition = vec4(position, 1.0);
    vec3 objectNormal = normal;

    vObjectPosition = position;
    vObjectNormal = normalize(normal);

    #ifdef USE_INSTANCING
      objectPosition = instanceMatrix * objectPosition;
      objectNormal = mat3(instanceMatrix) * objectNormal;
    #endif

    vWorldNormal = normalize(normalMatrix * objectNormal);

    vec4 worldPosition = modelMatrix * objectPosition;
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const thermalFragmentShader = `
  varying vec3 vWorldPosition;
  varying vec3 vObjectPosition;
  varying vec3 vObjectNormal;
  varying vec3 vWorldNormal;

  uniform float uTime;
  uniform float uThermalState;
  uniform float uEdgeSoftness;
  uniform float uThermalRadius;
  uniform float uCoreStrength;
  uniform float uThermalContrast;
  uniform float uThermalNoise;
  uniform float uHotEdge;
  uniform float uThermalRadiance;
  uniform float uGlobalOpacity;
  uniform float uGlobalMaskSoftness;
  uniform float uHeatFalloff;
  uniform vec3 uBaseColor;
  uniform vec3 uBoxCenter;
  uniform vec3 uBoxHalfSize;
  uniform vec3 uCameraPosition;
  uniform vec3 uHeatColors[4];
  uniform vec3 uColdColors[4];

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  float dissolveDither(vec3 p) {
    return hash(floor(p * 46.0));
  }

  void applyDissolveMask(float visibility, float noiseValue, float softness, vec3 ditherPosition) {
    if (visibility <= 0.001) discard;
    if (visibility >= 0.999) return;
    float edgeSoftness = max(softness, 0.001);
    float coverage = 1.0 - smoothstep(visibility - edgeSoftness, visibility + edgeSoftness, noiseValue);
    if (dissolveDither(ditherPosition) > coverage) discard;
  }

  vec3 sampleHeat(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 color = mix(uHeatColors[0], uHeatColors[1], smoothstep(0.0, 0.38, t));
    color = mix(color, uHeatColors[2], smoothstep(0.28, 0.72, t));
    color = mix(color, uHeatColors[3], smoothstep(0.66, 1.0, t));
    return color;
  }

  vec3 sampleCold(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 color = mix(uColdColors[0], uColdColors[1], smoothstep(0.0, 0.42, t));
    color = mix(color, uColdColors[2], smoothstep(0.32, 0.76, t));
    color = mix(color, uColdColors[3], smoothstep(0.72, 1.0, t));
    return color;
  }

  float thermalResponse(float t, vec3 noisePosition) {
    float broadNoise = valueNoise(noisePosition * 8.0 + vec3(0.0, uTime * 0.05, 0.0));
    float fineNoise = hash(floor(noisePosition * 145.0 + uTime * 3.0));
    float sensorNoise = (broadNoise - 0.5) * uThermalNoise + (fineNoise - 0.5) * uThermalNoise * 0.58;
    t = clamp(t + sensorNoise, 0.0, 1.0);
    t = clamp((t - 0.5) * uThermalContrast + 0.5, 0.0, 1.0);
    t = pow(t, mix(1.16, 0.72, uThermalState));

    float bands = 28.0;
    float banded = floor(t * bands) / bands;
    return mix(t, banded, 0.16);
  }

  vec2 faceCoordinates(vec3 localPosition, vec3 localNormal) {
    vec3 halfSize = max(uBoxHalfSize, vec3(0.0001));
    vec3 p = clamp((localPosition - uBoxCenter) / halfSize, vec3(-1.0), vec3(1.0));
    vec3 n = abs(normalize(localNormal));
    vec2 faceUv = p.xy;

    if (n.x > n.y && n.x > n.z) {
      faceUv = p.yz;
    } else if (n.y > n.z) {
      faceUv = p.xz;
    }

    return faceUv;
  }

  float roundedInsetMask(vec2 uv, float scale, float blur, float radius) {
    vec2 q = abs(uv) - vec2(scale) + vec2(radius);
    float sdf = length(max(q, vec2(0.0))) - radius;
    return 1.0 - smoothstep(0.0, blur, sdf);
  }

  float edgeProximity(vec2 uv) {
    float boxEdge = max(abs(uv.x), abs(uv.y));
    float rectangularEdge = smoothstep(0.62, 1.0, boxEdge);
    float roundedEdge = smoothstep(0.46, 1.0, length(uv));
    return clamp(max(rectangularEdge, roundedEdge * 0.72), 0.0, 1.0);
  }

  float blurredInsetThermalMap(vec2 faceUv) {
    float softness = max(uEdgeSoftness, 0.001);
    float radius = clamp(uThermalRadius, 0.35, 1.35);
    float outer = roundedInsetMask(faceUv, 0.96 * radius, softness * 0.52, 0.34 * radius);
    float midOuter = roundedInsetMask(faceUv, 0.78 * radius, softness * 0.58, 0.30 * radius);
    float midInner = roundedInsetMask(faceUv, 0.59 * radius, softness * 0.64, 0.26 * radius);
    float inner = roundedInsetMask(faceUv, 0.39 * radius, softness * 0.7, 0.22 * radius);
    float mapValue = outer * 0.18 + midOuter * 0.24 + midInner * 0.27 + inner * 0.31;
    return clamp(mapValue, 0.0, 1.0);
  }

  void main() {
    if (uGlobalOpacity < 0.999) {
      float dissolve = valueNoise(vWorldPosition * 1.15 + vec3(0.0, uTime * 0.04, 0.0));
      applyDissolveMask(uGlobalOpacity, dissolve, uGlobalMaskSoftness, vWorldPosition);
    }

    vec3 worldNormal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    vec3 lightDirection = normalize(vec3(-0.35, 0.62, 0.7));

    vec2 faceUv = faceCoordinates(vObjectPosition, vObjectNormal);
    float edgeMask = edgeProximity(faceUv);
    float faceCore = blurredInsetThermalMap(faceUv);
    float internalPulse = 0.045 * sin(uTime * 1.4 + vObjectPosition.x * 2.2 + vObjectPosition.y * 1.7);
    float surfaceNoise = valueNoise(vWorldPosition * 3.35 + vec3(1.7, uTime * 0.025, 4.2));
    float speckle = hash(floor(vWorldPosition * 78.0));
    float edgeHeat = edgeMask * uHotEdge * (0.34 + uThermalState * 0.66);
    float thermalAmount = clamp(faceCore + internalPulse * faceCore + edgeHeat, 0.0, 1.0);
    thermalAmount = clamp(thermalAmount + (surfaceNoise - 0.5) * 0.13 + (speckle - 0.5) * 0.035, 0.0, 1.0);
    thermalAmount = thermalResponse(thermalAmount, vWorldPosition);
    float centerHeat = pow(thermalAmount, 0.45);
    float centerCold = pow(thermalAmount, 0.58);
    vec3 thermalColor = mix(sampleCold(centerCold), sampleHeat(centerHeat), uThermalState);

    float diffuse = max(dot(worldNormal, lightDirection), 0.0);
    float fresnel = pow(1.0 - max(dot(worldNormal, viewDirection), 0.0), 2.4);
    vec3 edgeColor = uBaseColor * (0.66 + diffuse * 0.34);
    edgeColor += vec3(0.05, 0.1, 0.24) * fresnel * 0.42;

    float coreMix = thermalAmount * uCoreStrength;
    vec3 color = mix(edgeColor, thermalColor, coreMix);
    color += thermalColor * thermalAmount * 0.28;
    color += sampleHeat(0.86) * edgeMask * thermalAmount * uHotEdge * 0.36;
    color += mix(uColdColors[2], uHeatColors[2], uThermalState) * fresnel * 0.22;
    float hotRadiance = smoothstep(0.58, 1.0, thermalAmount);
    color += thermalColor * hotRadiance * uThermalRadiance;
    color += sampleHeat(1.0) * edgeMask * hotRadiance * uThermalRadiance * 0.55;
    color = pow(color, vec3(0.82));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const coolingVertexShader = `
  varying vec3 vObjectPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 objectPosition = vec4(position, 1.0);
    vec3 objectNormal = normal;

    #ifdef USE_INSTANCING
      objectPosition = instanceMatrix * objectPosition;
      objectNormal = mat3(instanceMatrix) * objectNormal;
    #endif

    vObjectPosition = position;
    vWorldNormal = normalize(normalMatrix * objectNormal);

    vec4 worldPosition = modelMatrix * objectPosition;
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const coolingFragmentShader = `
  varying vec3 vObjectPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  uniform float uTime;
  uniform float uVisibility;
  uniform float uRoughness;
  uniform float uGlobalOpacity;
  uniform float uGlobalMaskSoftness;
  uniform vec3 uColor;
  uniform vec3 uCameraPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  float dissolveDither(vec3 p) {
    return hash(floor(p * 46.0));
  }

  void applyDissolveMask(float visibility, float noiseValue, float softness, vec3 ditherPosition) {
    if (visibility <= 0.001) discard;
    if (visibility >= 0.999) return;
    float edgeSoftness = max(softness, 0.001);
    float coverage = 1.0 - smoothstep(visibility - edgeSoftness, visibility + edgeSoftness, noiseValue);
    if (dissolveDither(ditherPosition) > coverage) discard;
  }

  void main() {
    float n1 = valueNoise(vObjectPosition * 2.8 + vec3(0.0, uTime * 0.08, 0.0));
    float n2 = valueNoise(vObjectPosition * 7.0 - vec3(uTime * 0.06, 0.0, 0.0));
    float mask = clamp(n1 * 0.7 + n2 * 0.3, 0.0, 1.0);
    float globalMask = valueNoise(vWorldPosition * 1.18 + vec3(1.3, uTime * 0.035, 0.7));
    applyDissolveMask(uVisibility, mask, 0.16, vWorldPosition + vec3(2.7, 0.0, 1.1));
    applyDissolveMask(uGlobalOpacity, globalMask, uGlobalMaskSoftness, vWorldPosition);

    vec3 normal = normalize(vWorldNormal);
    vec3 lightDirection = normalize(vec3(-0.35, 0.62, 0.7));
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float shininess = mix(96.0, 8.0, clamp(uRoughness, 0.0, 1.0));
    float specular = pow(max(dot(normal, halfDirection), 0.0), shininess) * (1.0 - clamp(uRoughness, 0.0, 1.0));
    vec3 color = uColor * (0.34 + diffuse * 0.66) + vec3(1.0) * specular * 0.32;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const floorVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const floorFragmentShader = `
  varying vec3 vWorldPosition;

  uniform float uDotSize;
  uniform float uDotSpacing;
  uniform float uDotOpacity;
  uniform vec3 uDotColor;

  void main() {
    float spacing = max(uDotSpacing, 0.001);
    vec2 cell = fract(vWorldPosition.xz / spacing) - 0.5;
    float distanceToCenter = length(cell) * spacing;
    float radius = clamp(uDotSize, 0.0001, spacing * 0.48);
    float edge = max(radius * 0.28, 0.001);
    float dot = 1.0 - smoothstep(radius - edge, radius, distanceToCenter);
    float alpha = dot * clamp(uDotOpacity, 0.0, 1.0);
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(uDotColor, alpha);
  }
`;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readInstanceCount(mesh) {
  if (mesh.isInstancedMesh) return mesh.count;
  return 1;
}

function collectSceneStats(gltf) {
  const json = gltf.parser?.json ?? {};
  const instancedJsonNodes = (json.nodes ?? []).filter((node) => node.extensions?.EXT_mesh_gpu_instancing);
  const extensionNames = json.extensionsUsed ?? [];
  const materialNames = (json.materials ?? []).map((material) => material.name || "(unnamed)");
  const meshNames = (json.meshes ?? []).map((mesh, index) => mesh.name || `mesh_${index}`);

  const runtime = {
    meshes: 0,
    instancedMeshes: 0,
    instanceCount: 0,
    triangles: 0,
    materials: new Map(),
    objects: 0,
  };

  gltf.scene.traverse((node) => {
    runtime.objects += 1;
    if (!node.isMesh && !node.isInstancedMesh) return;

    runtime.meshes += 1;
    if (node.isInstancedMesh) runtime.instancedMeshes += 1;
    runtime.instanceCount += readInstanceCount(node);

    const geometry = node.geometry;
    const triangleCount = geometry?.index
      ? geometry.index.count / 3
      : (geometry?.attributes?.position?.count ?? 0) / 3;
    runtime.triangles += triangleCount * readInstanceCount(node);

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      const name = material?.name || "(unnamed)";
      runtime.materials.set(name, (runtime.materials.get(name) ?? 0) + readInstanceCount(node));
    });
  });

  return {
    generator: json.asset?.generator ?? "unknown",
    version: json.asset?.version ?? "unknown",
    extensions: extensionNames,
    instancedJsonNodes: instancedJsonNodes.map((node) => ({
      name: node.name || "(unnamed)",
      mesh: node.mesh,
      attributes: Object.keys(node.extensions.EXT_mesh_gpu_instancing.attributes ?? {}),
    })),
    materialNames,
    meshNames,
    animationCount: json.animations?.length ?? 0,
    bufferBytes: (json.buffers ?? []).reduce((sum, buffer) => sum + (buffer.byteLength ?? 0), 0),
    runtime: {
      ...runtime,
      triangles: Math.round(runtime.triangles),
      materials: Array.from(runtime.materials.entries()).map(([name, count]) => ({ name, count })),
    },
  };
}

function EnvironmentSetup() {
  const { scene, gl } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    return () => {
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

function RendererSettings() {
  const { gl } = useThree();

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;
  }, [gl]);

  return null;
}

function Controls({ target, enabled }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef();
  const hasInitializedTargetRef = useRef(false);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.panSpeed = 0.85;
    controls.screenSpacePanning = true;
    controls.target.copy(target.current);
    controls.minDistance = 0.25;
    controls.maxDistance = 20;
    controls.enabled = enabled;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, enabled, gl, target]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = enabled;
    }
  }, [enabled]);

  useFrame(() => {
    if (!controlsRef.current) return;
    if (!hasInitializedTargetRef.current) {
      controlsRef.current.target.copy(target.current);
      hasInitializedTargetRef.current = true;
    }
    controlsRef.current.update();
  });

  return null;
}

function BokehDepthOfField({ settings }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const bokehPassRef = useRef();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bokehPass = new BokehPass(scene, camera, {
      focus: settings.focus,
      aperture: settings.aperture,
      maxblur: settings.maxblur,
    });

    composer.addPass(renderPass);
    composer.addPass(bokehPass);
    composerRef.current = composer;
    bokehPassRef.current = bokehPass;

    return () => {
      composer.dispose();
      bokehPass.dispose();
      composerRef.current = null;
      bokehPassRef.current = null;
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    const width = Math.max(1, Math.floor(size.width * pixelRatio));
    const height = Math.max(1, Math.floor(size.height * pixelRatio));
    composerRef.current?.setSize(width, height);
    bokehPassRef.current?.setSize(width, height);
  }, [gl, size.height, size.width]);

  useFrame(() => {
    const composer = composerRef.current;
    const bokehPass = bokehPassRef.current;
    if (!settings.enabled || !composer || !bokehPass) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }

    bokehPass.uniforms.focus.value = settings.focus;
    bokehPass.uniforms.aperture.value = settings.aperture;
    bokehPass.uniforms.maxblur.value = settings.maxblur;
    composer.render();
  }, 1);

  return null;
}

function fitCameraToObject(camera, object, targetRef) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.abs(maxSize / Math.sin(fov / 2)) * 0.62;

  camera.position.set(center.x + distance * 0.45, center.y + distance * 0.24, center.z + distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  targetRef.current.copy(center);
}

function getMaterialBaseColor(material) {
  if (material?.color?.isColor) return material.color.clone();
  return new THREE.Color("#0007cc");
}

function colorsFromHexList(colors) {
  return colors.map((color) => new THREE.Color(color));
}

function displayOpacityFromControl(rawOpacity) {
  return THREE.MathUtils.clamp(rawOpacity, 0, 1);
}

function isThermalMaterial(material) {
  if (Array.isArray(material)) {
    return material.some((entry) => entry?.name?.toLowerCase().includes("thermal"));
  }
  return material?.name?.toLowerCase().includes("thermal");
}

function isGlassMaterial(material) {
  if (Array.isArray(material)) {
    return material.some((entry) => entry?.name?.toLowerCase().includes("glass"));
  }
  return material?.name?.toLowerCase().includes("glass");
}

function isCoolingMaterial(material) {
  if (Array.isArray(material)) {
    return material.some((entry) => entry?.name?.toLowerCase().includes("cooling"));
  }
  return material?.name?.toLowerCase().includes("cooling");
}

function isFloorMaterial(material) {
  if (Array.isArray(material)) {
    return material.some((entry) => entry?.name?.toLowerCase().includes("floor"));
  }
  return material?.name?.toLowerCase().includes("floor");
}

function isCoolingObject(node) {
  const name = node.name?.toLowerCase() ?? "";
  return name.includes("cooling_plate") || name.includes("coolant");
}

function isHeatObject(node) {
  const name = node.name?.toLowerCase() ?? "";
  return name === "heat" || name.startsWith("heat.");
}

function getRackInfluenceNode(node) {
  let cursor = node;
  let rackNode = null;

  while (cursor) {
    const name = cursor.name?.toLowerCase() ?? "";
    if (/^rack(?:\.|$)/.test(name)) rackNode = cursor;
    cursor = cursor.parent;
  }

  return rackNode ?? node;
}

function heatInfluenceAtPoint(point, heatCenter, heatHalfSize, heatFalloff) {
  const qx = Math.abs(point.x - heatCenter.x) - heatHalfSize.x;
  const qy = Math.abs(point.y - heatCenter.y) - heatHalfSize.y;
  const qz = Math.abs(point.z - heatCenter.z) - heatHalfSize.z;
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideZ = Math.max(qz, 0);
  const outsideDistance = Math.sqrt(
    outsideX * outsideX + outsideY * outsideY + outsideZ * outsideZ,
  );
  const inside = Math.max(qx, qy, qz) <= 0;
  if (inside) return 1;

  const falloff = Math.max(heatFalloff, 0.0001);
  const t = THREE.MathUtils.clamp(outsideDistance / falloff, 0, 1);
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}

function sourceByName(material, name) {
  if (Array.isArray(material)) {
    return material.find((entry) => entry?.name?.toLowerCase().includes(name));
  }
  return material;
}

function getOpacityBucket(node) {
  let cursor = node;
  let isRackDescendant = false;

  while (cursor) {
    const name = cursor.name?.toLowerCase() ?? "";
    if (/^gpu(?:\.|$)/.test(name)) return "gpu";
    if (/^rack(?:\.|$)/.test(name)) isRackDescendant = true;
    cursor = cursor.parent;
  }

  return isRackDescendant ? "rack" : "outside";
}

function injectGlobalDissolve(material) {
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

function cloneOpacityMaterial(sourceMaterial, bucket) {
  const material = sourceMaterial?.clone ? sourceMaterial.clone() : sourceMaterial;
  if (!material) return material;
  material.userData.opacityBucket = bucket;
  material.userData.baseOpacity = material.opacity ?? 1;
  material.userData.baseTransparent = Boolean(material.transparent);
  return injectGlobalDissolve(material);
}

function createGlassMaterial(sourceMaterial) {
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

function createCoolingMaterial(sourceMaterial) {
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

function createFloorMaterial(sourceMaterial) {
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

function createInvisibleHeatMaterial(sourceMaterial) {
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

function createThermalTestMaterial(sourceMaterial) {
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

function createThermalMaterial(sourceMaterial, geometry) {
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

function Model({
  orbitEnabled,
  thermalSettings,
  coolingSettings,
  glassSettings,
  floorSettings,
  globalOpacitySettings,
  animationProgress,
  onStats,
}) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const groupRef = useRef();
  const boundsRef = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const thermalMaterialsRef = useRef([]);
  const coolingMaterialsRef = useRef([]);
  const glassMaterialsRef = useRef([]);
  const floorMaterialsRef = useRef([]);
  const opacityMaterialsRef = useRef([]);
  const heatObjectRef = useRef();
  const heatBoundsRef = useRef({
    box: new THREE.Box3(),
    center: new THREE.Vector3(),
    halfSize: new THREE.Vector3(0.0001, 0.0001, 0.0001),
    sampleBox: new THREE.Box3(),
    sampleCenter: new THREE.Vector3(),
  });
  const mixerRef = useRef();
  const actionsRef = useRef([]);
  const animationDurationRef = useRef(1);
  const sourceCameraRef = useRef();

  const { scene, stats } = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);
    const sceneStats = collectSceneStats(gltf);
    thermalMaterialsRef.current = [];
    coolingMaterialsRef.current = [];
    glassMaterialsRef.current = [];
    floorMaterialsRef.current = [];
    opacityMaterialsRef.current = [];
    heatObjectRef.current = null;
    sourceCameraRef.current = null;
    const clayMaterial = new THREE.MeshStandardMaterial({
      color: "#dde6ea",
      roughness: 0.52,
      metalness: 0.05,
    });
    const instanceHighlightMaterial = new THREE.MeshStandardMaterial({
      color: "#42f5d7",
      roughness: 0.34,
      metalness: 0.16,
      emissive: "#06362f",
      emissiveIntensity: 0.28,
    });
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: "#78f3ff",
      wireframe: true,
      transparent: true,
      opacity: 0.62,
    });

    clonedScene.traverse((node) => {
      if (node.isCamera && !sourceCameraRef.current) {
        sourceCameraRef.current = node;
      }

      if (!node.isMesh && !node.isInstancedMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;

      const originalMaterial = node.material;
      const opacityBucket = getOpacityBucket(node);
      let materialForPreview = originalMaterial;
      if (isHeatObject(node)) {
        const sourceMaterial = isThermalMaterial(originalMaterial)
          ? sourceByName(originalMaterial, "heat")
          : originalMaterial;
        materialForPreview = createInvisibleHeatMaterial(sourceMaterial);
        heatObjectRef.current = node;
        node.renderOrder = -1;
      } else if (isFloorMaterial(originalMaterial)) {
        const sourceMaterial = sourceByName(originalMaterial, "floor");
        materialForPreview = createFloorMaterial(sourceMaterial);
        materialForPreview.userData.opacityBucket = opacityBucket;
        node.renderOrder = 0;
        floorMaterialsRef.current.push(materialForPreview);
      } else if (isThermalMaterial(originalMaterial)) {
        const sourceMaterial = sourceByName(originalMaterial, "thermal");
        materialForPreview = USE_COOLING_SHADER_FOR_THERMAL_TEST
          ? createThermalTestMaterial(sourceMaterial)
          : createThermalMaterial(sourceMaterial, node.geometry);
        materialForPreview.userData.opacityBucket = opacityBucket;
        materialForPreview.userData.renderNode = node;
        materialForPreview.userData.heatInfluenceNode = getRackInfluenceNode(node);
        node.renderOrder = 1;
        if (USE_COOLING_SHADER_FOR_THERMAL_TEST) {
          opacityMaterialsRef.current.push(materialForPreview);
        } else {
          thermalMaterialsRef.current.push(materialForPreview);
          opacityMaterialsRef.current.push(materialForPreview);
        }
      } else if (isCoolingMaterial(originalMaterial) || isCoolingObject(node)) {
        const sourceMaterial = isCoolingMaterial(originalMaterial)
          ? sourceByName(originalMaterial, "cooling")
          : originalMaterial;
        materialForPreview = createCoolingMaterial(sourceMaterial);
        materialForPreview.userData.opacityBucket = opacityBucket;
        node.renderOrder = 2;
        coolingMaterialsRef.current.push(materialForPreview);
        opacityMaterialsRef.current.push(materialForPreview);
      } else if (isGlassMaterial(originalMaterial)) {
        const sourceMaterial = sourceByName(originalMaterial, "glass");
        materialForPreview = createGlassMaterial(sourceMaterial);
        materialForPreview.userData.opacityBucket = opacityBucket;
        node.renderOrder = 4;
        glassMaterialsRef.current.push(materialForPreview);
        opacityMaterialsRef.current.push(materialForPreview);
      } else {
        materialForPreview = cloneOpacityMaterial(originalMaterial, opacityBucket);
        if (materialForPreview) opacityMaterialsRef.current.push(materialForPreview);
      }

      node.material = materialForPreview;
      node.userData.originalMaterial = materialForPreview;
      node.userData.previewMaterials = {
        clay: node.isInstancedMesh ? instanceHighlightMaterial : clayMaterial,
        wire: wireMaterial,
      };
    });

    const mixer = new THREE.AnimationMixer(clonedScene);
    const duration = Math.max(...gltf.animations.map((clip) => clip.duration), 1);
    actionsRef.current = gltf.animations.map((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      return { action, duration: clip.duration };
    });
    mixer.update(0);
    mixerRef.current = mixer;
    animationDurationRef.current = duration;

    return { scene: clonedScene, stats: { ...sceneStats, animationDuration: duration } };
  }, [gltf]);

  useEffect(() => {
    onStats(stats);
  }, [onStats, stats]);

  useEffect(() => {
    if (!groupRef.current) return;
    if (sourceCameraRef.current) return;
    fitCameraToObject(camera, groupRef.current, boundsRef);
  }, [camera, scene]);

  useFrame((_, delta) => {
    const globalAnimationTime = animationProgress >= 1
      ? animationDurationRef.current - 0.0001
      : animationDurationRef.current * animationProgress;
    actionsRef.current.forEach(({ action, duration }) => {
      const actionTime = Math.min(globalAnimationTime, duration - 0.0001);
      action.enabled = true;
      action.paused = false;
      action.time = THREE.MathUtils.clamp(actionTime, 0, Math.max(duration - 0.0001, 0));
    });
    mixerRef.current?.update(0);

    if (!orbitEnabled && sourceCameraRef.current?.isPerspectiveCamera) {
      sourceCameraRef.current.updateMatrixWorld(true);
      sourceCameraRef.current.matrixWorld.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      camera.fov = sourceCameraRef.current.fov;
      camera.near = DEFAULT_CAMERA_NEAR;
      camera.far = DEFAULT_CAMERA_FAR;
      camera.updateProjectionMatrix();
    }

    const getOpacityMultiplier = (bucket) => {
      if (bucket === "outside") return globalOpacitySettings.outsideRack;
      if (bucket === "rack") return globalOpacitySettings.rackWithoutGpu;
      return 1;
    };

    const heatBounds = heatBoundsRef.current;
    if (heatObjectRef.current) {
      heatObjectRef.current.updateMatrixWorld(true);
      heatBounds.box.setFromObject(heatObjectRef.current);
      if (!heatBounds.box.isEmpty()) {
        heatBounds.box.getCenter(heatBounds.center);
        heatBounds.box.getSize(heatBounds.halfSize).multiplyScalar(0.5);
        heatBounds.halfSize.max(new THREE.Vector3(0.0001, 0.0001, 0.0001));
      }
    }

    thermalMaterialsRef.current.forEach((material) => {
      const visibility = displayOpacityFromControl(getOpacityMultiplier(material.userData.opacityBucket));
      material.uniforms.uTime.value += delta;
      material.uniforms.uEdgeSoftness.value = thermalSettings.gradientSoftness;
      material.uniforms.uThermalRadius.value = thermalSettings.radius;
      material.uniforms.uThermalContrast.value = thermalSettings.contrast;
      material.uniforms.uThermalNoise.value = thermalSettings.noise;
      material.uniforms.uHotEdge.value = thermalSettings.hotEdge;
      material.uniforms.uThermalRadiance.value = thermalSettings.radiance;
      material.uniforms.uGlobalOpacity.value = visibility;
      material.uniforms.uGlobalMaskSoftness.value = globalOpacitySettings.maskSoftness;
      material.uniforms.uHeatFalloff.value = thermalSettings.heatFalloff;
      const influenceNode = material.userData.heatInfluenceNode ?? material.userData.renderNode;
      let rackHeatState = 0;
      if (influenceNode && heatObjectRef.current && !heatBounds.box.isEmpty()) {
        influenceNode.updateMatrixWorld(true);
        heatBounds.sampleBox.setFromObject(influenceNode);
        if (!heatBounds.sampleBox.isEmpty()) {
          heatBounds.sampleBox.getCenter(heatBounds.sampleCenter);
          rackHeatState = heatInfluenceAtPoint(
            heatBounds.sampleCenter,
            heatBounds.center,
            heatBounds.halfSize,
            thermalSettings.heatFalloff,
          );
        }
      }
      material.uniforms.uThermalState.value = rackHeatState;
      material.transparent = false;
      material.depthWrite = true;
      material.depthTest = true;
      material.needsUpdate = true;
      if (material.userData.renderNode) {
        material.userData.renderNode.renderOrder = 1;
      }
      material.uniforms.uHeatColors.value.forEach((color, index) => {
        color.set(thermalSettings.heatColors[index]);
      });
      material.uniforms.uColdColors.value.forEach((color, index) => {
        color.set(thermalSettings.coldColors[index]);
      });
      material.uniforms.uCameraPosition.value.copy(camera.position);
    });

    floorMaterialsRef.current.forEach((material) => {
      material.uniforms.uDotSize.value = floorSettings.dotSize;
      material.uniforms.uDotSpacing.value = floorSettings.dotSpacing;
      material.uniforms.uDotOpacity.value = floorSettings.dotOpacity;
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    });

    coolingMaterialsRef.current.forEach((material) => {
      const visibility = displayOpacityFromControl(getOpacityMultiplier(material.userData.opacityBucket));
      material.uniforms.uTime.value += delta;
      material.uniforms.uVisibility.value = coolingSettings.visibility;
      material.uniforms.uRoughness.value = coolingSettings.roughness;
      material.uniforms.uColor.value.set(coolingSettings.color);
      material.uniforms.uGlobalOpacity.value = visibility;
      material.uniforms.uGlobalMaskSoftness.value = globalOpacitySettings.maskSoftness;
      material.uniforms.uCameraPosition.value.copy(camera.position);
    });

    glassMaterialsRef.current.forEach((material) => {
      const bucketOpacity = getOpacityMultiplier(material.userData.opacityBucket);
      material.color.set(glassSettings.color);
      material.opacity = glassSettings.opacity * bucketOpacity;
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    });

    opacityMaterialsRef.current.forEach((material) => {
      if (material.isShaderMaterial) return;
      if (material.userData.isGlassPreview) return;
      if (material.userData.isCoolingPreview) return;
      const visibility = displayOpacityFromControl(getOpacityMultiplier(material.userData.opacityBucket));
      const baseOpacity = material.userData.baseOpacity ?? material.opacity ?? 1;
      material.opacity = baseOpacity;
      material.transparent = material.userData.baseTransparent;
      material.depthWrite = true;
      if (material.userData.globalVisibilityUniform) {
        material.userData.globalVisibilityUniform.value = visibility;
      }
      if (material.userData.globalMaskSoftnessUniform) {
        material.userData.globalMaskSoftnessUniform.value = globalOpacitySettings.maskSoftness;
      }
      if (material.userData.globalDissolveTimeUniform) {
        material.userData.globalDissolveTimeUniform.value += delta;
      }
      material.needsUpdate = true;
    });
  });

  return (
    <>
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
      <Controls target={boundsRef} enabled={orbitEnabled} />
    </>
  );
}

function Viewer({
  orbitEnabled,
  backgroundColor,
  dofSettings,
  thermalSettings,
  coolingSettings,
  glassSettings,
  floorSettings,
  globalOpacitySettings,
  animationProgress,
  onStats,
}) {
  return (
    <Canvas
      camera={{ position: [2, 1.2, 4], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      shadows
    >
      <RendererSettings />
      <color attach="background" args={[backgroundColor]} />
      <ambientLight
        color={DEFAULT_GLOBAL_LIGHT_SETTINGS.ambientColor}
        intensity={DEFAULT_GLOBAL_LIGHT_SETTINGS.ambientIntensity}
      />
      <hemisphereLight
        args={[
          DEFAULT_GLOBAL_LIGHT_SETTINGS.hemisphereSkyColor,
          DEFAULT_GLOBAL_LIGHT_SETTINGS.hemisphereGroundColor,
          DEFAULT_GLOBAL_LIGHT_SETTINGS.hemisphereIntensity,
        ]}
      />
      <EnvironmentSetup />
      <Suspense fallback={null}>
        <Model
          orbitEnabled={orbitEnabled}
          thermalSettings={thermalSettings}
          coolingSettings={coolingSettings}
          glassSettings={glassSettings}
          floorSettings={floorSettings}
          globalOpacitySettings={globalOpacitySettings}
          animationProgress={animationProgress}
          onStats={onStats}
        />
      </Suspense>
      <BokehDepthOfField settings={dofSettings} />
    </Canvas>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GuiControls({
  orbitEnabled,
  setOrbitEnabled,
  backgroundColor,
  setBackgroundColor,
  dofSettings,
  setDofSettings,
  thermalSettings,
  setThermalSettings,
  coolingSettings,
  setCoolingSettings,
  glassSettings,
  setGlassSettings,
  floorSettings,
  setFloorSettings,
  globalOpacitySettings,
  setGlobalOpacitySettings,
  animationProgress,
  setAnimationProgress,
}) {
  useEffect(() => {
    const controls = {
      orbitEnabled,
      backgroundColor,
      dofEnabled: dofSettings.enabled,
      dofFocus: dofSettings.focus,
      dofAperture: dofSettings.aperture,
      dofMaxblur: dofSettings.maxblur,
      exportPng: () => {
        const canvas = document.querySelector(".stage canvas");
        if (!canvas) return;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `therma-canvas-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      },
      gradientSoftness: thermalSettings.gradientSoftness,
      thermalRadius: thermalSettings.radius,
      thermalContrast: thermalSettings.contrast,
      thermalNoise: thermalSettings.noise,
      thermalHotEdge: thermalSettings.hotEdge,
      thermalRadiance: thermalSettings.radiance,
      thermalHeatFalloff: thermalSettings.heatFalloff,
      heat0: thermalSettings.heatColors[0],
      heat1: thermalSettings.heatColors[1],
      heat2: thermalSettings.heatColors[2],
      heat3: thermalSettings.heatColors[3],
      cold0: thermalSettings.coldColors[0],
      cold1: thermalSettings.coldColors[1],
      cold2: thermalSettings.coldColors[2],
      cold3: thermalSettings.coldColors[3],
      coolingVisibility: coolingSettings.visibility,
      coolingColor: coolingSettings.color,
      coolingRoughness: coolingSettings.roughness,
      glassOpacity: glassSettings.opacity,
      glassColor: glassSettings.color,
      floorDotSize: floorSettings.dotSize,
      floorDotSpacing: floorSettings.dotSpacing,
      floorDotOpacity: floorSettings.dotOpacity,
      outsideRackOpacity: globalOpacitySettings.outsideRack,
      rackWithoutGpuOpacity: globalOpacitySettings.rackWithoutGpu,
      globalMaskSoftness: globalOpacitySettings.maskSoftness,
      animationProgress,
      industrialRainbowPreset: () => applyThermalPreset(THERMAL_PRESETS.industrialRainbow),
      datacenterMagmaPreset: () => applyThermalPreset(THERMAL_PRESETS.datacenterMagma),
    };

    const thermalControllers = [];

    const syncThermalSettings = () => {
      setThermalSettings({
        gradientSoftness: controls.gradientSoftness,
        radius: controls.thermalRadius,
        contrast: controls.thermalContrast,
        noise: controls.thermalNoise,
        hotEdge: controls.thermalHotEdge,
        radiance: controls.thermalRadiance,
        heatFalloff: controls.thermalHeatFalloff,
        heatColors: [controls.heat0, controls.heat1, controls.heat2, controls.heat3],
        coldColors: [controls.cold0, controls.cold1, controls.cold2, controls.cold3],
      });
    };

    const applyThermalPreset = (preset) => {
      controls.gradientSoftness = preset.gradientSoftness;
      controls.thermalRadius = preset.radius;
      controls.thermalContrast = preset.contrast;
      controls.thermalNoise = preset.noise;
      controls.thermalHotEdge = preset.hotEdge;
      controls.thermalHeatFalloff = DEFAULT_HEAT_FALLOFF;
      [controls.heat0, controls.heat1, controls.heat2, controls.heat3] = preset.heatColors;
      [controls.cold0, controls.cold1, controls.cold2, controls.cold3] = preset.coldColors;
      syncThermalSettings();
      thermalControllers.forEach((controller) => controller.updateDisplay());
    };

    const syncCoolingSettings = () => {
      setCoolingSettings({
        visibility: controls.coolingVisibility,
        color: controls.coolingColor,
        roughness: controls.coolingRoughness,
      });
    };

    const syncGlassSettings = () => {
      setGlassSettings({
        opacity: controls.glassOpacity,
        color: controls.glassColor,
      });
    };

    const syncFloorSettings = () => {
      setFloorSettings({
        dotSize: controls.floorDotSize,
        dotSpacing: controls.floorDotSpacing,
        dotOpacity: controls.floorDotOpacity,
      });
    };

    const syncGlobalOpacitySettings = () => {
      setGlobalOpacitySettings({
        outsideRack: controls.outsideRackOpacity,
        rackWithoutGpu: controls.rackWithoutGpuOpacity,
        maskSoftness: controls.globalMaskSoftness,
      });
    };

    const syncDofSettings = () => {
      setDofSettings({
        enabled: controls.dofEnabled,
        focus: controls.dofFocus,
        aperture: controls.dofAperture,
        maxblur: controls.dofMaxblur,
      });
    };

    const gui = new GUI({ title: "Therma preview controls" });
    gui.add(controls, "orbitEnabled").name("Orbit controls").onChange(setOrbitEnabled);
    gui.addColor(controls, "backgroundColor").name("Background").onChange(setBackgroundColor);
    gui.add(controls, "exportPng").name("Save canvas PNG");

    const dofFolder = gui.addFolder("Depth of field");
    dofFolder.add(controls, "dofEnabled").name("Enabled").onChange(syncDofSettings);
    dofFolder.add(controls, "dofFocus", 0.1, 300, 0.5).name("Focus").onChange(syncDofSettings);
    dofFolder.add(controls, "dofAperture", 0.0001, 0.08, 0.0005).name("Aperture").onChange(syncDofSettings);
    dofFolder.add(controls, "dofMaxblur", 0.0001, 0.08, 0.0005).name("Max blur").onChange(syncDofSettings);

    const thermalFolder = gui.addFolder("Thermal shader");
    thermalFolder.add(controls, "industrialRainbowPreset").name("Preset: industrial rainbow");
    thermalFolder.add(controls, "datacenterMagmaPreset").name("Preset: datacenter magma");
    thermalControllers.push(
      thermalFolder.add(controls, "gradientSoftness", 0.08, 1.2, 0.01).name("Gradient softness").onChange(syncThermalSettings),
      thermalFolder.add(controls, "thermalRadius", 0.35, 1.35, 0.01).name("Layer radius").onChange(syncThermalSettings),
      thermalFolder.add(controls, "thermalContrast", 0.7, 2.4, 0.01).name("Camera contrast").onChange(syncThermalSettings),
      thermalFolder.add(controls, "thermalNoise", 0, 0.18, 0.005).name("Sensor noise").onChange(syncThermalSettings),
      thermalFolder.add(controls, "thermalHotEdge", 0, 0.9, 0.01).name("Hot edges").onChange(syncThermalSettings),
      thermalFolder.add(controls, "thermalRadiance", 0, 0.55, 0.005).name("Heat radiance").onChange(syncThermalSettings),
      thermalFolder.add(controls, "thermalHeatFalloff", 0.05, 5, 0.01).name("Heat falloff").onChange(syncThermalSettings),
    );

    const heatFolder = gui.addFolder("Heat gradient");
    thermalControllers.push(
      heatFolder.addColor(controls, "heat0").name("Edge").onChange(syncThermalSettings),
      heatFolder.addColor(controls, "heat1").name("Low").onChange(syncThermalSettings),
      heatFolder.addColor(controls, "heat2").name("Mid").onChange(syncThermalSettings),
      heatFolder.addColor(controls, "heat3").name("Core").onChange(syncThermalSettings),
    );

    const coldFolder = gui.addFolder("Cold gradient");
    thermalControllers.push(
      coldFolder.addColor(controls, "cold0").name("Edge").onChange(syncThermalSettings),
      coldFolder.addColor(controls, "cold1").name("Low").onChange(syncThermalSettings),
      coldFolder.addColor(controls, "cold2").name("Mid").onChange(syncThermalSettings),
      coldFolder.addColor(controls, "cold3").name("Core").onChange(syncThermalSettings),
    );

    const coolingFolder = gui.addFolder("Cooling material");
    coolingFolder.add(controls, "coolingVisibility", 0, 1, 0.01).name("Visibility mask").onChange(syncCoolingSettings);
    coolingFolder.addColor(controls, "coolingColor").name("Color").onChange(syncCoolingSettings);
    coolingFolder.add(controls, "coolingRoughness", 0, 1, 0.01).name("Roughness").onChange(syncCoolingSettings);

    const glassFolder = gui.addFolder("Glass material");
    glassFolder.add(controls, "glassOpacity", 0, 0.5, 0.005).name("Opacity").onChange(syncGlassSettings);
    glassFolder.addColor(controls, "glassColor").name("Color").onChange(syncGlassSettings);

    const floorFolder = gui.addFolder("Floor dots");
    floorFolder.add(controls, "floorDotSize", 0.001, 0.2, 0.001).name("Dot size").onChange(syncFloorSettings);
    floorFolder.add(controls, "floorDotSpacing", 0.02, 1.5, 0.005).name("Dot spacing").onChange(syncFloorSettings);
    floorFolder.add(controls, "floorDotOpacity", 0, 1, 0.01).name("Dot opacity").onChange(syncFloorSettings);

    const opacityFolder = gui.addFolder("Global visibility mask");
    opacityFolder.add(controls, "outsideRackOpacity", 0, 1, 0.01).name("Outside rack").onChange(syncGlobalOpacitySettings);
    opacityFolder.add(controls, "rackWithoutGpuOpacity", 0, 1, 0.01).name("Rack no gpu").onChange(syncGlobalOpacitySettings);
    opacityFolder.add(controls, "globalMaskSoftness", 0.001, 0.4, 0.001).name("Edge softness").onChange(syncGlobalOpacitySettings);

    const animationFolder = gui.addFolder("Animation");
    animationFolder.add(controls, "animationProgress", 0, 1, 0.001).name("Timeline").onChange(setAnimationProgress);

    thermalFolder.open();
    dofFolder.open();
    coolingFolder.open();
    glassFolder.open();
    floorFolder.open();
    opacityFolder.open();
    animationFolder.open();
    heatFolder.open();
    coldFolder.open();

    return () => gui.destroy();
  }, []);

  return null;
}

function InspectorPanel({ stats, isCollapsed, setIsCollapsed }) {
  const hasGpuInstancing = stats?.extensions?.includes("EXT_mesh_gpu_instancing");

  return (
    <aside className={`inspector ${isCollapsed ? "collapsed" : ""}`}>
      <button
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Show GLB preview panel" : "Hide GLB preview panel"}
        className="panel-toggle"
        onClick={() => setIsCollapsed((value) => !value)}
        type="button"
      >
        {isCollapsed ? "Show GLB preview" : "Hide"}
      </button>

      <div className="brand">
        <span>GLB Preview</span>
        <strong>Therma Dynamics v2</strong>
      </div>

      <div className={`status ${hasGpuInstancing ? "ok" : "warn"}`}>
        <span />
        {hasGpuInstancing ? "EXT_mesh_gpu_instancing detected" : "No GPU instancing extension found"}
      </div>

      <div className="stats-grid">
        <Stat label="GLB buffer" value={formatBytes(stats?.bufferBytes ?? 0)} />
        <Stat label="Runtime meshes" value={stats?.runtime.meshes ?? "-"} />
        <Stat label="Instanced meshes" value={stats?.runtime.instancedMeshes ?? "-"} />
        <Stat label="Drawn instances" value={stats?.runtime.instanceCount ?? "-"} />
        <Stat label="JSON instance nodes" value={stats?.instancedJsonNodes.length ?? "-"} />
        <Stat label="Materials" value={stats?.materialNames.length ?? "-"} />
        <Stat label="Animations" value={stats?.animationCount ?? "-"} />
        <Stat label="Timeline" value={`${(stats?.animationDuration ?? 0).toFixed(2)}s`} />
      </div>

      <section>
        <h2>Materials</h2>
        <ul className="chips">
          {(stats?.runtime.materials ?? []).map((material) => (
            <li key={material.name}>
              <span>{material.name}</span>
              <strong>{material.count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Instanced nodes</h2>
        <div className="node-list">
          {(stats?.instancedJsonNodes ?? []).map((node) => (
            <div key={`${node.name}-${node.mesh}`}>
              <strong>{node.name}</strong>
              <span>mesh {node.mesh} - {node.attributes.join(", ")}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="footnote">
        Generator: {stats?.generator ?? "loading"} - glTF {stats?.version ?? "-"}
      </p>
    </aside>
  );
}

function App() {
  const [stats, setStats] = useState(null);
  const [orbitEnabled, setOrbitEnabled] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [dofSettings, setDofSettings] = useState(DEFAULT_DOF_SETTINGS);
  const [thermalSettings, setThermalSettings] = useState({
    gradientSoftness: DEFAULT_GRADIENT_SOFTNESS,
    radius: DEFAULT_THERMAL_RADIUS,
    contrast: DEFAULT_THERMAL_CONTRAST,
    noise: DEFAULT_THERMAL_NOISE,
    hotEdge: DEFAULT_THERMAL_HOT_EDGE,
    radiance: DEFAULT_THERMAL_RADIANCE,
    heatFalloff: DEFAULT_HEAT_FALLOFF,
    heatColors: DEFAULT_HEAT_GRADIENT,
    coldColors: DEFAULT_COLD_GRADIENT,
  });
  const [coolingSettings, setCoolingSettings] = useState({
    visibility: DEFAULT_COOLING_VISIBILITY,
    color: DEFAULT_COOLING_COLOR,
    roughness: DEFAULT_COOLING_ROUGHNESS,
  });
  const [glassSettings, setGlassSettings] = useState({
    opacity: DEFAULT_GLASS_OPACITY,
    color: DEFAULT_GLASS_COLOR,
  });
  const [floorSettings, setFloorSettings] = useState({
    dotSize: DEFAULT_FLOOR_DOT_SIZE,
    dotSpacing: DEFAULT_FLOOR_DOT_SPACING,
    dotOpacity: DEFAULT_FLOOR_DOT_OPACITY,
  });
  const [globalOpacitySettings, setGlobalOpacitySettings] = useState({
    outsideRack: 1,
    rackWithoutGpu: 1,
    maskSoftness: DEFAULT_GLOBAL_MASK_SOFTNESS,
  });

  return (
    <main className="preview-app">
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
        animationProgress={animationProgress}
        setAnimationProgress={setAnimationProgress}
      />
      <InspectorPanel
        stats={stats}
        isCollapsed={isInspectorCollapsed}
        setIsCollapsed={setIsInspectorCollapsed}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
