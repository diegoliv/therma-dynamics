import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";

export function BokehDepthOfField({ settings }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const bokehPassRef = useRef();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bokehPass = new BokehPass(scene, camera, {
      focus: settings.focus,
      aperture: settings.aperture,
      maxblur: settings.maxblur,
    });

    composer.addPass(renderPass);
    composer.addPass(bokehPass);
    composerRef.current = composer;
    bokehPassRef.current = bokehPass;

    return () => {
      composer.dispose();
      bokehPass.dispose();
      composerRef.current = null;
      bokehPassRef.current = null;
    };
  }, [camera, gl, scene, settings.aperture, settings.focus, settings.maxblur]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    const width = Math.max(1, Math.floor(size.width * pixelRatio));
    const height = Math.max(1, Math.floor(size.height * pixelRatio));
    composerRef.current?.setSize(width, height);
    bokehPassRef.current?.setSize(width, height);
  }, [gl, size.height, size.width]);

  useFrame(() => {
    const composer = composerRef.current;
    const bokehPass = bokehPassRef.current;
    if (!settings.enabled || !composer || !bokehPass) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }

    bokehPass.uniforms.focus.value = settings.focus;
    bokehPass.uniforms.aperture.value = settings.aperture;
    bokehPass.uniforms.maxblur.value = settings.maxblur;
    composer.render();
  }, 1);

  return null;
}
