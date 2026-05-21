import * as THREE from "three";

export function createAnimationTimeline(scene, animations) {
  const mixer = new THREE.AnimationMixer(scene);
  const duration = Math.max(...animations.map((clip) => clip.duration), 1);
  const actions = animations.map((clip) => {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    return { action, duration: clip.duration };
  });

  mixer.update(0);
  return { actions, duration, mixer };
}

export function updateAnimationTimeline(timeline, animationProgress) {
  const globalAnimationTime = animationProgress >= 1
    ? timeline.duration - 0.0001
    : timeline.duration * animationProgress;

  timeline.actions.forEach(({ action, duration }) => {
    const actionTime = Math.min(globalAnimationTime, duration - 0.0001);
    action.enabled = true;
    action.paused = false;
    action.time = THREE.MathUtils.clamp(actionTime, 0, Math.max(duration - 0.0001, 0));
  });
  timeline.mixer.update(0);
}
