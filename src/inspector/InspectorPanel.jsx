import { formatBytes } from "../utils/format.js";
import { Stat } from "./Stat.jsx";

export function InspectorPanel({ stats, isCollapsed, setIsCollapsed }) {
  const hasGpuInstancing = stats?.extensions?.includes("EXT_mesh_gpu_instancing");

  return (
    <aside className={`inspector ${isCollapsed ? "collapsed" : ""}`}>
      <button
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Show GLB preview panel" : "Hide GLB preview panel"}
        className="panel-toggle"
        onClick={() => setIsCollapsed((value) => !value)}
        type="button"
      >
        {isCollapsed ? "Show GLB preview" : "Hide"}
      </button>

      <div className="brand">
        <span>GLB Preview</span>
        <strong>Therma Dynamics v2</strong>
      </div>

      <div className={`status ${hasGpuInstancing ? "ok" : "warn"}`}>
        <span />
        {hasGpuInstancing ? "EXT_mesh_gpu_instancing detected" : "No GPU instancing extension found"}
      </div>

      <div className="stats-grid">
        <Stat label="GLB buffer" value={formatBytes(stats?.bufferBytes ?? 0)} />
        <Stat label="Runtime meshes" value={stats?.runtime.meshes ?? "-"} />
        <Stat label="Instanced meshes" value={stats?.runtime.instancedMeshes ?? "-"} />
        <Stat label="Drawn instances" value={stats?.runtime.instanceCount ?? "-"} />
        <Stat label="JSON instance nodes" value={stats?.instancedJsonNodes.length ?? "-"} />
        <Stat label="Materials" value={stats?.materialNames.length ?? "-"} />
        <Stat label="Animations" value={stats?.animationCount ?? "-"} />
        <Stat label="Timeline" value={`${(stats?.animationDuration ?? 0).toFixed(2)}s`} />
      </div>

      <section>
        <h2>Materials</h2>
        <ul className="chips">
          {(stats?.runtime.materials ?? []).map((material) => (
            <li key={material.name}>
              <span>{material.name}</span>
              <strong>{material.count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Instanced nodes</h2>
        <div className="node-list">
          {(stats?.instancedJsonNodes ?? []).map((node) => (
            <div key={`${node.name}-${node.mesh}`}>
              <strong>{node.name}</strong>
              <span>mesh {node.mesh} - {node.attributes.join(", ")}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="footnote">
        Generator: {stats?.generator ?? "loading"} - glTF {stats?.version ?? "-"}
      </p>
    </aside>
  );
}
