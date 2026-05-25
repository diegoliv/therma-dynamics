import * as THREE from "three";

function getAnimationTime(timeline, animationTimeSeconds) {
  return THREE.MathUtils.clamp(
    animationTimeSeconds,
    0,
    Math.max(timeline.duration - 0.0001, 0),
  );
}

function createTrackSampler(track) {
  return {
    interpolant: track.createInterpolant(new track.ValueBufferType(track.getValueSize())),
    valueSize: track.getValueSize(),
  };
}

function createCameraSamplers(animations, sourceCameras) {
  const cameraEntries = Object.entries(sourceCameras)
    .filter(([, camera]) => camera?.name)
    .map(([key, camera]) => [key, camera.name]);

  return Object.fromEntries(cameraEntries.map(([key, cameraName]) => {
    const sampler = {
      position: null,
      quaternion: null,
    };

    animations.forEach((clip) => {
      clip.tracks.forEach((track) => {
        if (track.name === `${cameraName}.position`) {
          sampler.position = createTrackSampler(track);
        }
        if (track.name === `${cameraName}.quaternion`) {
          sampler.quaternion = createTrackSampler(track);
        }
      });
    });

    return [key, sampler];
  }));
}

export function createAnimationTimeline(scene, animations, sourceCameras = {}) {
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
  return {
    actions,
    cameraSamplers: createCameraSamplers(animations, sourceCameras),
    duration,
    mixer,
  };
}

export function updateAnimationTimeline(timeline, animationTimeSeconds) {
  const globalAnimationTime = getAnimationTime(timeline, animationTimeSeconds);

  timeline.actions.forEach(({ action, duration }) => {
    const actionTime = Math.min(globalAnimationTime, duration - 0.0001);
    action.enabled = true;
    action.paused = false;
    action.time = THREE.MathUtils.clamp(actionTime, 0, Math.max(duration - 0.0001, 0));
  });
  timeline.mixer.update(0);
}

export function updateCameraAnimationSample(timeline, cameraKey, sourceCamera, animationTimeSeconds) {
  const sampler = timeline.cameraSamplers[cameraKey];
  if (!sampler || !sourceCamera) return;

  const globalAnimationTime = getAnimationTime(timeline, animationTimeSeconds);

  if (sampler.position) {
    const position = sampler.position.interpolant.evaluate(globalAnimationTime);
    sourceCamera.position.fromArray(position);
  }

  if (sampler.quaternion) {
    const quaternion = sampler.quaternion.interpolant.evaluate(globalAnimationTime);
    sourceCamera.quaternion.fromArray(quaternion).normalize();
  }

  sourceCamera.updateMatrixWorld(true);
  return globalAnimationTime;
}
