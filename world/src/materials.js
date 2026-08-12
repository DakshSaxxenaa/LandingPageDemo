import * as THREE from 'three';
import { PAL } from './config.js';

/* ══════════════════════════════════════════════════════════════════
   Shared material library.
   One instance of each material serves the whole world — six gateways
   built from the same stone read as one civilisation, and the draw
   calls stay batchable. Everything is disposed through dispose().
   ══════════════════════════════════════════════════════════════════ */

const store = [];
const keep = m => { store.push(m); return m; };

export const MAT = {
  /* the world is cut from three substances, and that restraint is the
     reason it reads as architecture instead of as a props collection */
  stone: keep(new THREE.MeshStandardMaterial({
    color: PAL.stone, roughness: 0.94, metalness: 0.04, flatShading: false
  })),
  stoneCut: keep(new THREE.MeshStandardMaterial({
    color: PAL.stoneLit, roughness: 0.82, metalness: 0.12
  })),
  metal: keep(new THREE.MeshStandardMaterial({
    color: PAL.metal, roughness: 0.34, metalness: 0.95
  })),
  /* light-emitting trim: basic, so it survives the dark unlit and gives
     the bloom pass something clean to latch onto */
  light: keep(new THREE.MeshBasicMaterial({ color: PAL.light })),
  lightDim: keep(new THREE.MeshBasicMaterial({ color: PAL.silver })),
  /* the faintest tier of emissive: long runs of trim that must read as
     distance markers, never as the subject */
  lightFaint: keep(new THREE.MeshBasicMaterial({ color: 0x54677d }))
};

/* ── aperture energy ──────────────────────────────────────────────
   The surface inside each gateway. A soft radial core with a slow
   internal drift — no texture, no particles, no neon ring. Each
   gateway owns an instance so hover can drive `uActive` per portal. */
export function makeEnergy(tint = new THREE.Color(PAL.light), seed = 0) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime:   { value: 0 },
      uActive: { value: 0 },      // 0 → 1, driven by hover / transition
      uSeed:   { value: seed },
      uTint:   { value: tint },
      uCore:   { value: 0.34 }    // how far the bright core reaches
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float uTime, uActive, uSeed, uCore;
      uniform vec3  uTint;
      varying vec2 vUv;

      // cheap value noise — two octaves is plenty at this scale
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        if (r > 1.0) discard;

        float t = uTime * 0.06 + uSeed;
        // the drift is radial, so the surface reads as depth rather than
        // as a scrolling texture
        float n = noise(vec2(atan(p.y, p.x) * 1.6, r * 2.4 - t * 1.4));
        n = mix(n, noise(vec2(r * 5.0 - t, uSeed * 3.0)), 0.4);

        float core = 1.0 - smoothstep(uCore, 1.0, r);
        float body = pow(core, 2.2) * (0.55 + n * 0.45);
        float rim  = smoothstep(0.86, 0.99, r) * 0.5;

        float a = (body * 0.34 + rim * 0.22) * (0.5 + uActive * 0.8);
        vec3  c = mix(uTint * 0.55, uTint, core * (0.6 + uActive * 0.4));
        gl_FragColor = vec4(c, a);
      }`
  });
  store.push(m);
  return m;
}

/* ── halo ─────────────────────────────────────────────────────────
   The bloom of light around an aperture, sitting in the fog behind the
   architecture. Radial falloff: a plain quad with flat opacity shows
   its corners and instantly reads as a pasted-on card. */
export function makeHalo(color, opacity) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        if (r > 1.0) discard;
        float a = pow(1.0 - r, 3.0) * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }`
  });
  store.push(m);
  return m;
}

/* ── atmosphere ───────────────────────────────────────────────────
   Standing fog banks. Vertical gradient, no billowing: they anchor the
   architecture into the void instead of drawing attention themselves. */
export function makeMist(opacity = 0.16) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(PAL.coldBlue) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float uTime, uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main(){
        // NB: smoothstep needs edge0 < edge1 — invert the result instead
        float base = 1.0 - smoothstep(0.0, 1.0, vUv.y);        // dense at the floor
        float edge = smoothstep(0.0, 0.30, vUv.x) * (1.0 - smoothstep(0.70, 1.0, vUv.x));
        // barely-there breathing, well under the threshold of "floating"
        float breathe = 0.9 + 0.1 * sin(uTime * 0.12 + vUv.x * 3.0);
        gl_FragColor = vec4(uColor, base * edge * uOpacity * breathe);
      }`
  });
  store.push(m);
  return m;
}

/* ── stars ────────────────────────────────────────────────────────
   Real points at real distances in three shells, so rotation produces
   genuine differential motion rather than a spinning skybox. */
export function makeStarMaterial(size, opacity) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uOpacity: { value: opacity },
      uScale: { value: 1 }
    },
    vertexShader: /* glsl */`
      precision mediump float;
      attribute float aSeed;
      attribute float aScale;
      uniform float uTime, uSize, uScale;
      varying float vTwinkle;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // slow, shallow scintillation — never a blinking christmas light
        vTwinkle = 0.72 + 0.28 * sin(uTime * 0.35 + aSeed * 6.283);
        gl_PointSize = uSize * aScale * uScale * (300.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      uniform float uOpacity;
      varying float vTwinkle;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d) * 4.0;
        if (r > 1.0) discard;
        float a = pow(1.0 - r, 2.0) * uOpacity * vTwinkle;
        gl_FragColor = vec4(vec3(0.80, 0.87, 0.98), a);
      }`
  });
  store.push(m);
  return m;
}

export function disposeMaterials() {
  for (const m of store) m.dispose();
  store.length = 0;
}
