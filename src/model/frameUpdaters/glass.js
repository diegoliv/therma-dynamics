import { opacityMultiplierForBucket } from "./opacity.js";

export function updateGlassMaterials(materials, glassSettings, globalOpacitySettings) {
  materials.forEach((material) => {
    const bucketOpacity = opacityMultiplierForBucket(material.userData.opacityBucket, globalOpacitySettings);
    material.color.set(glassSettings.color);
    material.opacity = glassSettings.opacity * bucketOpacity;
    material.transparent = true;
    material.depthWrite = false;
  });
}
