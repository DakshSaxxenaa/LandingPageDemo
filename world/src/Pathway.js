import * as THREE from 'three';
import { PAL, DEG } from './config.js';
import { MAT } from './materials.js';

/* ══════════════════════════════════════════════════════════════════
   PATHWAYS
   Every gateway is reached by a structure, not a road. Each one is
   built along local -Z (the dais sits behind, the gateway ahead), then
   the whole group is turned by -azimuth so it lands on the sightline.

   They are anchored: no bobbing, no drift, no rotation. Their only job
   is to carry the eye outward and to give the parallax a mid-distance
   layer between the near slabs and the far formations.
   ══════════════════════════════════════════════════════════════════ */

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

/* Instanced run of identical members laid end to end along the path. */
function run(geo, material, count, fn) {
  const mesh = new THREE.InstancedMesh(geo, material, count);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    fn(t, i, _p, _e, _s);
    _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  // real instance bounds instead of disabling culling: only ~1/6 of this
  // world is on screen at a time, so culling is the cheapest win available
  mesh.computeBoundingSphere();
  return mesh;
}

/* The luminous line every path carries — the one element they share. */
function guideLine(from, to, y, width, dx = 0) {
  const len = Math.abs(to - from);
  const g = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, len), MAT.lightFaint);
  g.position.set(dx, y, (from + to) / 2);
  return g;
}

const BUILD = {
  /* Broad ceremonial deck on piers, edged with light. Reads as the
     principal approach, which is why it belongs to the entry gateway. */
  causeway(g, { near, far, dy, q }) {
    const n = Math.max(14, Math.round(q.segments * 0.7));
    const span = far - near;
    g.add(run(new THREE.BoxGeometry(17, 1.5, span / n * 0.92), MAT.stone, n,
      (t, i, p, e, s) => {
        p.set(0, dy * t, near + span * t);
        e.set(0, 0, 0);
        s.set(1 - t * 0.18, 1, 1);
      }));
    // piers dropping into the dark below the deck — paired off the
    // centreline so they never stand in front of the aperture
    g.add(run(new THREE.BoxGeometry(2.4, 26, 2.4), MAT.stone, 8,
      (t, i, p, e, s) => {
        // scale grows downward only, so the head stays flush with the deck
        const k = 1 + t * 0.5;
        p.set(i % 2 ? 5.6 : -5.6, dy * t - 13 * k, near + span * t);
        e.set(0, 0, 0);
        s.set(1, k, 1);
      }));
    g.add(guideLine(near, far, dy * 0.5 + 0.85, 0.3, -7.6));
    g.add(guideLine(near, far, dy * 0.5 + 0.85, 0.3, 7.6));
  },

  /* Terraced descent — the deck steps down toward a gateway set below
     the observer's eye, so the destination is discovered by looking
     over the edge rather than straight out. */
  descent(g, { near, far, dy, q }) {
    const n = Math.max(12, Math.round(q.segments * 0.55));
    const span = far - near;
    g.add(run(new THREE.BoxGeometry(13, 2.2, span / n * 0.96), MAT.stone, n,
      (t, i, p, e, s) => {
        p.set(0, dy * t - Math.round(t * 7) * 1.1, near + span * t);
        e.set(0, 0, 0);
        s.set(1 + t * 0.25, 1, 1);
      }));
    g.add(run(new THREE.BoxGeometry(1.4, 5, 1.4), MAT.metal, 10,
      (t, i, p, e, s) => {
        p.set(i % 2 ? 6.4 : -6.4, dy * t - Math.round(t * 7) * 1.1 + 3, near + span * t);
        e.set(0, 0, 0); s.set(1, 1, 1);
      }));
    g.add(guideLine(near, far, dy * 0.5 - 2, 0.34));
  },

  /* A monumental flight. Wide at the foot, narrowing as it climbs, so
     the perspective exaggerates the height of what it serves. */
  stair(g, { near, far, dy, q }) {
    const n = Math.max(18, q.segments);
    const span = far - near;
    g.add(run(new THREE.BoxGeometry(26, 1.6, span / n * 1.05), MAT.stone, n,
      (t, i, p, e, s) => {
        p.set(0, dy * t * t, near + span * t);      // eased rise, not linear
        e.set(0, 0, 0);
        s.set(1 - t * 0.42, 1, 1);
      }));
    for (const side of [-1, 1]) {
      g.add(run(new THREE.BoxGeometry(2.2, 7, 2.2), MAT.stone, 6,
        (t, i, p, e, s) => {
          const w = 13 * (1 - t * 0.42);
          p.set(side * w, dy * t * t + 3, near + span * t);
          e.set(0, 0, 0); s.set(1, 1 + t, 1);
        }));
    }
    g.add(guideLine(near, far, 1.2, 0.5));
  },

  /* Fragments of a path that no longer connects. Anchored, tilted,
     with the gaps left open — the approach to the broken gateway. */
  broken(g, { near, far, dy, q }) {
    const n = Math.max(9, Math.round(q.segments * 0.4));
    const span = far - near;
    // fragments stay low and roughly in line: the gap is the drama, and
    // anything thrown up across the sightline just hides the gateway
    g.add(run(new THREE.BoxGeometry(7, 1.6, span / n * 0.5), MAT.stone, n,
      (t, i, p, e, s) => {
        const drop = -Math.abs(Math.sin(i * 2.7)) * 2.2;
        p.set(Math.sin(i * 1.9) * 2.2, dy * t + drop - 2, near + span * t);
        e.set(0, Math.sin(i * 3.3) * 0.14, Math.cos(i * 2.1) * 0.05);
        s.set(0.7 + Math.abs(Math.sin(i * 1.3)) * 0.5, 1, 1);
      }));
    // debris that fell out of the span, resting where it landed
    g.add(run(new THREE.TetrahedronGeometry(1.8, 0), MAT.stone, 12,
      (t, i, p, e, s) => {
        p.set(Math.sin(i * 5.1) * 16, dy * t - 11 - Math.abs(Math.sin(i * 2.2)) * 8, near + span * t);
        e.set(i, i * 1.7, i * 0.4);
        s.setScalar(0.6 + Math.abs(Math.cos(i)) * 1.5);
      }));
  },

  /* A deck carried inside a ribcage of arches — the same structural
     language as the lattice gateway it leads to. */
  ribbed(g, { near, far, dy, q }) {
    const n = Math.max(12, Math.round(q.segments * 0.6));
    const span = far - near;
    g.add(run(new THREE.BoxGeometry(9, 1.2, span / n * 0.9), MAT.stone, n,
      (t, i, p, e, s) => { p.set(0, dy * t, near + span * t); e.set(0, 0, 0); s.set(1, 1, 1); }));
    // the ribs: half-hoops over the deck, tightening toward the gateway
    const ribs = Math.max(10, Math.round(q.segments * 0.5));
    g.add(run(new THREE.TorusGeometry(7.5, 0.5, 4, 10, Math.PI), MAT.metal, ribs,
      (t, i, p, e, s) => {
        // a half-torus already lies across the direction of travel; turning
        // it would stand each hoop up as a blade down the middle of the deck
        p.set(0, dy * t, near + span * t);
        e.set(0, 0, 0);
        s.set(1 - t * 0.3, 1 - t * 0.3, 1);
      }));
    g.add(guideLine(near, far, dy * 0.5 + 0.8, 0.3));
  },

  /* A single beam thrown across the void, held by almost nothing. */
  span(g, { near, far, dy, q }) {
    const span2 = far - near;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.1, span2), MAT.metal);
    beam.position.set(0, dy * 0.5, (near + far) / 2);
    beam.rotation.x = Math.atan2(dy, span2) * 0.5;
    g.add(beam);
    g.add(run(new THREE.BoxGeometry(1.6, 20, 1.6), MAT.stone, 3,
      (t, i, p, e, s) => {
        p.set(0, dy * t - 10, near + span2 * (0.25 + t * 0.5));
        e.set(0, 0, 0); s.set(1, 1 + i * 0.5, 1);
      }));
    g.add(guideLine(near, far, dy * 0.5 + 0.7, 0.26));
  }
};

export function createPathway(cfg, quality) {
  const g = new THREE.Group();
  g.rotation.y = -cfg.az * DEG;      // same convention as the gateways
  // local -Z runs from the dais edge out to the gateway's footing
  BUILD[cfg.path](g, {
    near: -17,
    far: -(cfg.r - 26),
    dy: cfg.y,
    q: quality
  });
  g.scale.setScalar(1);
  return {
    group: g,
    dispose() { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  };
}
