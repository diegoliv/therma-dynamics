# Therma Dynamics Scroll Demo

Prototype for a scroll-driven thermal and wind visualization built with React, Vite, Three.js, React Three Fiber, GSAP, and Lenis.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

## Authoring and Webflow builds

The default dev app is the authoring version. It keeps the GUI, exposes the
timeline in seconds from `0` to `9`, can capture/update/delete timeline states,
exports the timeline JSON, and includes a scroll simulation mode with nine
timeline-mapped sections.

```bash
npm run build:authoring
npm run build:embed
```

`npm run build:embed` generates `dist-webflow/therma-dynamics.js`, an IIFE build
that registers `window.ThermaDynamics.mount`.

Expected Webflow structure:

```html
<div class="therma-scroll-page">
  <div class="therma-sticky-stage">
    <div id="therma-dynamics-host"></div>
  </div>
  <section class="therma-scroll-section is-short" data-therma-from="0" data-therma-to="1.5"></section>
  <section class="therma-scroll-section is-long" data-therma-from="1.5" data-therma-to="4" data-therma-start="top center" data-therma-end="bottom top"></section>
  <section class="therma-scroll-section is-medium" data-therma-from="4" data-therma-to="6"></section>
  <section class="therma-scroll-section is-long" data-therma-from="6" data-therma-to="9"></section>
</div>
```

Each `.therma-scroll-section` controls its own timeline interval through
`data-therma-from` and `data-therma-to`. Taller Webflow sections make that
interval play more slowly. By default, a section maps its interval from
`top top` to `bottom top`, so a `100vh` section interpolates over `100vh` of
scroll and a `200vh` section interpolates over `200vh`. Per-section trigger
positions can be overridden with `data-therma-start` and `data-therma-end`.

Expected Webflow mount call, after GSAP and ScrollTrigger are loaded:

```html
<script>
  window.ThermaDynamics.mount({
    container: "#therma-dynamics-host",
    configUrl: "https://your-cdn.example/therma-dynamics-timeline.json",
    publicPath: "https://your-cdn.example/",
    scrollTrigger: {
      sectionSelector: ".therma-scroll-section",
      markers: true,
      scrub: true
    }
  });
</script>
```

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
