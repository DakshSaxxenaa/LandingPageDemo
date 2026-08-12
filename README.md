# THOMSO'26 — Landing Page

Scroll-driven landing page for Thomso, IIT Roorkee's annual cultural fest,
ending in **The Vault** — a 3D world that replaces the site's navigation.
Static HTML/CSS/JS. **No build step.** Three.js is vendored, not installed.

## Structure

```
.
├── index.html              # landing page (all CSS + JS inline)
├── world/src/              # The Vault — the 3D navigation world
│   ├── World.js            #   orchestrator: renderer, frame loop, lifecycle
│   ├── config.js           #   ALL art direction data — tune the world here
│   ├── Gateway.js          #   six architectural archetypes
│   ├── Pathway.js          #   six approach structures
│   ├── Architecture.js     #   dais, occluders, far band, fog, logo inlay
│   ├── StarField.js        #   three star shells at real depths
│   ├── Lighting.js         #   four lights, total
│   ├── CameraController.js #   look-only camera on a parallax arm
│   ├── Interaction.js      #   hover / tap / keyboard gateway picking
│   ├── materials.js        #   shared material + shader library
│   └── Transition.js       #   scroll entry + route departure
├── vendor/three/           # three.js r185, vendored (MIT). See below.
├── event/  schedule/  sponsors/        # the six gateway destinations
├── team/   register/  about/           #   (five are placeholder copy)
├── assets/
│   ├── thomso-loop.mp4     # hero video, forward+reverse boomerang
│   ├── poster.jpg          # video poster + greyscale "what to expect" plate
│   ├── shaan.jpg           # backdrop — THOMSO'26 wordmark chapter
│   └── source/
│       └── thomso-logo-original.svg   # inlaid into the Vault's dais floor
└── .nojekyll               # serve files as-is, skip Jekyll
```

`assets/saleem.jpg`, `assets/navjot.webp` and `assets/thomso-logo-neon.svg`
are no longer referenced — they belonged to the Events / Pronite / terminus
cards that The Vault replaced. Kept in case that art gets reused.

All paths are **relative**, so this works at both
`user.github.io/repo/` and a custom domain root.

## The Vault

The scroll runs hero → wordmark → *what to expect* → **The Vault**, which
emerges out of the dark between 62% and 86% of the scroll and then holds.

There is no navbar. The observer stands on a dais and *looks around* to
find six gateways; only one is inside the field of view on arrival. Camera
is look-only — it never travels.

| | |
|---|---|
| Cursor | just **move the mouse** — no button, no dragging. Offset from centre steers the turn, height in the frame sets the tilt. Click a gateway to enter |
| Touch | **swipe**. A horizontal-ish swipe takes the camera; a vertical one scrolls the page. Tap a gateway to enter |
| Keyboard | arrows / WASD to look, Enter to enter the centred gateway |

Yaw is a *rate* (the further out the cursor, the faster the turn, squared
response, with a dead zone in the middle) so every bearing is reachable
without the pointer leaving the window. Tilt is absolute, because the
vertical range is small enough to map straight to cursor height. The turn
eases to 22% while the cursor rests on a gateway, so nobody has to chase a
moving target to click one.

The canvas keeps `touch-action: pan-y`, which is exactly the split we want:
the browser keeps vertical panning — so the page always scrolls and the
reader is never trapped at the bottom — while horizontal movement is left
unclaimed for the camera. A swipe's first 8px decide who owns it; once the
camera has claimed it, both axes drive the view.

Tuning: `deadZone` and `steerRate` in `config.js` for the cursor,
`dragSpeed` for swipe sensitivity.

Screen-reader and keyboard users also get a visually-hidden list of all six
routes (`.vault-routes`), so the site is navigable without the 3D scene.

Quality auto-tiers from device memory / cores / pointer type: mobile drops
bloom, star counts and pixel ratio but keeps the art direction. The world is
lazy-loaded at 40% scroll and its frame loop only runs while it is on
screen. Geometry budget is ~12k triangles / 136 objects at the top tier.

To retune the world — gateway bearings, distances, scale, palette, camera
limits, quality tiers — edit `world/src/config.js`. Nothing else should
need to change.

### Updating three.js

Vendored so the site keeps its zero-build, zero-install deploy. To bump:

```bash
npm pack three@latest && tar xf three-*.tgz
cp package/build/three.module.min.js package/build/three.core.min.js vendor/three/build/
cp package/examples/jsm/postprocessing/{EffectComposer,RenderPass,ShaderPass,MaskPass,Pass,UnrealBloomPass,OutputPass}.js vendor/three/addons/postprocessing/
cp package/examples/jsm/shaders/{CopyShader,LuminosityHighPassShader,OutputShader}.js vendor/three/addons/shaders/
cp package/LICENSE vendor/three/LICENSE && rm -rf package three-*.tgz
```

The import map in `index.html` maps `three` and `three/addons/` to these.

## Deploying to GitHub Pages

```bash
git add -A
git commit -m "THOMSO'26 landing page"
git push -u origin main
```

Then: **Settings → Pages → Source: _Deploy from a branch_ → `main` / `/ (root)`**.

Live in ~1 minute at `https://dakshsaxxenaa.github.io/LandingPageDemo/`.

## Local preview

```bash
python3 -m http.server 8080
# → http://localhost:8080/
```

Open it over HTTP, not `file://` — the video won't autoplay otherwise.

## Regenerating the hero video

`thomso-loop.mp4` is a seamless boomerang: the source plays forward, then
backward. Both endpoint frames are dropped at the seam so neither the
turnaround nor the loop point stutters. Browsers can't play video in
reverse (`playbackRate` must be positive), so the reversal is baked in.

```bash
ffmpeg -i assets/source/drone-concert-source.mp4 \
  -filter_complex "[0:v]split=2[a][b];\
    [b]reverse,select='between(n,1,190)',setpts=N/FRAME_RATE/TB[r];\
    [a][r]concat=n=2:v=1:a=0,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -crf 27 -preset slower -g 48 \
  -movflags +faststart assets/thomso-loop.mp4
```

`190` is `frameCount - 2`. For a different source, recount:

```bash
ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames -of csv=p=0 <input>
```

## Things to update before launch

- **Countdown target** — `const FEST` in `index.html` is a placeholder
  (`2026-10-16T18:00+05:30`). Set the real date.
- **Placeholder copy** — `schedule/`, `sponsors/`, `team/`, `register/` and
  `about/` were generated as real pages so every gateway leads somewhere,
  but their body copy is generic. Replace it before launch.
- **"EST. 1986 / 40 years"** in the footer HUD — verify before publishing.
- Prize pool, footfall and event counts are placeholders.
