import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_DOF_SETTINGS,
  createDefaultCoolingSettings,
  createDefaultFloorSettings,
  createDefaultGlassSettings,
  createDefaultGlobalOpacitySettings,
  createDefaultThermalSettings,
} from "../app/defaultState.js";

export function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") return deepMerge({}, value);
  return value;
}

export function deepMerge(base, patch) {
  const output = { ...base };
  Object.entries(patch ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = value.map(cloneValue);
      return;
    }
    if (value && typeof value === "object") {
      output[key] = deepMerge(output[key] && typeof output[key] === "object" ? output[key] : {}, value);
      return;
    }
    output[key] = value;
  });
  return output;
}

export function createDefaultExperienceState() {
  return {
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    dof: cloneValue(DEFAULT_DOF_SETTINGS),
    thermal: createDefaultThermalSettings(),
    cooling: createDefaultCoolingSettings(),
    glass: createDefaultGlassSettings(),
    floor: createDefaultFloorSettings(),
    globalOpacity: createDefaultGlobalOpacitySettings(),
  };
}

export function createExperienceState({
  backgroundColor,
  dofSettings,
  thermalSettings,
  coolingSettings,
  glassSettings,
  floorSettings,
  globalOpacitySettings,
}) {
  return {
    backgroundColor,
    dof: cloneValue(dofSettings),
    thermal: cloneValue(thermalSettings),
    cooling: cloneValue(coolingSettings),
    glass: cloneValue(glassSettings),
    floor: cloneValue(floorSettings),
    globalOpacity: cloneValue(globalOpacitySettings),
  };
}

export function stateToProps(state) {
  return {
    backgroundColor: state.backgroundColor,
    dofSettings: cloneValue(state.dof),
    thermalSettings: cloneValue(state.thermal),
    coolingSettings: cloneValue(state.cooling),
    glassSettings: cloneValue(state.glass),
    floorSettings: cloneValue(state.floor),
    globalOpacitySettings: cloneValue(state.globalOpacity),
  };
}

export function compactStatePatch(defaults, state) {
  const patch = {};

  Object.entries(state).forEach(([key, value]) => {
    const compacted = compactValue(defaults?.[key], value);
    if (compacted !== undefined) patch[key] = compacted;
  });

  return patch;
}

function compactValue(defaultValue, value) {
  if (Array.isArray(value)) {
    if (!Array.isArray(defaultValue)) return value.map(cloneValue);
    const isSameArray = value.length === defaultValue.length
      && value.every((item, index) => compactValue(defaultValue[index], item) === undefined);
    return isSameArray ? undefined : value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    const patch = {};
    Object.entries(value).forEach(([key, childValue]) => {
      const compacted = compactValue(defaultValue?.[key], childValue);
      if (compacted !== undefined) patch[key] = compacted;
    });
    return Object.keys(patch).length ? patch : undefined;
  }

  return Object.is(defaultValue, value) ? undefined : value;
}
