# Therma Dynamics Scroll Demo

Prototype for a scroll-driven thermal and wind visualization built with React, Vite, Three.js, React Three Fiber, GSAP, and Lenis.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

## How it works

- `src/main.jsx` contains the R3F scene, GLB loading, OrbitControls, GSAP/Lenis scroll progress, and custom GLSL shaders.
- `public/models/therma_dynamics.glb` is loaded as the scene source.
- Meshes using the material named `thermal` receive the shader material.
- The object named `heat` from the GLB is hidden and used as the invisible heat driver. Its GLB animation controls the source of heat.
- All GLB animation clips are played through one scrubbed mixer timeline, driven from 0% to 100% by page scroll.
- Meshes using the material named `wind` receive a directional wind shader. During the third scroll section, its opacity fades from 0% to 100%.
- Distance from the heat driver controls the surface temperature, simulating heat pushing from inside to outside.

## Why custom shaders

R3F can absolutely handle the experience. You could fake a simpler version with standard materials, textures, or post-processing, but a convincing thermal field that reacts to proximity is much easier and cleaner with a custom shader. The shader lets you control color by surface position, heat-object distance, animated bands, edge glow, and temperature interpolation in one material.
