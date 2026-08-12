import * as THREE from 'three';

/* ══════════════════════════════════════════════════════════════════
   TRANSITIONS
   Two of them.

   ENTRY — the world does not cut in. It resolves out of the dark as
   the user scrolls: fog thins, the light comes up, the stars arrive
   last. Driven by scroll position, so the user stays in control.

   DEPARTURE — clicking a gateway runs a short choreography: the
   aperture floods, the rest of the world falls away, the observer is
   drawn toward the opening until it fills the frame, and the route
   loads. ~900ms total. Long enough to read as cinema, short enough
   that nobody waits for a page.
   ══════════════════════════════════════════════════════════════════ */

const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeIn = t => t * t * t;

export function createTransition({ camera, scene, fogRef, onNavigate, veil }) {
  const startPos = new THREE.Vector3();
  const startQuat = new THREE.Quaternion();
  const targetQuat = new THREE.Quaternion();
  const aim = new THREE.Vector3();
  const tmp = new THREE.Object3D();

  const DURATION = 0.9;
  let running = null;

  return {
    get running() { return !!running; },

    /* ── departure ──────────────────────────────────────────────── */
    depart(gateway) {
      if (running) return;
      running = { g: gateway, t: 0, fired: false };
      startPos.copy(camera.position);
      startQuat.copy(camera.quaternion);

      // face the aperture dead on
      aim.copy(gateway.worldPos);
      tmp.position.copy(camera.position);
      tmp.lookAt(aim);
      targetQuat.copy(tmp.quaternion);
    },

    /* Returns true while it owns the camera, so World knows to skip
       the controller for this frame. */
    update(dt) {
      if (!running) return false;
      const r = running;
      r.t = Math.min(1, r.t + dt / DURATION);
      const k = easeInOut(r.t);

      // the chosen gateway floods; everything else is abandoned
      r.g.setActive(1);

      // the observer is drawn in — the arm extends toward the aperture
      // rather than the whole rig flying, so it reads as being pulled
      camera.position.lerpVectors(startPos, aim, easeIn(r.t) * 0.82);
      camera.quaternion.slerpQuaternions(startQuat, targetQuat, k);

      // the world falls away around the opening
      if (fogRef.fog) fogRef.fog.density = fogRef.base * (1 + easeIn(r.t) * 9);
      if (veil) veil.style.opacity = String(Math.max(0, (r.t - 0.55) / 0.45));

      if (r.t >= 1 && !r.fired) {
        r.fired = true;
        onNavigate(r.g.cfg.href);
      }
      return true;
    },

    cancel() {
      running = null;
      if (veil) veil.style.opacity = '0';
      if (fogRef.fog) fogRef.fog.density = fogRef.base;
    }
  };
}

/* ── entry ──────────────────────────────────────────────────────────
   `presence` runs 0 → 1 as the user scrolls into the section. Every
   layer arrives on its own curve so the world assembles in depth:
   fog first, then architecture, then the sky. */
export function applyPresence(p, { fogRef, lighting, stars, renderer }) {
  const e = easeInOut(Math.max(0, Math.min(1, p)));

  // fog starts near-opaque and clears — the world emerges from it
  if (fogRef.fog) fogRef.fog.density = fogRef.base * (1 + (1 - e) * 14);

  lighting.setPresence(e);
  // the sky is last to arrive, which keeps the architecture the subject
  stars.setOpacity(Math.max(0, (e - 0.35) / 0.65));
  renderer.toneMappingExposure = 0.15 + e * 0.95;
}
