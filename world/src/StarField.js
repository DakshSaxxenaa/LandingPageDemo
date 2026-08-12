import * as THREE from 'three';
import { makeStarMaterial } from './materials.js';

/* ══════════════════════════════════════════════════════════════════
   STARS
   Three shells at genuinely different distances rather than one flat
   dome. Because the camera swings on an arm, the inner shell drifts
   measurably against the outer one — the sky has depth instead of
   being a texture pinned behind the world.

   The shells are also thick: points are scattered through a radial
   band, not stuck to a sphere surface.
   ══════════════════════════════════════════════════════════════════ */

function shell(count, rMin, rMax, size, opacity, seed) {
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);

  let a = seed;
  const rnd = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    // even distribution over the sphere, biased away from straight down
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = rMin + rnd() * (rMax - rMin);
    pos[i * 3]     = Math.cos(th) * s * r;
    pos[i * 3 + 1] = (u * 0.72 + 0.14) * r;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
    seeds[i] = rnd();
    // a few bright ones carry the field; most are barely there
    scales[i] = rnd() < 0.06 ? 1.8 + rnd() * 1.4 : 0.35 + rnd() * 0.8;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  const mat = makeStarMaterial(size, opacity);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

export function createStarField(scene, quality) {
  const [n1, n2, n3] = quality.stars;
  const layers = [
    shell(n1,  900, 1600, 1.9, 0.80, 7),    // near field — moves the most
    shell(n2, 1900, 3000, 2.4, 0.62, 23),
    shell(n3, 3400, 4600, 3.2, 0.45, 41)    // far field — effectively fixed
  ];
  const group = new THREE.Group();
  layers.forEach(l => group.add(l.points));
  scene.add(group);

  return {
    group,
    update(t) { for (const l of layers) l.mat.uniforms.uTime.value = t; },
    setOpacity(k) {
      layers.forEach((l, i) => {
        l.mat.uniforms.uOpacity.value = [0.80, 0.62, 0.45][i] * k;
      });
    },
    dispose() {
      layers.forEach(l => { l.points.geometry.dispose(); l.mat.dispose(); });
      scene.remove(group);
    }
  };
}
