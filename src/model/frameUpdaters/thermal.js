import { displayOpacityFromControl } from "../../utils/colors.js";
import { heatInfluenceForNode } from "../heatInfluence.js";
import { opacityMultiplierForBucket } from "./opacity.js";

export function updateThermalMaterials({
  camera,
  delta,
  globalOpacitySettings,
  heatBounds,
  heatObject,
  materials,
  thermalSettings,
}) {
  materials.forEach((material) => {
    const visibility = displayOpacityFromControl(
      opacityMultiplierForBucket(material.userData.opacityBucket, globalOpacitySettings),
    );
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
    material.uniforms.uHeatCenter.value.copy(heatBounds.center);
    material.uniforms.uHeatHalfSize.value.copy(heatBounds.halfSize);
    material.uniforms.uThermalState.value = heatInfluenceForNode(
      material.userData.heatInfluenceNode ?? material.userData.renderNode,
      heatObject,
      heatBounds,
      thermalSettings.heatFalloff,
    );
    material.transparent = false;
    material.depthWrite = true;
    material.depthTest = true;
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
}
