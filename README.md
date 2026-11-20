# Vice Cover Studio v2

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/roymaster46/gta6-cover-art-v2/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/roymaster46/gta6-cover-art-v2/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn your crew into a **GTA 6 movie-poster key art** — seven outlaws, one coast, no way back.

A single-page canvas studio that draws a dense, cinematic 16:9 poster entirely in
JavaScript: seven different cast portraits in a multi-panel grid, one large
**pop-out hero** who breaks out of his frame and overlaps the title, a huge
striped retro-chrome 3D title, pink neon script subtitle, press-quote top bar,
role tags and location captions on every panel, tagline strip with palm
silhouettes, full billing block, barcode, and a gold "ORIGINAL COVER ART" seal.

## Run it

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no libraries, no external assets. All seven sample portraits ship
in `photos/` and are original to this repo.

## Studio features

- **Edit the copy** — title, script subtitle, press quote, tagline (live re-render)
- **6 film grades** — Sunset, Vice Neon, Golden Hour, Twilight, Heatwave, Noir
- **2 layouts** — Center Hero, Slanted Panels
- **Swap any cast photo** — upload your own portrait per panel
- **Export PNG** — 16:9 poster, 4:5 post, or 1:1 square (canvas re-renders at
  the target aspect ratio)

## The cast

| Role | Photo |
| --- | --- |
| THE DRIVER (hero) | `photos/hero-driver.jpg` |
| THE BOSS | `photos/boss-silver.jpg` |
| THE MECHANIC | `photos/mechanic-red.jpg` |
| THE CAPTAIN | `photos/captain-hat.jpg` |
| THE RIDER | `photos/rider-leather.jpg` |
| THE LOOKOUT | `photos/lookout-dark.jpg` |
| THE WHEELMAN | `photos/wheelman-floral.jpg` |

## How the poster is drawn

Everything is drawn by `app.js` on a `<canvas>` — photos are cover-cropped per
panel, the chrome title is rendered on an offscreen canvas so the gradient
stripes clip exactly to the letterforms, the barcode bars are seeded
deterministic, and film grain + vignette are drawn last over the whole poster.

## Bounty

Built for the make.fun **"Make GTA 6 Cover Art"** bounty ($250):
https://make.fun/bounty/gta6-cover-art-01

## License

MIT — see [LICENSE](LICENSE).
