import * as THREE from 'three';
import { PAL, OCCLUDERS, DEG, place } from './config.js';
import { MAT, makeMist } from './materials.js';

/* ══════════════════════════════════════════════════════════════════
   THE STRUCTURE OF THE WORLD
   Three distance bands, which is what sells the space as real:

     near   the dais and the standing slabs (12–60u) — these swing hard
            against the background when the camera arm moves
     mid    the pathways and gateways (100–210u)
     far    colossal formations (450–2600u) — barely lit silhouettes
            that move almost not at all

   Nothing here animates. All motion in these bands comes from the
   camera arm, which is why the parallax reads as space rather than as
   an effect.
   ══════════════════════════════════════════════════════════════════ */

const _p = new THREE.Vector3(), _q = new THREE.Quaternion();
const _e = new THREE.Euler(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

function rnd(seed) {
  let a = seed;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ── the sky ───────────────────────────────────────────────────────
   Not decoration — structure. Against a flat black clear-colour every
   distant form disappears, because a dark silhouette on black is
   nothing. A shallow horizon gradient gives the far band something to
   sit against, and instantly reads as "outdoors, enormous". */
function buildSky(group) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop:    { value: new THREE.Color(0x010308) },
      uHorizon:{ value: new THREE.Color(0x0d1a2e) },
      uFloor:  { value: new THREE.Color(0x03060d) }
    },
    vertexShader: /* glsl */`
      varying float vH;
      void main(){
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform vec3 uTop, uHorizon, uFloor;
      varying float vH;
      void main(){
        vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.62, vH));
        c = mix(c, uFloor, smoothstep(0.0, -0.35, vH));
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5200, 24, 16), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -1;          // lay the ground in before anything else
  group.add(dome);
  return mat;
}

/* ── the dais: where the observer stands ─────────────────────────── */
function buildDais(group, quality) {
  const R = 12.5;
  // stepped circular terrace, each course inset and slightly shorter
  for (let i = 0; i < 4; i++) {
    const r0 = R + i * 3.4;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r0, r0 + 2.2, 2.6, Math.max(12, quality.segments), 1, true),
      MAT.stone
    );
    ring.position.y = -1.3 - i * 2.6;
    group.add(ring);
  }
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(R, Math.max(16, quality.segments)),
    new THREE.MeshStandardMaterial({ color: 0x090d13, roughness: 0.55, metalness: 0.5 })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // a single luminous rim — the only light source the observer stands in
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R - 0.4, 0.075, 5, Math.max(24, quality.segments * 2)),
    MAT.lightFaint
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.05;
  group.add(rim);

  // radial inlays pointing down each pathway: structure, not decoration
  const inlay = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.05, R * 0.8), MAT.lightFaint, 6);
  [0, 63, 129, 184, -124, -57].forEach((az, i) => {
    _p.set(Math.sin(az * DEG) * R * 0.55, 0.06, -Math.cos(az * DEG) * R * 0.55);
    _e.set(0, -az * DEG, 0);
    _q.setFromEuler(_e); _s.set(1, 1, 1);
    _m.compose(_p, _q, _s);
    inlay.setMatrixAt(i, _m);
  });
  inlay.instanceMatrix.needsUpdate = true;
  group.add(inlay);
  return floor;
}

/* ── near band: standing slabs that conceal the off-axis gateways ── */
function buildOccluders(group) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, MAT.stoneCut, OCCLUDERS.length * 2);
  let n = 0;
  OCCLUDERS.forEach((o, i) => {
    const p = place(o.az, o.r, 0);
    _p.set(p.x, o.h / 2 - 16, p.z);
    _e.set(0, -p.a, o.tilt);
    _q.setFromEuler(_e);
    _s.set(o.w, o.h, o.d);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(n++, _m);
    // a companion course at the foot, breaking the silhouette
    _p.set(p.x, -14 + o.h * 0.08, p.z);
    _s.set(o.w * 1.5, o.h * 0.16, o.d * 1.4);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(n++, _m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);

  // cold rim light down one edge of each slab, so they read as mass
  const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 0.16), MAT.lightDim, OCCLUDERS.length);
  OCCLUDERS.forEach((o, i) => {
    const p = place(o.az, o.r, 0);
    _p.set(p.x + Math.cos(p.a) * o.w * 0.5, o.h / 2 - 16, p.z + Math.sin(p.a) * o.w * 0.5);
    _e.set(0, -p.a, o.tilt);
    _q.setFromEuler(_e);
    _s.set(1, o.h * 0.62, 1);
    _m.compose(_p, _q, _s);
    trim.setMatrixAt(i, _m);
  });
  trim.instanceMatrix.needsUpdate = true;
  trim.computeBoundingSphere();
  group.add(trim);
}

/* ── far band: the world beyond the gateways ─────────────────────── */
function buildDistant(group, quality, gatewayCfgs) {
  const r = rnd(101);
  const n = quality.distant;

  // A mass this size standing on a gateway's sightline reads as a wall
  // across the composition, so the far band is kept out of every
  // approach corridor.
  const lanes = gatewayCfgs.map(c => c.az * DEG);
  const blocked = az => lanes.some(l => {
    let d = Math.abs(az - l) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d < 0.26;                       // ±15°
  });

  // colossal orthogonal masses. Unlit on purpose: at this distance they
  // are silhouettes against the sky, not surfaces. The value is lifted
  // just off black so they separate from the void without lighting cost.
  const farStone = new THREE.MeshBasicMaterial({ color: 0x0d1420, fog: true });
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), farStone, n);
  for (let i = 0; i < n; i++) {
    let az = r() * Math.PI * 2;
    for (let guard = 0; guard < 12 && blocked(az); guard++) az = r() * Math.PI * 2;
    const dist = 620 + r() * 1500;
    const h = 120 + r() * 460;
    _p.set(Math.sin(az) * dist, -60 + r() * 200, -Math.cos(az) * dist);
    _e.set(0, -az + (r() - 0.5) * 0.5, (r() - 0.5) * 0.05);
    _q.setFromEuler(_e);
    _s.set(40 + r() * 160, h, 30 + r() * 120);
    _m.compose(_p, _q, _s);
    slabs.setMatrixAt(i, _m);
  }
  slabs.instanceMatrix.needsUpdate = true;
  slabs.computeBoundingSphere();
  group.add(slabs);

  /* ── mid band ──────────────────────────────────────────────────────
     The gap the first build left: between the gateways (100–210u) and
     the far band there was nothing, so turning away from a gateway
     showed empty black. These are the outer works — lit stone, small
     enough to read as buildings, kept out of the approach corridors. */
  const outer = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.stone, quality.outer);
  for (let i = 0; i < quality.outer; i++) {
    let az = r() * Math.PI * 2;
    for (let guard = 0; guard < 12 && blocked(az); guard++) az = r() * Math.PI * 2;
    const dist = 210 + r() * 190;
    const h = 26 + r() * 90;
    _p.set(Math.sin(az) * dist, -34 + r() * 26, -Math.cos(az) * dist);
    _e.set(0, -az + (r() - 0.5) * 0.7, 0);
    _q.setFromEuler(_e);
    _s.set(10 + r() * 26, h, 9 + r() * 22);
    _m.compose(_p, _q, _s);
    outer.setMatrixAt(i, _m);
  }
  outer.instanceMatrix.needsUpdate = true;
  outer.computeBoundingSphere();
  group.add(outer);

  // two incomplete rings at true geography distance. Thin, unlit and
  // faceted — they must read as a silhouette on the horizon, never as
  // a smooth tube passing through the composition
  for (let i = 0; i < 2; i++) {
    const az = i ? 2.4 : -1.9;
    const dist = 3200 + i * 900;
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(560 + i * 240, 7, 3, 26, Math.PI * (i ? 1.1 : 0.8)),
      new THREE.MeshBasicMaterial({ color: 0x080c13 })
    );
    arc.position.set(Math.sin(az) * dist, 40 + i * 170, -Math.cos(az) * dist);
    arc.rotation.set(0.08, -az, i ? 0.85 : -0.45);
    group.add(arc);
  }

  // a single lit horizon line: the only thing suggesting a floor to it all
  const horizon = new THREE.Mesh(
    new THREE.TorusGeometry(2100, 1.6, 3, 64),
    new THREE.MeshBasicMaterial({
      color: PAL.coldBlue, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.y = -190;
  group.add(horizon);
}

/* ── atmosphere: standing fog anchored to the architecture ───────── */
function buildMist(group, gatewayCfgs) {
  const banks = [];
  const add = (az, dist, w, h, y, op) => {
    const p = place(az, dist, 0);
    const mat = makeMist(op);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(p.x, y, p.z);
    m.rotation.y = -p.a;
    group.add(m);
    banks.push(mat);
  };
  // one bank standing in front of each gateway, softening its footing
  gatewayCfgs.forEach(c => add(c.az, c.r - 34, 150, 52, c.y - 24, 0.13));
  // and three deep banks that sit between the mid and far bands. They
  // hug the floor of the world: any higher and they wash the sky flat
  add(20, 330, 900, 130, -108, 0.045);
  add(-150, 420, 900, 150, -96, 0.04);
  add(110, 380, 800, 130, -102, 0.042);
  return banks;
}

/* ── the mark ─────────────────────────────────────────────────────
   The Thomso logo, etched into the dais the observer stands on. It is
   not an overlay and it is not a billboard: it lies in the floor, at
   the observer's feet, and is only found by looking down. */
function buildMark(group, onReady) {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S; c.height = Math.round(S * (img.height / img.width));
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    // the source art is solid black; keep its alpha, replace the colour
    // with the world's silver so it reads as inlaid metal
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#b9c8d8';
    ctx.fillRect(0, 0, c.width, c.height);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const aspect = c.height / c.width;
    const w = 15;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * aspect),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.24,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, 0.09, -1.5);
    group.add(plate);
    onReady && onReady(plate);
  };
  img.onerror = () => {};       // the world is complete without it
  img.src = new URL('../../assets/source/thomso-logo-original.svg', import.meta.url).href;
}

/* ── public ───────────────────────────────────────────────────────── */
export function createArchitecture(scene, quality, gatewayCfgs) {
  const group = new THREE.Group();
  buildSky(group);
  buildDais(group, quality);
  buildOccluders(group);
  buildDistant(group, quality, gatewayCfgs);
  const banks = buildMist(group, gatewayCfgs);
  let mark = null;
  buildMark(group, p => { mark = p; });
  scene.add(group);

  return {
    group,
    update(t) {
      for (const b of banks) b.uniforms.uTime.value = t;
      if (mark) mark.material.opacity = 0.2 + Math.sin(t * 0.25) * 0.04;
    },
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.map) o.material.map.dispose();
      });
      scene.remove(group);
    }
  };
}
