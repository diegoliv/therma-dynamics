import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { SHOW_INSPECTOR_PANEL } from "./app/config.js";
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_DOF_SETTINGS,
  createDefaultCoolingSettings,
  createDefaultFloorSettings,
  createDefaultGlassSettings,
  createDefaultGlobalOpacitySettings,
  createDefaultThermalSettings,
} from "./app/defaultState.js";
import { GuiControls } from "./gui/GuiControls.jsx";
import { InspectorPanel } from "./inspector/InspectorPanel.jsx";
import { Viewer } from "./scene/Viewer.jsx";

function App() {
  const [stats, setStats] = useState(null);
  const [orbitEnabled, setOrbitEnabled] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [dofSettings, setDofSettings] = useState(DEFAULT_DOF_SETTINGS);
  const [thermalSettings, setThermalSettings] = useState(createDefaultThermalSettings);
  const [coolingSettings, setCoolingSettings] = useState(createDefaultCoolingSettings);
  const [glassSettings, setGlassSettings] = useState(createDefaultGlassSettings);
  const [floorSettings, setFloorSettings] = useState(createDefaultFloorSettings);
  const [globalOpacitySettings, setGlobalOpacitySettings] = useState(createDefaultGlobalOpacitySettings);

  return (
    <main className="preview-app">
      <section className="stage">
        <Viewer
          orbitEnabled={orbitEnabled}
          backgroundColor={backgroundColor}
          dofSettings={dofSettings}
          thermalSettings={thermalSettings}
          coolingSettings={coolingSettings}
          glassSettings={glassSettings}
          floorSettings={floorSettings}
          globalOpacitySettings={globalOpacitySettings}
          animationProgress={animationProgress}
          onStats={setStats}
        />
      </section>
      <GuiControls
        orbitEnabled={orbitEnabled}
        setOrbitEnabled={setOrbitEnabled}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        dofSettings={dofSettings}
        setDofSettings={setDofSettings}
        thermalSettings={thermalSettings}
        setThermalSettings={setThermalSettings}
        coolingSettings={coolingSettings}
        setCoolingSettings={setCoolingSettings}
        glassSettings={glassSettings}
        setGlassSettings={setGlassSettings}
        floorSettings={floorSettings}
        setFloorSettings={setFloorSettings}
        globalOpacitySettings={globalOpacitySettings}
        setGlobalOpacitySettings={setGlobalOpacitySettings}
        animationProgress={animationProgress}
        setAnimationProgress={setAnimationProgress}
      />
      {SHOW_INSPECTOR_PANEL && (
        <InspectorPanel
          stats={stats}
          isCollapsed={isInspectorCollapsed}
          setIsCollapsed={setIsInspectorCollapsed}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
