import { displayOpacityFromControl } from "../../utils/colors.js";
import { opacityMultiplierForBucket } from "./opacity.js";

export function updateCoolingMaterials({
  camera,
  coolingSettings,
  delta,
  globalOpacitySettings,
  materials,
}) {
  materials.forEach((material) => {
    const visibility = displayOpacityFromControl(
      opacityMultiplierForBucket(material.userData.opacityBucket, globalOpacitySettings),
    );
    material.uniforms.uTime.value += delta;
    material.uniforms.uVisibility.value = coolingSettings.visibility;
    material.uniforms.uRoughness.value = coolingSettings.roughness;
    material.uniforms.uColor.value.set(coolingSettings.color);
    material.uniforms.uGlobalOpacity.value = visibility;
    material.uniforms.uGlobalMaskSoftness.value = globalOpacitySettings.maskSoftness;
    material.uniforms.uCameraPosition.value.copy(camera.position);
  });
}
