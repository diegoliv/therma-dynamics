import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { LinearFilter, Vector2 } from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

const DOF_MAX_BLUR_LIMIT = 0.032;
const DOF_APERTURE_LIMIT = 0.018;

function clampDofSettings(settings) {
  return {
    aperture: Math.min(settings.aperture, DOF_APERTURE_LIMIT),
    focus: settings.focus,
    maxblur: Math.min(settings.maxblur, DOF_MAX_BLUR_LIMIT),
  };
}

function materialShouldSkipDofDepth(material) {
  if (!material) return true;
  return (
    material.visible === false ||
    material.colorWrite === false ||
    material.depthWrite === false ||
    material.opacity <= 0 ||
    material.userData?.isFloorPreview ||
    material.userData?.isGlassPreview ||
    material.userData?.isHeatDriver
  );
}

function objectShouldSkipDofDepth(object) {
  if (!object.isMesh && !object.isInstancedMesh) return false;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.some(materialShouldSkipDofDepth);
}

function hideObjectsSkippedByDofDepth(scene) {
  const hiddenObjects = [];
  scene.traverse((object) => {
    if (!object.visible || !objectShouldSkipDofDepth(object)) return;
    hiddenObjects.push(object);
    object.visible = false;
  });

  return () => {
    hiddenObjects.forEach((object) => {
      object.visible = true;
    });
  };
}

class FilteredBokehPass extends BokehPass {
  constructor(scene, camera, params) {
    super(scene, camera, params);
    this._renderTargetDepth.texture.minFilter = LinearFilter;
    this._renderTargetDepth.texture.magFilter = LinearFilter;
    this._renderTargetDepth.texture.needsUpdate = true;
    this.uniforms.depthTexel = { value: new Vector2(1, 1) };
    this.materialBokeh.fragmentShader = this.materialBokeh.fragmentShader
      .replace("uniform float aspect;", "uniform float aspect;\n\t\tuniform vec2 depthTexel;")
      .replace(
        "float getViewZ( const in float depth ) {\n\t\t\t#if PERSPECTIVE_CAMERA == 1\n\t\t\treturn perspectiveDepthToViewZ( depth, nearClip, farClip );\n\t\t\t#else\n\t\t\treturn orthographicDepthToViewZ( depth, nearClip, farClip );\n\t\t\t#endif\n\t\t}",
        `float getViewZ( const in float depth ) {
\t\t\t#if PERSPECTIVE_CAMERA == 1
\t\t\treturn perspectiveDepthToViewZ( depth, nearClip, farClip );
\t\t\t#else
\t\t\treturn orthographicDepthToViewZ( depth, nearClip, farClip );
\t\t\t#endif
\t\t}

\t\tfloat getSmoothedViewZ( const in vec2 uv ) {
\t\t\tvec2 dx = vec2( depthTexel.x, 0.0 );
\t\t\tvec2 dy = vec2( 0.0, depthTexel.y );
\t\t\tfloat viewZ = getViewZ( getDepth( uv ) ) * 0.36;
\t\t\tviewZ += getViewZ( getDepth( uv + dx ) ) * 0.12;
\t\t\tviewZ += getViewZ( getDepth( uv - dx ) ) * 0.12;
\t\t\tviewZ += getViewZ( getDepth( uv + dy ) ) * 0.12;
\t\t\tviewZ += getViewZ( getDepth( uv - dy ) ) * 0.12;
\t\t\tviewZ += getViewZ( getDepth( uv + dx + dy ) ) * 0.04;
\t\t\tviewZ += getViewZ( getDepth( uv - dx + dy ) ) * 0.04;
\t\t\tviewZ += getViewZ( getDepth( uv + dx - dy ) ) * 0.04;
\t\t\tviewZ += getViewZ( getDepth( uv - dx - dy ) ) * 0.04;
\t\t\treturn viewZ;
\t\t}`
      )
      .replace("float viewZ = getViewZ( getDepth( vUv ) );", "float viewZ = getSmoothedViewZ( vUv );");
    this.materialBokeh.needsUpdate = true;
  }

  setSize(width, height) {
    super.setSize(width, height);
    this.uniforms.depthTexel.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
  }

  render(renderer, writeBuffer, readBuffer) {
    renderer.getClearColor(this._oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    this.scene.overrideMaterial = this._materialDepth;
    const restoreDepthVisibility = hideObjectsSkippedByDofDepth(this.scene);

    try {
      renderer.setClearColor(0xffffff);
      renderer.setClearAlpha(1);
      renderer.setRenderTarget(this._renderTargetDepth);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      restoreDepthVisibility();
      this.scene.overrideMaterial = null;
    }

    this.uniforms.tColor.value = readBuffer.texture;
    this.uniforms.nearClip.value = this.camera.near;
    this.uniforms.farClip.value = this.camera.far;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      this._fsQuad.render(renderer);
    }

    renderer.setClearColor(this._oldClearColor);
    renderer.setClearAlpha(oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }
}

export function BokehDepthOfField({ settings }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const bokehPassRef = useRef();
  const fxaaPassRef = useRef();

  useEffect(() => {
    const clampedSettings = clampDofSettings(settings);
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bokehPass = new FilteredBokehPass(scene, camera, {
      focus: clampedSettings.focus,
      aperture: clampedSettings.aperture,
      maxblur: clampedSettings.maxblur,
    });
    const fxaaPass = new ShaderPass(FXAAShader);

    composer.addPass(renderPass);
    composer.addPass(bokehPass);
    composer.addPass(fxaaPass);
    composerRef.current = composer;
    bokehPassRef.current = bokehPass;
    fxaaPassRef.current = fxaaPass;

    return () => {
      composer.dispose();
      bokehPass.dispose();
      fxaaPass.dispose();
      composerRef.current = null;
      bokehPassRef.current = null;
      fxaaPassRef.current = null;
    };
  }, [camera, gl, scene]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    const width = Math.max(1, Math.floor(size.width * pixelRatio));
    const height = Math.max(1, Math.floor(size.height * pixelRatio));
    composerRef.current?.setSize(width, height);
    bokehPassRef.current?.setSize(width, height);
    fxaaPassRef.current?.uniforms.resolution.value.set(1 / width, 1 / height);
  }, [gl, size.height, size.width]);

  useFrame(() => {
    const composer = composerRef.current;
    const bokehPass = bokehPassRef.current;
    if (!settings.enabled || !composer || !bokehPass) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }

    const clampedSettings = clampDofSettings(settings);
    bokehPass.uniforms.focus.value = clampedSettings.focus;
    bokehPass.uniforms.aperture.value = clampedSettings.aperture;
    bokehPass.uniforms.maxblur.value = clampedSettings.maxblur;
    composer.render();
  }, 1);

  return null;
}
