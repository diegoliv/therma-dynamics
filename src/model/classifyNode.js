export function materialNameIncludes(material, name) {
  if (Array.isArray(material)) {
    return material.some((entry) => entry?.name?.toLowerCase().includes(name));
  }
  return material?.name?.toLowerCase().includes(name);
}

export function isThermalMaterial(material) {
  return materialNameIncludes(material, "thermal");
}

export function isGlassMaterial(material) {
  return materialNameIncludes(material, "glass");
}

export function isCoolingMaterial(material) {
  return materialNameIncludes(material, "cooling");
}

export function isFloorMaterial(material) {
  return materialNameIncludes(material, "floor");
}

export function isCoolingObject(node) {
  const name = node.name?.toLowerCase() ?? "";
  return name.includes("cooling_plate") || name.includes("coolant");
}

export function isHeatObject(node) {
  const name = node.name?.toLowerCase() ?? "";
  return name === "heat" || name.startsWith("heat.");
}

export function getRackInfluenceNode(node) {
  let cursor = node;
  let rackNode = null;

  while (cursor) {
    const name = cursor.name?.toLowerCase() ?? "";
    if (/^rack(?:\.|$)/.test(name)) rackNode = cursor;
    cursor = cursor.parent;
  }

  return rackNode ?? node;
}

export function sourceByName(material, name) {
  if (Array.isArray(material)) {
    return material.find((entry) => entry?.name?.toLowerCase().includes(name));
  }
  return material;
}

export function getOpacityBucket(node) {
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
