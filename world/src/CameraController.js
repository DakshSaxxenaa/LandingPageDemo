import * as THREE from 'three';
import { CAM } from './config.js';

/* ══════════════════════════════════════════════════════════════════
   THE OBSERVER
   The user owns the look direction and nothing else. They never walk.

   The camera is mounted on a short arm rather than pinned at a point:
   the eye swings on a ~5u radius around a fixed neck joint as it turns.
   That small translation is the entire reason the world reads as
   three-dimensional — pure rotation would move every distance band in
   lockstep and the space would collapse into a panorama.

   Input contract — nothing here needs a button held down:
     cursor    move the mouse; distance from centre steers the turn,
               height in the frame sets the tilt. No dragging.
     touch     swipe. A horizontal-ish swipe takes the camera, a
               vertical one is left to the page so the reader is never
               trapped at the bottom of the document.
     keyboard  arrows / WASD, so the world is not pointer-only.
   ══════════════════════════════════════════════════════════════════ */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function createCameraController(camera, dom) {
  const neck = new THREE.Vector3(0, CAM.height, 0);
  const dir = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  let yaw = 0, pitch = 0.02;
  let yawT = 0, pitchT = 0.02;
  let vYaw = 0, vPitch = 0;          // released-swipe inertia
  let enabled = false;
  let hintFired = false;
  let steerDamp = 1;                 // eased down while a gateway is hovered

  const keys = new Set();
  const listeners = { firstLook: [] };

  function firstLook() {
    if (hintFired) return;
    hintFired = true;
    listeners.firstLook.forEach(f => f());
  }

  /* ── cursor steering ──────────────────────────────────────────────
     No button, no drag. The cursor's offset from the centre of the
     frame is a *rate*: near the middle nothing happens, and the further
     out it sits the faster the world turns, so every bearing is
     reachable without the pointer ever leaving the window. Tilt is
     absolute instead — the vertical range is small enough that mapping
     it straight to cursor height reads as looking, and it self-centres. */
  let curX = 0, curY = 0, cursorIn = false;

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;     // touch has its own path
    const r = dom.getBoundingClientRect();
    curX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    curY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cursorIn = true;
  }
  function onPointerLeave() { cursorIn = false; }

  /* ── touch ────────────────────────────────────────────────────────
     One finger, and the direction of the first few pixels decides who
     owns the gesture. Horizontal is the camera's; vertical is the
     page's, and is handed straight back to the browser — which is why
     the canvas keeps `touch-action: pan-y`. Once a swipe is claimed for
     the camera it drives both axes, so you can arc up and around in one
     motion. */
  const NONE = 0, UNDECIDED = 1, LOOK = 2, PAGE = 3;
  const INTENT = 8;                  // px of travel before we commit
  let tMode = NONE, tx = 0, ty = 0, sx = 0, sy = 0;

  function mid(t) {
    if (t.length > 1) {
      return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
    }
    return { x: t[0].clientX, y: t[0].clientY };
  }

  function onTouchStart(e) {
    if (!enabled || !e.touches.length) return;
    tMode = UNDECIDED;
    const m = mid(e.touches);
    tx = sx = m.x; ty = sy = m.y;
  }
  function onTouchMove(e) {
    if (!enabled || tMode === NONE || !e.touches.length) return;
    const m = mid(e.touches);

    if (tMode === UNDECIDED) {
      const dx = Math.abs(m.x - sx), dy = Math.abs(m.y - sy);
      if (Math.max(dx, dy) < INTENT) return;   // not yet a gesture
      tMode = dx > dy ? LOOK : PAGE;
      tx = m.x; ty = m.y;
      if (tMode === PAGE) return;
    }
    if (tMode === PAGE) return;                // the document is scrolling

    e.preventDefault();
    look((m.x - tx) * 1.5, (m.y - ty) * 1.5);
    tx = m.x; ty = m.y;
  }
  function onTouchEnd(e) {
    if (e.touches && e.touches.length) {       // a finger left, others remain
      const m = mid(e.touches);
      tx = m.x; ty = m.y;
      return;
    }
    tMode = NONE;
  }

  /* Grab semantics for swipes, the way every panorama viewer works: the
     world follows the finger. Swipe right and the view swings left to
     reveal what was there; swipe down and it tilts up toward the sky. */
  function look(dx, dy) {
    yawT -= dx * CAM.dragSpeed;
    pitchT = clamp(pitchT + dy * CAM.dragSpeed * 0.82, CAM.pitchMin, CAM.pitchMax);
    vYaw = -dx * CAM.dragSpeed * 0.4;
    vPitch = dy * CAM.dragSpeed * 0.3;
    firstLook();
  }

  /* ── keyboard ──────────────────────────────────────────────────── */
  const LOOK_KEYS = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1]
  };
  function onKeyDown(e) {
    if (!enabled) return;
    const k = LOOK_KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    keys.add(e.key);
    firstLook();
  }
  function onKeyUp(e) { keys.delete(e.key); }

  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerleave', onPointerLeave);
  dom.addEventListener('touchstart', onTouchStart, { passive: true });
  dom.addEventListener('touchmove', onTouchMove, { passive: false });
  dom.addEventListener('touchend', onTouchEnd, { passive: true });
  dom.addEventListener('touchcancel', onTouchEnd, { passive: true });
  dom.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get enabled() { return enabled; },

    setEnabled(v) {
      enabled = v;
      // kill the flick too: if the reader scrolls away mid-gesture the
      // camera should stop, not keep gliding through a fading world
      if (!v) { tMode = NONE; cursorIn = false; keys.clear(); vYaw = vPitch = 0; }
    },
    /* the world eases its turn while the cursor is resting on a gateway,
       so nobody has to chase a moving target to click one */
    setSteerDamp(k) { steerDamp = k; },
    onFirstLook(fn) { listeners.firstLook.push(fn); },

    /* Aim the observer at a bearing — used by the entry choreography.
       Clears the flick too, or leftover inertia immediately drags the
       camera back off the bearing we just set. */
    setBearing(y, p) { yaw = yawT = y; pitch = pitchT = p; vYaw = vPitch = 0; },

    update(dt, t) {
      if (enabled && keys.size) {
        for (const k of keys) {
          // keys steer the camera directly rather than grabbing the world,
          // so right means turn right
          const [kx, ky] = LOOK_KEYS[k];
          yawT += kx * CAM.keySpeed * dt;
          pitchT = clamp(pitchT - ky * CAM.keySpeed * dt * 0.55, CAM.pitchMin, CAM.pitchMax);
        }
      }

      // cursor steering: a rate on yaw, an absolute position on pitch
      if (enabled && cursorIn && tMode === NONE) {
        const dz = CAM.deadZone;
        const off = (Math.abs(curX) - dz) / (1 - dz);
        if (off > 0) {
          // squared response: precise near the middle, quick at the edge
          yawT += Math.sign(curX) * off * off * CAM.steerRate * steerDamp * dt;
          firstLook();
        }
        const up = clamp(-curY, -1, 1);
        pitchT = clamp(up >= 0 ? up * CAM.pitchMax : up * -CAM.pitchMin,
                       CAM.pitchMin, CAM.pitchMax);
      }

      // inertia after a swipe, then a very slow settle
      if (tMode === NONE && !keys.size) {
        yawT += vYaw;
        pitchT = clamp(pitchT + vPitch, CAM.pitchMin, CAM.pitchMax);
        vYaw *= 0.9; vPitch *= 0.9;
        if (Math.abs(vYaw) < 1e-5) vYaw = 0;
        if (Math.abs(vPitch) < 1e-5) vPitch = 0;
      }

      yaw += (yawT - yaw) * CAM.damping;
      pitch += (pitchT - pitch) * CAM.damping;

      // barely-perceptible breathing so a parked camera is not dead
      const bY = Math.sin(t * 0.13) * 0.0022;
      const bP = Math.cos(t * 0.097) * 0.0016;

      // breathe first, clamp after: applied the other way round the idle
      // sway can nudge pitch just past the limit it is meant to respect
      const cy = yaw + bY;
      const cp = clamp(pitch + bP, CAM.pitchMin, CAM.pitchMax);
      dir.set(
        Math.sin(cy) * Math.cos(cp),
        Math.sin(cp),
        -Math.cos(cy) * Math.cos(cp)
      );
      // the arm: eye swings forward of the joint, producing the parallax
      camera.position.copy(neck).addScaledVector(dir, CAM.neck);
      // A camera looks down its own -Z, so a yaw of θ about Y aims it at
      // azimuth -θ. Negating here keeps `yaw` in the same convention the
      // gateway azimuths use — otherwise the arm walks one way while the
      // view faces the mirror image of it.
      euler.set(cp, -cy, 0);
      camera.quaternion.setFromEuler(euler);
    },

    dispose() {
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('touchcancel', onTouchEnd);
      dom.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
  };
}
