import { displayOpacityFromControl } from "../../utils/colors.js";

export function opacityMultiplierForBucket(bucket, globalOpacitySettings) {
  if (bucket === "outside") return globalOpacitySettings.outsideRack;
  if (bucket === "rack") return globalOpacitySettings.rackWithoutGpu;
  return 1;
}

export function updateOpacityMaterials({ coolingSettings, delta, globalOpacitySettings, materials }) {
  materials.forEach((material) => {
    if (material.isShaderMaterial) return;
    if (material.userData.isGlassPreview) return;
    if (material.userData.isCoolingPreview) return;

    const visibility = displayOpacityFromControl(
      opacityMultiplierForBucket(material.userData.opacityBucket, globalOpacitySettings),
    );
    const baseOpacity = material.userData.baseOpacity ?? material.opacity ?? 1;
    material.opacity = baseOpacity;
    material.transparent = material.userData.baseTransparent;
    material.depthWrite = true;
    if (material.userData.globalVisibilityUniform) {
      material.userData.globalVisibilityUniform.value = visibility;
    }
    if (material.userData.localVisibilityUniform) {
      material.userData.localVisibilityUniform.value = material.userData.useCoolingVisibilityMask
        ? coolingSettings.visibility
        : 1;
    }
    if (material.userData.globalMaskSoftnessUniform) {
      material.userData.globalMaskSoftnessUniform.value = globalOpacitySettings.maskSoftness;
    }
    if (material.userData.globalDissolveTimeUniform) {
      material.userData.globalDissolveTimeUniform.value += delta;
    }
  });
}
