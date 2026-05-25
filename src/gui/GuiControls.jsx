import { useEffect, useRef } from "react";
import { DEFAULT_HEAT_FALLOFF, THERMAL_PRESETS } from "../app/config.js";

export function GuiControls({
  orbitEnabled,
  setOrbitEnabled,
  backgroundColor,
  setBackgroundColor,
  dofSettings,
  setDofSettings,
  thermalSettings,
  setThermalSettings,
  coolingSettings,
  setCoolingSettings,
  glassSettings,
  setGlassSettings,
  floorSettings,
  setFloorSettings,
  globalOpacitySettings,
  setGlobalOpacitySettings,
  timelineTime,
  setTimelineTime,
  timelineConfig,
  selectedKeyframeId,
  setSelectedKeyframeId,
  scrollSimulationEnabled,
  setScrollSimulationEnabled,
  performanceOverlayEnabled,
  setPerformanceOverlayEnabled,
  cameraParallaxAmount,
  setCameraParallaxAmount,
  desktopCameraFov,
  setDesktopCameraFov,
  mobileCameraFov,
  setMobileCameraFov,
  captureTimelineState,
  updateTimelineState,
  deleteTimelineState,
  exportTimelineConfig,
  importTimelineConfig,
}) {
  const controlsRef = useRef(null);
  const controllersRef = useRef([]);

  useEffect(() => {
    let gui;
    let isDisposed = false;
    controllersRef.current = [];

    const controls = {
      orbitEnabled,
      backgroundColor,
      dofEnabled: dofSettings.enabled,
      dofFocus: dofSettings.focus,
      dofAperture: dofSettings.aperture,
      dofMaxblur: dofSettings.maxblur,
      exportPng: () => {
        const canvas = document.querySelector(".stage canvas");
        if (!canvas) return;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `therma-canvas-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          window.setTimeout(() => {
            URL.revokeObjectURL(url);
            link.remove();
          }, 0);
        }, "image/png");
      },
      gradientSoftness: thermalSettings.gradientSoftness,
      thermalRadius: thermalSettings.radius,
      thermalContrast: thermalSettings.contrast,
      thermalNoise: thermalSettings.noise,
      thermalHotEdge: thermalSettings.hotEdge,
      thermalRadiance: thermalSettings.radiance,
      thermalHeatFalloff: thermalSettings.heatFalloff,
      heat0: thermalSettings.heatColors[0],
      heat1: thermalSettings.heatColors[1],
      heat2: thermalSettings.heatColors[2],
      heat3: thermalSettings.heatColors[3],
      cold0: thermalSettings.coldColors[0],
      cold1: thermalSettings.coldColors[1],
      cold2: thermalSettings.coldColors[2],
      cold3: thermalSettings.coldColors[3],
      coolingVisibility: coolingSettings.visibility,
      coolingColor: coolingSettings.color,
      coolingRoughness: coolingSettings.roughness,
      glassOpacity: glassSettings.opacity,
      glassColor: glassSettings.color,
      floorDotSize: floorSettings.dotSize,
      floorDotSpacing: floorSettings.dotSpacing,
      floorDotOpacity: floorSettings.dotOpacity,
      outsideRackOpacity: globalOpacitySettings.outsideRack,
      rackWithoutGpuOpacity: globalOpacitySettings.rackWithoutGpu,
      globalMaskSoftness: globalOpacitySettings.maskSoftness,
      timelineTime,
      scrollSimulationEnabled,
      performanceOverlayEnabled,
      cameraParallaxAmount,
      desktopCameraFov,
      mobileCameraFov,
      selectedKeyframeId: selectedKeyframeId || "",
      captureTimelineState,
      updateTimelineState,
      deleteTimelineState,
      exportTimelineConfig,
      importTimelineConfig,
      industrialRainbowPreset: () => applyThermalPreset(THERMAL_PRESETS.industrialRainbow),
      datacenterMagmaPreset: () => applyThermalPreset(THERMAL_PRESETS.datacenterMagma),
    };
    controlsRef.current = controls;

    const thermalControllers = [];

    const syncThermalSettings = () => {
      setThermalSettings({
        gradientSoftness: controls.gradientSoftness,
        radius: controls.thermalRadius,
        contrast: controls.thermalContrast,
        noise: controls.thermalNoise,
        hotEdge: controls.thermalHotEdge,
        radiance: controls.thermalRadiance,
        heatFalloff: controls.thermalHeatFalloff,
        heatColors: [controls.heat0, controls.heat1, controls.heat2, controls.heat3],
        coldColors: [controls.cold0, controls.cold1, controls.cold2, controls.cold3],
      });
    };

    const applyThermalPreset = (preset) => {
      controls.gradientSoftness = preset.gradientSoftness;
      controls.thermalRadius = preset.radius;
      controls.thermalContrast = preset.contrast;
      controls.thermalNoise = preset.noise;
      controls.thermalHotEdge = preset.hotEdge;
      controls.thermalHeatFalloff = DEFAULT_HEAT_FALLOFF;
      [controls.heat0, controls.heat1, controls.heat2, controls.heat3] = preset.heatColors;
      [controls.cold0, controls.cold1, controls.cold2, controls.cold3] = preset.coldColors;
      syncThermalSettings();
      thermalControllers.forEach((controller) => controller.updateDisplay());
    };

    const syncCoolingSettings = () => {
      setCoolingSettings({
        visibility: controls.coolingVisibility,
        color: controls.coolingColor,
        roughness: controls.coolingRoughness,
      });
    };

    const syncGlassSettings = () => {
      setGlassSettings({
        opacity: controls.glassOpacity,
        color: controls.glassColor,
      });
    };

    const syncFloorSettings = () => {
      setFloorSettings({
        dotSize: controls.floorDotSize,
        dotSpacing: controls.floorDotSpacing,
        dotOpacity: controls.floorDotOpacity,
      });
    };

    const syncGlobalOpacitySettings = () => {
      setGlobalOpacitySettings({
        outsideRack: controls.outsideRackOpacity,
        rackWithoutGpu: controls.rackWithoutGpuOpacity,
        maskSoftness: controls.globalMaskSoftness,
      });
    };

    const syncDofSettings = () => {
      setDofSettings({
        enabled: controls.dofEnabled,
        focus: controls.dofFocus,
        aperture: controls.dofAperture,
        maxblur: controls.dofMaxblur,
      });
    };

    async function mountGui() {
      const { default: GUI } = await import("lil-gui");
      if (isDisposed) return;

      gui = new GUI({ title: "Therma preview controls" });
      gui.add(controls, "orbitEnabled").name("Orbit controls").onChange(setOrbitEnabled);
      gui.addColor(controls, "backgroundColor").name("Background").onChange(setBackgroundColor);
      gui.add(controls, "exportPng").name("Save canvas PNG");

      const dofFolder = gui.addFolder("Depth of field");
      dofFolder.add(controls, "dofEnabled").name("Enabled").onChange(syncDofSettings);
      dofFolder.add(controls, "dofFocus", 0.1, 300, 0.5).name("Focus").onChange(syncDofSettings);
      dofFolder.add(controls, "dofAperture", 0.0001, 0.08, 0.0005).name("Aperture").onChange(syncDofSettings);
      dofFolder.add(controls, "dofMaxblur", 0.0001, 0.08, 0.0005).name("Max blur").onChange(syncDofSettings);

      const thermalFolder = gui.addFolder("Thermal shader");
      thermalFolder.add(controls, "industrialRainbowPreset").name("Preset: industrial rainbow");
      thermalFolder.add(controls, "datacenterMagmaPreset").name("Preset: datacenter magma");
      thermalControllers.push(
        thermalFolder.add(controls, "gradientSoftness", 0.08, 1.2, 0.01).name("Gradient softness").onChange(syncThermalSettings),
        thermalFolder.add(controls, "thermalRadius", 0.35, 1.35, 0.01).name("Layer radius").onChange(syncThermalSettings),
        thermalFolder.add(controls, "thermalContrast", 0.7, 2.4, 0.01).name("Camera contrast").onChange(syncThermalSettings),
        thermalFolder.add(controls, "thermalNoise", 0, 0.18, 0.005).name("Sensor noise").onChange(syncThermalSettings),
        thermalFolder.add(controls, "thermalHotEdge", 0, 0.9, 0.01).name("Hot edges").onChange(syncThermalSettings),
        thermalFolder.add(controls, "thermalRadiance", 0, 0.55, 0.005).name("Heat radiance").onChange(syncThermalSettings),
        thermalFolder.add(controls, "thermalHeatFalloff", 0.05, 5, 0.01).name("Heat falloff").onChange(syncThermalSettings),
      );

      const heatFolder = gui.addFolder("Heat gradient");
      thermalControllers.push(
        heatFolder.addColor(controls, "heat0").name("Edge").onChange(syncThermalSettings),
        heatFolder.addColor(controls, "heat1").name("Low").onChange(syncThermalSettings),
        heatFolder.addColor(controls, "heat2").name("Mid").onChange(syncThermalSettings),
        heatFolder.addColor(controls, "heat3").name("Core").onChange(syncThermalSettings),
      );

      const coldFolder = gui.addFolder("Cold gradient");
      thermalControllers.push(
        coldFolder.addColor(controls, "cold0").name("Edge").onChange(syncThermalSettings),
        coldFolder.addColor(controls, "cold1").name("Low").onChange(syncThermalSettings),
        coldFolder.addColor(controls, "cold2").name("Mid").onChange(syncThermalSettings),
        coldFolder.addColor(controls, "cold3").name("Core").onChange(syncThermalSettings),
      );

      const coolingFolder = gui.addFolder("Cooling material");
      coolingFolder.add(controls, "coolingVisibility", 0, 1, 0.01).name("Visibility mask").onChange(syncCoolingSettings);
      coolingFolder.addColor(controls, "coolingColor").name("Color").onChange(syncCoolingSettings);
      coolingFolder.add(controls, "coolingRoughness", 0, 1, 0.01).name("Roughness").onChange(syncCoolingSettings);

      const glassFolder = gui.addFolder("Glass material");
      glassFolder.add(controls, "glassOpacity", 0, 0.5, 0.005).name("Opacity").onChange(syncGlassSettings);
      glassFolder.addColor(controls, "glassColor").name("Color").onChange(syncGlassSettings);

      const floorFolder = gui.addFolder("Floor dots");
      floorFolder.add(controls, "floorDotSize", 0.001, 0.2, 0.001).name("Dot size").onChange(syncFloorSettings);
      floorFolder.add(controls, "floorDotSpacing", 0.02, 1.5, 0.005).name("Dot spacing").onChange(syncFloorSettings);
      floorFolder.add(controls, "floorDotOpacity", 0, 1, 0.01).name("Dot opacity").onChange(syncFloorSettings);

      const opacityFolder = gui.addFolder("Global visibility mask");
      opacityFolder.add(controls, "outsideRackOpacity", 0, 1, 0.01).name("Outside rack").onChange(syncGlobalOpacitySettings);
      opacityFolder.add(controls, "rackWithoutGpuOpacity", 0, 1, 0.01).name("Rack no gpu").onChange(syncGlobalOpacitySettings);
      opacityFolder.add(controls, "globalMaskSoftness", 0.001, 0.4, 0.001).name("Edge softness").onChange(syncGlobalOpacitySettings);

      const animationFolder = gui.addFolder("Animation");
      const timelineController = animationFolder
        .add(controls, "timelineTime", 0, timelineConfig.durationSeconds, 0.001)
        .name("Timeline seconds")
        .onChange(setTimelineTime);
      animationFolder
        .add(controls, "scrollSimulationEnabled")
        .name("Scroll simulation")
        .onChange(setScrollSimulationEnabled);
      animationFolder
        .add(controls, "performanceOverlayEnabled")
        .name("Performance overlay")
        .onChange(setPerformanceOverlayEnabled);
      animationFolder
        .add(controls, "cameraParallaxAmount", 0, 0.24, 0.001)
        .name("Camera parallax")
        .onChange(setCameraParallaxAmount);
      animationFolder
        .add(controls, "desktopCameraFov", 5, 80, 0.01)
        .name("Desktop FOV")
        .onChange(setDesktopCameraFov);
      animationFolder
        .add(controls, "mobileCameraFov", 5, 80, 0.01)
        .name("Mobile FOV")
        .onChange(setMobileCameraFov);
      animationFolder.add(controls, "captureTimelineState").name("Capture current state");
      animationFolder.add(controls, "updateTimelineState").name("Update selected state");
      animationFolder.add(controls, "deleteTimelineState").name("Delete selected state");
      animationFolder.add(controls, "exportTimelineConfig").name("Export timeline JSON");
      animationFolder.add(controls, "importTimelineConfig").name("Import timeline JSON");
      animationFolder
        .add(controls, "selectedKeyframeId")
        .name("Selected state")
        .onFinishChange((value) => setSelectedKeyframeId(value || null));

      thermalFolder.open();
      dofFolder.open();
      coolingFolder.open();
      glassFolder.open();
      floorFolder.open();
      opacityFolder.open();
      animationFolder.open();
      heatFolder.open();
      coldFolder.open();

      controllersRef.current = [
        ...thermalControllers,
        timelineController,
        ...gui.controllersRecursive(),
      ];
    }

    mountGui();

    return () => {
      isDisposed = true;
      gui?.destroy();
      controlsRef.current = null;
      controllersRef.current = [];
    };
  }, [timelineConfig.durationSeconds]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.orbitEnabled = orbitEnabled;
    controls.backgroundColor = backgroundColor;
    controls.dofEnabled = dofSettings.enabled;
    controls.dofFocus = dofSettings.focus;
    controls.dofAperture = dofSettings.aperture;
    controls.dofMaxblur = dofSettings.maxblur;
    controls.gradientSoftness = thermalSettings.gradientSoftness;
    controls.thermalRadius = thermalSettings.radius;
    controls.thermalContrast = thermalSettings.contrast;
    controls.thermalNoise = thermalSettings.noise;
    controls.thermalHotEdge = thermalSettings.hotEdge;
    controls.thermalRadiance = thermalSettings.radiance;
    controls.thermalHeatFalloff = thermalSettings.heatFalloff;
    [controls.heat0, controls.heat1, controls.heat2, controls.heat3] = thermalSettings.heatColors;
    [controls.cold0, controls.cold1, controls.cold2, controls.cold3] = thermalSettings.coldColors;
    controls.coolingVisibility = coolingSettings.visibility;
    controls.coolingColor = coolingSettings.color;
    controls.coolingRoughness = coolingSettings.roughness;
    controls.glassOpacity = glassSettings.opacity;
    controls.glassColor = glassSettings.color;
    controls.floorDotSize = floorSettings.dotSize;
    controls.floorDotSpacing = floorSettings.dotSpacing;
    controls.floorDotOpacity = floorSettings.dotOpacity;
    controls.outsideRackOpacity = globalOpacitySettings.outsideRack;
    controls.rackWithoutGpuOpacity = globalOpacitySettings.rackWithoutGpu;
    controls.globalMaskSoftness = globalOpacitySettings.maskSoftness;
    controls.timelineTime = timelineTime;
    controls.scrollSimulationEnabled = scrollSimulationEnabled;
    controls.performanceOverlayEnabled = performanceOverlayEnabled;
    controls.cameraParallaxAmount = cameraParallaxAmount;
    controls.desktopCameraFov = desktopCameraFov;
    controls.mobileCameraFov = mobileCameraFov;
    controls.selectedKeyframeId = selectedKeyframeId || "";
    controls.captureTimelineState = captureTimelineState;
    controls.updateTimelineState = updateTimelineState;
    controls.deleteTimelineState = deleteTimelineState;
    controls.exportTimelineConfig = exportTimelineConfig;
    controls.importTimelineConfig = importTimelineConfig;
    controllersRef.current.forEach((controller) => controller.updateDisplay());
  }, [
    backgroundColor,
    cameraParallaxAmount,
    coolingSettings,
    desktopCameraFov,
    dofSettings,
    floorSettings,
    glassSettings,
    globalOpacitySettings,
    mobileCameraFov,
    orbitEnabled,
    performanceOverlayEnabled,
    scrollSimulationEnabled,
    setCameraParallaxAmount,
    setDesktopCameraFov,
    setMobileCameraFov,
    setPerformanceOverlayEnabled,
    selectedKeyframeId,
    thermalSettings,
    timelineTime,
    captureTimelineState,
    deleteTimelineState,
    exportTimelineConfig,
    importTimelineConfig,
    updateTimelineState,
  ]);

  return null;
}
