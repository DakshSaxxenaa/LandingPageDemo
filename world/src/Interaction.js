import * as THREE from 'three';

/* ══════════════════════════════════════════════════════════════════
   INTERACTION
   Gateways respond, they do not perform. Nothing lunges at the cursor
   and nothing scales up: the structure is masonry and stays where it
   was built. What changes is the light — the aperture quickens and the
   trim gains heat, over ~300ms, and settles back just as calmly.

   Hover is raycast against a small invisible proxy at each aperture,
   not against the architecture, so grazing a distant buttress never
   lights a gateway the user is not actually looking at.
   ══════════════════════════════════════════════════════════════════ */

export function createInteraction({ dom, camera, gateways, onActivate }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const proxies = gateways.map(g => g.hit);

  let enabled = false;
  let hovered = null;
  let pointerInside = false;
  let touchStart = null;
  const levels = new Map(gateways.map(g => [g, 0]));

  function pick(clientX, clientY) {
    const r = dom.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(proxies, false)[0];
    return hit ? hit.object.userData.gateway : null;
  }

  function setHover(g) {
    if (hovered === g) return;
    hovered = g;
    dom.style.cursor = g ? 'pointer' : '';
    // announce for assistive tech without ever drawing a label
    dom.setAttribute('aria-label', g
      ? `Gateway in view: ${g.cfg.label}. Press Enter to travel there.`
      : 'Immersive navigation. Move your cursor or swipe to look around and find the gateways.');
  }

  function onPointerMove(e) {
    if (!enabled || e.pointerType === 'touch') return;
    pointerInside = true;
    setHover(pick(e.clientX, e.clientY));
  }
  function onPointerLeave() { pointerInside = false; setHover(null); }

  function onClick(e) {
    if (!enabled) return;
    const g = pick(e.clientX, e.clientY);
    if (g) onActivate(g);
  }

  /* a tap is a single finger that did not travel — two fingers belong
     to the camera, and a drag belongs to the page */
  function onTouchStart(e) {
    if (!enabled || e.touches.length !== 1) { touchStart = null; return; }
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
  }
  function onTouchEnd(e) {
    if (!enabled || !touchStart || e.touches.length) return;
    const t = e.changedTouches[0];
    const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
    const quick = performance.now() - touchStart.t < 550;
    touchStart = null;
    if (moved > 12 || !quick) return;
    const g = pick(t.clientX, t.clientY);
    if (g) { setHover(g); onActivate(g); }
  }

  /* keyboard: Enter activates whatever the observer has centred, which
     makes the world traversable with arrows alone */
  function onKeyDown(e) {
    if (!enabled || (e.key !== 'Enter' && e.key !== ' ')) return;
    const r = dom.getBoundingClientRect();
    const g = pick(r.left + r.width / 2, r.top + r.height / 2);
    if (g) { e.preventDefault(); onActivate(g); }
  }

  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerleave', onPointerLeave);
  dom.addEventListener('click', onClick);
  dom.addEventListener('touchstart', onTouchStart, { passive: true });
  dom.addEventListener('touchend', onTouchEnd, { passive: true });
  dom.addEventListener('keydown', onKeyDown);

  return {
    /* true only for a real pointer resting on a gateway — the camera
       uses it to ease off so the target is not moving under the cursor */
    get pointerHover() { return !!hovered; },
    setEnabled(v) {
      enabled = v;
      if (!v) { setHover(null); touchStart = null; }
    },
    /* centre-screen focus for touch and keyboard: whatever the observer
       has actually turned toward reads as "attended", so the world
       responds to being looked at, not only to being pointed at */
    update(dt) {
      let centred = null;
      if (enabled && !pointerInside) {
        const r = dom.getBoundingClientRect();
        centred = pick(r.left + r.width / 2, r.top + r.height / 2);
      }
      for (const g of gateways) {
        const want = (g === hovered ? 1 : 0) || (g === centred ? 0.62 : 0);
        const now = levels.get(g);
        const next = now + (want - now) * Math.min(1, dt * 6);
        levels.set(g, next);
        g.setActive(next);
      }
    },
    dispose() {
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('keydown', onKeyDown);
    }
  };
}
