export function updateFloorMaterials(materials, floorSettings) {
  materials.forEach((material) => {
    material.uniforms.uDotSize.value = floorSettings.dotSize;
    material.uniforms.uDotSpacing.value = floorSettings.dotSpacing;
    material.uniforms.uDotOpacity.value = floorSettings.dotOpacity;
    material.transparent = true;
    material.depthWrite = false;
  });
}
