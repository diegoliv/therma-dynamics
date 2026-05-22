import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export function PerformanceProbe({ enabled, onUpdate }) {
  const { gl } = useThree();
  const statsRef = useRef({
    frames: 0,
    minFps: Infinity,
    maxFrameMs: 0,
    startedAt: performance.now(),
    previousFrameAt: performance.now(),
  });

  useFrame(() => {
    if (!enabled || !onUpdate) return;

    const now = performance.now();
    const stats = statsRef.current;
    const frameMs = now - stats.previousFrameAt;
    stats.previousFrameAt = now;
    stats.frames += 1;
    stats.maxFrameMs = Math.max(stats.maxFrameMs, frameMs);

    const elapsed = now - stats.startedAt;
    if (elapsed < 1000) return;

    const fps = (stats.frames * 1000) / elapsed;
    stats.minFps = Math.min(stats.minFps, fps);
    onUpdate({
      fps,
      frameMs: 1000 / Math.max(fps, 0.0001),
      maxFrameMs: stats.maxFrameMs,
      minFps: stats.minFps,
      dpr: gl.getPixelRatio(),
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    });

    stats.frames = 0;
    stats.maxFrameMs = 0;
    stats.startedAt = now;
  });

  return null;
}
