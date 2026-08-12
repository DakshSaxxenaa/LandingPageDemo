import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { PAL, CAM, FOG, GATEWAYS, TIERS } from './config.js';
import { MAT, disposeMaterials } from './materials.js';
import { createArchitecture } from './Architecture.js';
import { createStarField } from './StarField.js';
import { createGateway } from './Gateway.js';
import { createPathway } from './Pathway.js';
import { createLighting } from './Lighting.js';
import { createCameraController } from './CameraController.js';
import { createInteraction } from './Interaction.js';
import { createTransition, applyPresence } from './Transition.js';

/* ══════════════════════════════════════════════════════════════════
   THE VAULT — orchestrator
   Owns the renderer, the frame loop and the lifecycle. Everything
   else is a module with one job. The loop only runs while the section
   is actually on screen; the rest of the site never pays for it.
   ══════════════════════════════════════════════════════════════════ */

/* Pick a quality tier from what the device tells us. Conservative on
   purpose: this is a website, and a dropped frame costs more than a
   thousand extra stars buy. */
function pickTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700;
  if (coarse || small) return (mem >= 8 && cores >= 8) ? TIERS.medium : TIERS.low;
  if (cores >= 8 && mem >= 8) return TIERS.high;
  return TIERS.medium;
}

export function createWorld({ canvas, veil, onFirstLook, onNavigate, onReady, bearing }) {
  const tier = pickTier();
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ── renderer ─────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier === TIERS.high,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false
  });
  let dprCap = tier.dpr;                 // lowered by the adaptive pass below
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(PAL.void, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ── scene ────────────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.void);
  const fog = new THREE.FogExp2(FOG.color, FOG.density);
  scene.fog = fog;
  const fogRef = { fog, base: FOG.density };

  const camera = new THREE.PerspectiveCamera(CAM.fov, innerWidth / innerHeight, CAM.near, CAM.far);

  /* ── contents ─────────────────────────────────────────────────── */
  const lighting = createLighting(scene);

  /* the single moving lamp that replaces six static ones */
  const lamp = new THREE.PointLight(PAL.light, 0, 300, 1.8);
  scene.add(lamp);
  const lampTarget = new THREE.Vector3();
  const stars = createStarField(scene, tier);
  const architecture = createArchitecture(scene, tier, GATEWAYS);

  const gateways = [];
  const pathways = [];
  for (const cfg of GATEWAYS) {
    const g = createGateway(cfg, tier, tier);
    scene.add(g.group);
    gateways.push(g);
    const p = createPathway(cfg, tier);
    scene.add(p.group);
    pathways.push(p);
  }

  /* ── post ─────────────────────────────────────────────────────── */
  let composer = null;
  if (tier.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // restrained: only the trim and the apertures cross the threshold
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight), 0.44, 0.62, 0.74
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
    composer.setSize(innerWidth, innerHeight);
  }

  /* ── control ──────────────────────────────────────────────────── */
  const controller = createCameraController(camera, canvas);
  // the observer arrives facing the one gateway that is meant to be seen
  controller.setBearing(bearing ? bearing[0] : 0, bearing ? bearing[1] : 0.03);
  if (onFirstLook) controller.onFirstLook(onFirstLook);

  const transition = createTransition({
    camera, scene, fogRef, veil,
    onNavigate: href => onNavigate ? onNavigate(href) : (location.href = href)
  });

  const interaction = createInteraction({
    dom: canvas, camera, gateways,
    onActivate: g => transition.depart(g)
  });

  /* ── loop ─────────────────────────────────────────────────────── */
  let presence = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0;
  let ready = false;

  /* ── adaptive quality ─────────────────────────────────────────────
     A website cannot assume the GPU it lands on. If the frame budget is
     being missed consistently, shed the most expensive thing first
     (bloom), then resolution. One-way: no oscillating between tiers. */
  let sampleAcc = 0, sampleN = 0, shed = 0;
  function considerShedding(dt) {
    if (dt > 0.05) return;                 // ignore stalls and tab switches
    sampleAcc += dt; sampleN++;
    if (sampleN < 90) return;
    const avg = sampleAcc / sampleN;
    sampleAcc = 0; sampleN = 0;
    if (avg < 0.026) return;               // ~38fps or better: leave it alone
    if (shed === 0 && composer) {
      composer.dispose(); composer = null; shed = 1;
    } else if (shed <= 1) {
      dprCap = 1;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
      shed = 2;
    }
  }

  function frame() {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;                 // tab-switch guard
    elapsed += dt;

    const owned = transition.update(dt);
    if (!owned) controller.update(dt, reduced ? 0 : elapsed);

    interaction.update(dt);
    controller.setSteerDamp(interaction.pointerHover ? 0.22 : 1);
    let lead = null;
    for (const g of gateways) {
      g.update(reduced ? 0 : elapsed, dt);
      if (!lead || g.active > lead.active) lead = g;
    }
    // the lamp follows attention rather than being cloned per gateway
    if (lead) {
      lampTarget.copy(lead.worldPos);
      lamp.position.lerp(lampTarget, lead.active > 0.02 ? 0.12 : 1);
      lamp.intensity = lead.active * 900 * lead.cfg.intensity;
    }
    architecture.update(reduced ? 0 : elapsed);
    stars.update(reduced ? 0 : elapsed);

    if (composer) composer.render();
    else renderer.render(scene, camera);

    considerShedding(dt);

    if (!ready) { ready = true; onReady && onReady(); }
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
  }
  addEventListener('resize', resize);

  function onVisibility() {
    if (document.hidden) stop();
    else if (presence > 0) start();
  }
  document.addEventListener('visibilitychange', onVisibility);

  /* ── public ───────────────────────────────────────────────────── */
  return {
    tier: tier === TIERS.high ? 'high' : tier === TIERS.medium ? 'medium' : 'low',

    /* scroll drives this: 0 = not here, 1 = fully arrived */
    setPresence(p) {
      const was = presence;
      presence = Math.max(0, Math.min(1, p));
      applyPresence(presence, { fogRef, lighting, stars, renderer });
      const live = presence > 0.9 && !transition.running;
      controller.setEnabled(live);
      interaction.setEnabled(live);
      if (presence > 0.001 && !document.hidden) start();
      else if (presence <= 0.001) stop();
      return was !== presence;
    },

    get interactive() { return presence > 0.9; },

    dispose() {
      stop();
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      controller.dispose();
      interaction.dispose();
      gateways.forEach(g => g.dispose());
      pathways.forEach(p => p.dispose());
      architecture.dispose();
      stars.dispose();
      lighting.dispose();
      disposeMaterials();
      if (composer) composer.dispose();
      renderer.dispose();
    }
  };
}
