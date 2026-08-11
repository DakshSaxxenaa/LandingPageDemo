# THOMSO'26 — Landing Page

Scroll-driven landing page for Thomso, IIT Roorkee's annual cultural fest.
Static HTML/CSS/JS — no build step, no dependencies.

## Structure

```
.
├── index.html              # landing page (all CSS + JS inline)
├── event/
│   └── index.html          # /event — the Events card links here
├── assets/
│   ├── thomso-loop.mp4     # hero video, forward+reverse boomerang
│   ├── poster.jpg          # video poster frame
│   ├── shaan.jpg           # backdrop — THOMSO'26 chapter
│   ├── saleem.jpg          # backdrop — Events chapter
│   ├── navjot.webp         # backdrop — Pronite chapter
│   ├── thomso-logo-neon.svg# terminus watermark, recolored to theme
│   └── source/             # build inputs — not used by the site
└── .nojekyll               # serve files as-is, skip Jekyll
```

All paths are **relative**, so this works at both
`user.github.io/repo/` and a custom domain root.

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
- **"EST. 1986 / 40 years"** in the footer HUD — verify before publishing.
- Prize pool, footfall and event counts are placeholders.
