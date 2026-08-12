import * as THREE from 'three';
import { PAL, place } from './config.js';
import { MAT, makeEnergy, makeHalo } from './materials.js';

/* ══════════════════════════════════════════════════════════════════
   GATEWAYS
   Six archetypes cut from the same three substances. They share a
   structural grammar — recessed courses, banded trim, a single lit
   aperture — so they read as one civilisation, but no two are built
   the same way.

   Everything faces the observer: a gateway placed at azimuth `a` is
   rotated by -a, which turns its local +Z back toward the dais.
   ══════════════════════════════════════════════════════════════════ */

const _v = new THREE.Vector3();

/* ── shared construction kit ────────────────────────────────────── */

/* A course of masonry swept along an arc. This is what gives every
   curved form its engraved, block-built silhouette instead of the
   smooth extruded look that makes procedural geometry read as cheap. */
function arcCourse({
  count, radius, from = 0, to = Math.PI * 2, w, h, d,
  material, taper = 0, jitter = 0.16, skip = null, seed = 1
}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const kept = [];
  for (let i = 0; i < count; i++) if (!skip || !skip(i)) kept.push(i);

  const mesh = new THREE.InstancedMesh(geo, material, kept.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const rnd = mulberry(seed);

  kept.forEach((i, n) => {
    const t = count === 1 ? 0 : i / count;
    const ang = from + (to - from) * t;
    // pushing every other block a little proud of the course is the
    // whole trick — the relief catches the rim light and the ring stops
    // looking like a torus
    const push = radius + (i % 2 ? jitter : -jitter) * 3 + (rnd() - 0.5) * jitter;
    _v.set(Math.cos(ang) * push, Math.sin(ang) * push, 0);
    e.set(0, 0, ang + Math.PI / 2);
    q.setFromEuler(e);
    const k = 1 - taper * Math.abs(Math.sin(ang));
    s.set(1, k, 1 + (rnd() - 0.5) * 0.12);
    m.compose(_v, q, s);
    mesh.setMatrixAt(n, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  // real instance bounds instead of disabling culling: only ~1/6 of this
  // world is on screen at a time, so culling is the cheapest win available
  mesh.computeBoundingSphere();
  return mesh;
}

/* Stacked, inset courses — the vocabulary every base and facade uses. */
function steppedStack({ levels, w, d, h, inset, material, y = 0 }) {
  const g = new THREE.Group();
  for (let i = 0; i < levels; i++) {
    const k = 1 - (i / levels) * inset;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w * k, h, d * k), material);
    box.position.y = y + h * (i + 0.5);
    g.add(box);
  }
  return g;
}

/* A thin luminous band. Used sparingly: one or two per gateway. */
function trim(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ── archetype: RING (Events) ─────────────────────────────────────
   Layered concentric courses around a wide aperture, planted on a
   broad terrace. The most legible silhouette in the world, which is
   why it is the one gateway facing the observer on arrival. */
function buildRing(g, cfg, q, energy) {
  const R = 21;
  g.add(arcCourse({ count: 44, radius: R, w: 3.4, h: 5.2, d: 5.4, material: MAT.stone, seed: 3 }));
  g.add(arcCourse({ count: 30, radius: R - 4.4, w: 2.2, h: 3.0, d: 3.2, material: MAT.stoneCut, jitter: 0.1, seed: 7 }));
  g.add(arcCourse({ count: 60, radius: R + 4.2, w: 1.6, h: 2.0, d: 1.8, material: MAT.metal, jitter: 0.06, seed: 11 }));

  // aperture trim: a single unbroken luminous groove
  const groove = new THREE.Mesh(new THREE.TorusGeometry(R - 6.4, 0.24, 6, q.segments), energy.trimMat);
  g.add(groove);

  // the disc of light itself, set back inside the ring
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 6.6, q.segments), energy.mat);
  disc.position.z = -1.6;
  g.add(disc);

  // buttresses tying the ring into its terrace
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(4, 30, 7), MAT.stone);
    b.position.set(s * (R + 2), -14, -1);
    b.rotation.z = s * 0.06;
    g.add(b);
  }
  g.add(steppedStack({ levels: 3, w: 62, d: 30, h: 2.4, inset: 0.3, material: MAT.stone, y: -34 }));
  return { apertureR: R - 6.6, centerY: 0 };
}

/* ── archetype: WELL (Register) ───────────────────────────────────
   A recessed square driven into a stepped mass, lit from below the
   sill so the light climbs the wall rather than facing the observer. */
function buildWell(g, cfg, q, energy) {
  const W = 21;
  g.add(steppedStack({ levels: 5, w: 96, d: 40, h: 5.0, inset: 0.46, material: MAT.stone, y: -32 }));

  // the frame, built as four recessed jambs rather than a cut hole
  const jamb = (x, y, w, h) => {
    const outer = new THREE.Mesh(new THREE.BoxGeometry(w, h, 9), MAT.stone);
    outer.position.set(x, y, 0);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.86, 10.4), MAT.stoneCut);
    inner.position.set(x, y, -0.9);
    g.add(outer, inner);
  };
  jamb(-(W + 4), 2, 8, 44);
  jamb(W + 4, 2, 8, 44);
  jamb(0, 24, 2 * (W + 8), 8);
  jamb(0, -21, 2 * (W + 8), 7);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 42), energy.mat);
  face.position.z = -1.6;
  g.add(face);

  // the sill light: the only bright edge, pointing up into the recess
  const sill = trim(W * 2, 0.5, 1.2, energy.trimMat);
  sill.position.set(0, -18.4, 1.4);
  g.add(sill);
  return { apertureR: W, centerY: 2 };
}

/* ── archetype: ARCH (Schedule) ───────────────────────────────────
   A monumental facade with a single tall opening, its head turned out
   of voussoir blocks. The tallest structure in the world. */
function buildArch(g, cfg, q, energy) {
  const W = 13, H = 30;
  // wings: layered slabs, deeply recessed, holding the darkness
  for (const s of [-1, 1]) {
    const wing = steppedStack({ levels: 4, w: 30, d: 14, h: 15, inset: 0.26, material: MAT.stone, y: -32 });
    wing.position.set(s * (W + 19), 0, -2);
    g.add(wing);
    const pil = new THREE.Mesh(new THREE.BoxGeometry(7, H + 34, 8), MAT.stone);
    pil.position.set(s * (W + 5), -8, 1);
    g.add(pil);
    const band = trim(7.4, 0.4, 8.4, energy.trimMat);
    band.position.set(s * (W + 5), 6, 1);
    g.add(band);
  }
  // the arch head
  g.add(arcCourse({
    count: 26, radius: W + 5, from: 0, to: Math.PI, w: 4.2, h: 6.4, d: 8,
    material: MAT.stone, jitter: 0.2, seed: 5
  }).translateY(H - 14));

  const opening = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, H + 12), energy.mat);
  opening.position.set(0, -1, -3.5);
  g.add(opening);

  // the light that escapes the opening, seen edge-on as a shaft
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, H + 30), energy.mat);
  shaft.position.set(0, 4, 5);
  shaft.rotation.x = -0.42;
  g.add(shaft);

  g.add(steppedStack({ levels: 4, w: 86, d: 34, h: 3, inset: 0.2, material: MAT.stone, y: -44 }));
  return { apertureR: W + 4, centerY: 0 };
}

/* ── archetype: FRACTURE (About) ──────────────────────────────────
   A ring that did not survive. Two thirds of its course is missing and
   the fragments hold their orbit — the only sustained motion in the
   world, and the reason this is the farthest, dimmest gateway. */
function buildFracture(g, cfg, q, energy) {
  const R = 19;
  const gone = i => (i > 7 && i < 14) || (i > 23 && i < 29) || i === 34;
  g.add(arcCourse({ count: 40, radius: R, w: 3.2, h: 5.6, d: 5, material: MAT.stone, skip: gone, jitter: 0.3, seed: 13 }));
  g.add(arcCourse({ count: 26, radius: R - 4, w: 2.4, h: 3.4, d: 3, material: MAT.stoneCut, skip: i => (i > 4 && i < 9) || (i > 15 && i < 19), seed: 17 }));

  const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 6, q.segments), energy.mat);
  disc.position.z = -1.2;
  g.add(disc);

  // orbiting debris, instanced; driven in update() below
  const shards = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(1.5, 0), MAT.metal, q.shards
  );
  const rnd = mulberry(29);
  const orbit = [];
  for (let i = 0; i < q.shards; i++) {
    orbit.push({
      r: R + 3 + rnd() * 16,
      a: rnd() * Math.PI * 2,
      y: (rnd() - 0.5) * 26,
      s: 0.5 + rnd() * 1.9,
      w: (0.02 + rnd() * 0.05) * (rnd() > 0.5 ? 1 : -1),
      tilt: rnd() * Math.PI
    });
  }
  shards.frustumCulled = false;
  g.add(shards);

  // one broken buttress, fallen away from the ring
  const stub = new THREE.Mesh(new THREE.BoxGeometry(4.5, 22, 6), MAT.stone);
  stub.position.set(-(R + 1), -16, 0);
  stub.rotation.z = 0.22;
  g.add(stub);

  return {
    apertureR: R - 6, centerY: 0,
    update(t) {
      const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
      for (let i = 0; i < orbit.length; i++) {
        const o = orbit[i];
        const a = o.a + t * o.w * 0.35;
        _v.set(Math.cos(a) * o.r, o.y + Math.sin(a * 0.7) * 1.2, Math.sin(a) * 4.5 - 2);
        e.set(o.tilt + t * o.w, a * 0.5, 0);
        qt.setFromEuler(e);
        s.setScalar(o.s);
        m.compose(_v, qt, s);
        shards.setMatrixAt(i, m);
      }
      shards.instanceMatrix.needsUpdate = true;
    }
  };
}

/* ── archetype: LATTICE (Team) ────────────────────────────────────
   A hexagonal aperture carried inside a ribbed cage — the structural
   language of the causeways, folded upright into a gateway. */
function buildLattice(g, cfg, q, energy) {
  const R = 15;
  // hexagonal frame
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(R * 1.02, 3.4, 4.4), MAT.metal);
    bar.position.set(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, 0);
    bar.rotation.z = a + Math.PI / 2;
    g.add(bar);
  }
  // ribs: a cage of arcs springing from the base, growing over the frame.
  // They lie in the frame's own plane — turned out of it they become
  // blades standing across the approach.
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 26), MAT.metal, 22);
  const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const a = Math.PI * 0.08 + t * Math.PI * 0.84;
    _v.set(Math.cos(a) * (R + 7), Math.sin(a) * (R + 7) - 2, 0);
    e.set(0, 0, a + Math.PI / 2);
    qt.setFromEuler(e);
    s.set(1, 1, 1 + Math.sin(t * Math.PI) * 0.9);
    m.compose(_v, qt, s);
    ribs.setMatrixAt(i, m);
  }
  ribs.instanceMatrix.needsUpdate = true;
  ribs.frustumCulled = false;
  g.add(ribs);

  const hex = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 6), energy.mat);
  hex.rotation.z = Math.PI / 6;
  hex.position.z = -1.4;
  g.add(hex);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.9, 0.2, 6, 6), energy.trimMat);
  ring.rotation.z = Math.PI / 6;
  g.add(ring);

  // the cage lands on two long skids rather than a terrace
  for (const s2 of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 34), MAT.stone);
    skid.position.set(s2 * (R + 4), -R - 4, 6);
    g.add(skid);
  }
  return { apertureR: R * 0.86, centerY: 0 };
}

/* ── archetype: PYLONS (Sponsors) ─────────────────────────────────
   Two tapered towers and a lintel. The gateway is the gap between
   them: a vertical slit of light with nothing framing it but mass. */
function buildPylons(g, cfg, q, energy) {
  const gap = 9, H = 54;
  for (const s of [-1, 1]) {
    // tapered square shaft — four radial segments reads as cut stone
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 8.6, H, 4, 3), MAT.stone);
    shaft.rotation.y = Math.PI / 4;
    shaft.position.set(s * (gap + 8), H / 2 - 26, 0);
    g.add(shaft);
    // banded courses climbing the shaft
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(15 - i * 1.6, 2.4, 15 - i * 1.6), MAT.stoneCut);
      band.rotation.y = Math.PI / 4;
      band.position.set(s * (gap + 8), -18 + i * 13, 0);
      g.add(band);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(6.4, 11, 4), MAT.stone);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(s * (gap + 8), H - 21, 0);
    g.add(cap);
    const edge = trim(0.4, H * 0.62, 0.4, energy.trimMat);
    edge.position.set(s * (gap + 2.6), 0, 4.2);
    g.add(edge);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2 * (gap + 15), 7, 11), MAT.stone);
  lintel.position.y = 30;
  g.add(lintel);
  const lintelCut = new THREE.Mesh(new THREE.BoxGeometry(2 * (gap + 10), 3, 12.4), MAT.stoneCut);
  lintelCut.position.y = 29;
  g.add(lintelCut);

  const slit = new THREE.Mesh(new THREE.PlaneGeometry(gap * 2, 56), energy.mat);
  slit.position.set(0, 1, -2.4);
  g.add(slit);

  g.add(steppedStack({ levels: 3, w: 66, d: 26, h: 2.6, inset: 0.24, material: MAT.stone, y: -34 }));
  return { apertureR: gap * 1.4, centerY: 4 };
}

const BUILDERS = {
  ring: buildRing, well: buildWell, arch: buildArch,
  fracture: buildFracture, lattice: buildLattice, pylons: buildPylons
};

/* ── public ───────────────────────────────────────────────────────── */

export function createGateway(cfg, quality, tier) {
  const group = new THREE.Group();
  const p = place(cfg.az, cfg.r, cfg.y);
  group.position.set(p.x, p.y, p.z);
  group.rotation.y = -p.a;                    // turn the face toward the dais
  group.scale.setScalar(cfg.scale);

  // per-gateway light so hover and the route transition can drive it
  const tint = new THREE.Color(PAL.light);
  const energy = {
    mat: makeEnergy(tint, cfg.az * 0.07 + cfg.r * 0.01),
    trimMat: MAT.light.clone()
  };
  energy.trimMat.color = new THREE.Color(PAL.light);

  const built = BUILDERS[cfg.arch](group, cfg, quality, energy);

  // the halo that plants the gateway in the fog — additive, low, wide
  const haloMat = makeHalo(PAL.coldBlue, 0.5);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(built.apertureR * 6, built.apertureR * 6), haloMat
  );
  halo.position.set(0, built.centerY, -6);
  group.add(halo);

  // invisible interaction proxy sized to the aperture
  const hit = new THREE.Mesh(
    new THREE.PlaneGeometry(built.apertureR * 2.15, built.apertureR * 2.6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(0, built.centerY, 2);
  group.add(hit);

  const base = cfg.intensity;
  let active = 0;

  const api = {
    id: cfg.id, cfg, group, hit,
    /* Six dynamic lights cost every lit fragment in the scene six times
       over, on a scene where five of them are always off screen. The
       world keeps ONE lamp and moves it to whatever has the observer's
       attention — cheaper, and better art direction besides. */
    get active() { return active; },
    worldPos: new THREE.Vector3(p.x, p.y + built.centerY * cfg.scale, p.z),
    /* Hover response is deliberately small: the structure never moves.
       Only the energy quickens and the trim gains a little heat. */
    setActive(v) { active = v; },
    update(t, dt) {
      energy.mat.uniforms.uTime.value = t;
      energy.mat.uniforms.uActive.value = base * (0.34 + active * 0.66);
      const lit = base * (0.55 + active * 0.45);
      energy.trimMat.color.setRGB(0.75 * lit + 0.1, 0.83 * lit + 0.12, 0.95 * lit + 0.16);
      haloMat.uniforms.uOpacity.value = (0.38 + active * 0.42) * base;
      if (built.update) built.update(t);
    },
    dispose() {
      group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      energy.mat.dispose(); energy.trimMat.dispose();
      haloMat.dispose(); hit.material.dispose();
    }
  };
  hit.userData.gateway = api;
  return api;
}
