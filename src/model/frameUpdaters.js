import { updateCoolingMaterials } from "./frameUpdaters/cooling.js";
import { updateFloorMaterials } from "./frameUpdaters/floor.js";
import { updateGlassMaterials } from "./frameUpdaters/glass.js";
import { updateOpacityMaterials } from "./frameUpdaters/opacity.js";
import { updateSourceCamera } from "./frameUpdaters/sourceCamera.js";
import { updateThermalMaterials } from "./frameUpdaters/thermal.js";
import { updateHeatBounds } from "./heatInfluence.js";

export { updateSourceCamera };

export function updatePreviewFrame({
  camera,
  coolingSettings,
  delta,
  floorSettings,
  glassSettings,
  globalOpacitySettings,
  heatBounds,
  heatObject,
  materials,
  thermalSettings,
}) {
  updateHeatBounds(heatObject, heatBounds);
  updateThermalMaterials({
    camera,
    delta,
    globalOpacitySettings,
    heatBounds,
    heatObject,
    materials: materials.thermal,
    thermalSettings,
  });
  updateFloorMaterials(materials.floor, floorSettings);
  updateCoolingMaterials({
    camera,
    coolingSettings,
    delta,
    globalOpacitySettings,
    materials: materials.cooling,
  });
  updateGlassMaterials(materials.glass, glassSettings, globalOpacitySettings);
  updateOpacityMaterials({
    delta,
    globalOpacitySettings,
    materials: materials.opacity,
  });
}
