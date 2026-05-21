import * as THREE from "three";

export function getMaterialBaseColor(material) {
  if (material?.color?.isColor) return material.color.clone();
  return new THREE.Color("#0007cc");
}

export function colorsFromHexList(colors) {
  return colors.map((color) => new THREE.Color(color));
}

export function displayOpacityFromControl(rawOpacity) {
  return THREE.MathUtils.clamp(rawOpacity, 0, 1);
}
