export const thermalVertexShader = `
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

export const thermalFragmentShader = `
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
  uniform vec3 uHeatCenter;
  uniform vec3 uHeatHalfSize;
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

  float getThermalState() {
    vec3 q = abs(vWorldPosition - uHeatCenter) - max(uHeatHalfSize, vec3(0.0001));
    vec3 outside = max(q, vec3(0.0));
    float outsideDistance = length(outside);
    bool inside = max(max(q.x, q.y), q.z) <= 0.0;
    if (inside) return 1.0;

    float falloff = max(uHeatFalloff, 0.0001);
    float t = clamp(outsideDistance / falloff, 0.0, 1.0);
    float heatSmooth = t * t * (3.0 - 2.0 * t);
    return 1.0 - heatSmooth;
  }

  float thermalResponse(float t, vec3 noisePosition, float thermalState) {
    float broadNoise = valueNoise(noisePosition * 8.0 + vec3(0.0, uTime * 0.05, 0.0));
    float fineNoise = hash(floor(noisePosition * 145.0 + uTime * 3.0));
    float sensorNoise = (broadNoise - 0.5) * uThermalNoise + (fineNoise - 0.5) * uThermalNoise * 0.58;
    t = clamp(t + sensorNoise, 0.0, 1.0);
    t = clamp((t - 0.5) * uThermalContrast + 0.5, 0.0, 1.0);
    t = pow(t, mix(1.16, 0.72, thermalState));

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
    float thermalState = getThermalState();
    vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
    vec3 lightDirection = normalize(vec3(-0.35, 0.62, 0.7));

    vec2 faceUv = faceCoordinates(vObjectPosition, vObjectNormal);
    float edgeMask = edgeProximity(faceUv);
    float faceCore = blurredInsetThermalMap(faceUv);
    float internalPulse = 0.045 * sin(uTime * 1.4 + vObjectPosition.x * 2.2 + vObjectPosition.y * 1.7);
    float surfaceNoise = valueNoise(vWorldPosition * 3.35 + vec3(1.7, uTime * 0.025, 4.2));
    float speckle = hash(floor(vWorldPosition * 78.0));
    float edgeHeat = edgeMask * uHotEdge * (0.34 + thermalState * 0.66);
    float thermalAmount = clamp(faceCore + internalPulse * faceCore + edgeHeat, 0.0, 1.0);
    thermalAmount = clamp(thermalAmount + (surfaceNoise - 0.5) * 0.13 + (speckle - 0.5) * 0.035, 0.0, 1.0);
    thermalAmount = thermalResponse(thermalAmount, vWorldPosition, thermalState);
    float centerHeat = pow(thermalAmount, 0.45);
    float centerCold = pow(thermalAmount, 0.58);
    vec3 thermalColor = mix(sampleCold(centerCold), sampleHeat(centerHeat), thermalState);

    float diffuse = max(dot(worldNormal, lightDirection), 0.0);
    float fresnel = pow(1.0 - max(dot(worldNormal, viewDirection), 0.0), 2.4);
    vec3 edgeColor = uBaseColor * (0.66 + diffuse * 0.34);
    edgeColor += vec3(0.05, 0.1, 0.24) * fresnel * 0.42;

    float coreMix = thermalAmount * uCoreStrength;
    vec3 color = mix(edgeColor, thermalColor, coreMix);
    color += thermalColor * thermalAmount * 0.28;
    color += sampleHeat(0.86) * edgeMask * thermalAmount * uHotEdge * 0.36;
    color += mix(uColdColors[2], uHeatColors[2], thermalState) * fresnel * 0.22;
    float hotRadiance = smoothstep(0.58, 1.0, thermalAmount);
    color += thermalColor * hotRadiance * uThermalRadiance;
    color += sampleHeat(1.0) * edgeMask * hotRadiance * uThermalRadiance * 0.55;
    color = pow(color, vec3(0.82));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const coolingVertexShader = `
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

export const coolingFragmentShader = `
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

export const floorVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const floorFragmentShader = `
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
