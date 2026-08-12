import * as THREE from 'three';
import { PAL } from './config.js';

/* ══════════════════════════════════════════════════════════════════
   LIGHT
   Four sources for the entire world, and none of them fills it. The
   rule is that light reveals an edge and then stops: every surface
   that is not caught by the key or the rim stays in the dark, and the
   darkness is most of the frame.

   No shadow maps. At this scale they cost more than they read, and
   the forms are separated by rim light and fog depth instead.
   ══════════════════════════════════════════════════════════════════ */

export function createLighting(scene) {
  // just enough ambient to keep the stone from going pure black
  const ambient = new THREE.AmbientLight(PAL.coldBlue, 0.9);

  // cold sky over a dead floor — this is what tints the upper faces
  const sky = new THREE.HemisphereLight(0x2b4a6c, 0x04070d, 1.15);

  // the key: high, behind the observer's left shoulder, raking across
  // the architecture so the courses and insets read as relief
  const key = new THREE.DirectionalLight(PAL.light, 2.1);
  key.position.set(-160, 220, 120);

  // the rim: opposite and much dimmer, separating silhouettes from
  // the void without lifting the shadow side
  const rim = new THREE.DirectionalLight(0x5f7fa8, 0.9);
  rim.position.set(180, 60, -220);

  scene.add(ambient, sky, key, rim);

  return {
    /* the entry choreography brings the light up with the world */
    setPresence(p) {
      ambient.intensity = 0.9 * p;
      sky.intensity = 1.15 * p;
      key.intensity = 2.1 * p;
      rim.intensity = 0.9 * p;
    },
    dispose() { scene.remove(ambient, sky, key, rim); }
  };
}
