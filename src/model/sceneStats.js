function readInstanceCount(mesh) {
  if (mesh.isInstancedMesh) return mesh.count;
  return 1;
}

export function collectSceneStats(gltf) {
  const json = gltf.parser?.json ?? {};
  const instancedJsonNodes = (json.nodes ?? []).filter((node) => node.extensions?.EXT_mesh_gpu_instancing);
  const extensionNames = json.extensionsUsed ?? [];
  const materialNames = (json.materials ?? []).map((material) => material.name || "(unnamed)");
  const meshNames = (json.meshes ?? []).map((mesh, index) => mesh.name || `mesh_${index}`);

  const runtime = {
    meshes: 0,
    instancedMeshes: 0,
    instanceCount: 0,
    triangles: 0,
    materials: new Map(),
    objects: 0,
  };

  gltf.scene.traverse((node) => {
    runtime.objects += 1;
    if (!node.isMesh && !node.isInstancedMesh) return;

    runtime.meshes += 1;
    if (node.isInstancedMesh) runtime.instancedMeshes += 1;
    runtime.instanceCount += readInstanceCount(node);

    const geometry = node.geometry;
    const triangleCount = geometry?.index
      ? geometry.index.count / 3
      : (geometry?.attributes?.position?.count ?? 0) / 3;
    runtime.triangles += triangleCount * readInstanceCount(node);

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      const name = material?.name || "(unnamed)";
      runtime.materials.set(name, (runtime.materials.get(name) ?? 0) + readInstanceCount(node));
    });
  });

  return {
    generator: json.asset?.generator ?? "unknown",
    version: json.asset?.version ?? "unknown",
    extensions: extensionNames,
    instancedJsonNodes: instancedJsonNodes.map((node) => ({
      name: node.name || "(unnamed)",
      mesh: node.mesh,
      attributes: Object.keys(node.extensions.EXT_mesh_gpu_instancing.attributes ?? {}),
    })),
    materialNames,
    meshNames,
    animationCount: json.animations?.length ?? 0,
    bufferBytes: (json.buffers ?? []).reduce((sum, buffer) => sum + (buffer.byteLength ?? 0), 0),
    runtime: {
      ...runtime,
      triangles: Math.round(runtime.triangles),
      materials: Array.from(runtime.materials.entries()).map(([name, count]) => ({ name, count })),
    },
  };
}
