/* ══════════════════════════════════════════════════════════════════
   THE VAULT — art direction data
   Every number that shapes the world lives here, so the six gateways
   are one data-driven system rather than six hand-built components.
   ══════════════════════════════════════════════════════════════════ */

/* Palette. Obsidian → midnight → cold metal → silver-white.
   Nothing warm, ever. Light is the only saturated thing in the world. */
export const PAL = {
  void:      0x03060c,
  obsidian:  0x070a10,
  stone:     0x0d1218,
  stoneLit:  0x1a222c,
  metal:     0x39434f,
  metalHi:   0x707d8c,
  silver:    0xb9c8d8,
  light:     0xdceafa,
  coldBlue:  0x2f4d7a,
  deepBlue:  0x0e2f63
};

/* Camera. The user is a fixed observer on the dais — they own the look
   direction, never the position. NECK is what buys us real parallax:
   the camera swings on a short arm, so near architecture slides against
   the far formations instead of rotating rigidly with them. */
export const CAM = {
  fov: 52,
  near: 0.5,
  far: 6000,
  height: 4.8,
  neck: 5.2,
  pitchMin: -0.30,   // ≈ -17°, enough to find the dais and the logo
  pitchMax: 0.38,    // ≈  22°, enough to find the high gateways
  damping: 0.075,
  dragSpeed: 0.0026,   // swipe: radians per pixel of finger travel
  keySpeed: 0.9,
  /* cursor steering: inside the dead zone the world is still, and at
     full deflection it sweeps a full turn in about five seconds */
  deadZone: 0.20,
  steerRate: 1.35
};

/* Fog gives depth, but it must not erase the world: at 0.00135 anything
   past ~1000u was 84% fogged into the background and the whole far band
   simply vanished. At 0.0005 the mid band stays legible and the far band
   dissolves gradually, which is what reads as distance. */
export const FOG = { color: 0x070c16, density: 0.0005 };

/* ── the six gateways ──────────────────────────────────────────────
   az       azimuth in degrees; 0 is dead ahead on entry
   r        distance from the observer
   y        vertical offset of the gateway's base
   arch     which architectural archetype builds it
   path     which pathway language leads to it
   scale    overall size multiplier
   href     real route in this repo
   Only `events` sits inside the entry field of view (±38° horizontal).
   The rest are placed beyond it, so they can only be found by looking. */
export const GATEWAYS = [
  {
    id: 'events', label: 'Events', href: 'event/',
    az: 0, r: 104, y: 0, scale: 1.25,
    arch: 'ring', path: 'causeway',
    intensity: 1.0
  },
  {
    id: 'register', label: 'Register', href: 'register/',
    az: 63, r: 100, y: -11, scale: 0.95,
    arch: 'well', path: 'descent',
    intensity: 0.9
  },
  {
    id: 'schedule', label: 'Schedule', href: 'schedule/',
    az: 129, r: 150, y: 13, scale: 1.35,
    arch: 'arch', path: 'stair',
    intensity: 0.95
  },
  {
    id: 'about', label: 'About', href: 'about/',
    az: 184, r: 208, y: 24, scale: 1.15,
    arch: 'fracture', path: 'broken',
    intensity: 0.62
  },
  {
    id: 'team', label: 'Team', href: 'team/',
    az: -124, r: 126, y: -4, scale: 1.05,
    arch: 'lattice', path: 'ribbed',
    intensity: 0.85
  },
  {
    id: 'sponsors', label: 'Sponsors', href: 'sponsors/',
    az: -57, r: 134, y: 5, scale: 1.2,
    arch: 'pylons', path: 'span',
    intensity: 0.8
  }
];

/* Near-field slabs. These are the occluders: they cut the sightlines so
   the off-axis gateways stay concealed until the camera comes around,
   and they give the parallax something close to bite on. */
export const OCCLUDERS = [
  { az:   31, r: 50, w: 15, h: 74, d: 9,  tilt:  0.05 },
  { az:  -28, r: 46, w: 12, h: 62, d: 8,  tilt: -0.04 },
  { az:   96, r: 54, w: 19, h: 88, d: 11, tilt:  0.03 },
  { az:  -90, r: 58, w: 16, h: 70, d: 10, tilt: -0.02 },
  { az:  156, r: 62, w: 22, h: 96, d: 12, tilt:  0.02 },
  { az: -155, r: 52, w: 13, h: 58, d: 9,  tilt:  0.06 }
];

/* Quality tiers. Mobile keeps the art direction and loses the cost:
   fewer stars, fewer distant forms, no bloom, lower pixel ratio. */
export const TIERS = {
  high:   { stars: [2600, 1800, 1100], distant: 34, outer: 26, bloom: true,  dpr: 1.75, shards: 34, segments: 48 },
  medium: { stars: [1800, 1200,  800], distant: 24, outer: 18, bloom: true,  dpr: 1.4,  shards: 24, segments: 32 },
  low:    { stars: [1000,  700,  450], distant: 14, outer: 10, bloom: false, dpr: 1.2,  shards: 14, segments: 20 }
};

export const DEG = Math.PI / 180;

/* Shared placement helper — azimuth 0 is straight ahead (-Z). */
export function place(az, r, y = 0) {
  const a = az * DEG;
  return { x: Math.sin(a) * r, y, z: -Math.cos(a) * r, a };
}
