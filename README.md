# Reverb & Delay Counter (`TOOL / 006`)

> **Saint Gordon Collective** — Clean, single-page studio tempo calculator for tempo-synced reverb pre-delay & decay and note-subdivision delay times (`ms`), with Tap Tempo, Click Metronome, and audio BPM detection.

**Live App:** https://saintgordon.github.io/reverb-delay-counter/  
**Repository:** https://github.com/saintgordon/reverb-delay-counter  
**Collective:** https://saintgordon.vercel.app

---

## Features

- **Clean Single-Page Layout** — Enter any whole-number BPM (`20–300`; decimals automatically round to the nearest whole number), tap tempo (`T`), toggle the click metronome (`M`), or drop a song to detect its BPM, and see all Reverb and Delay timings immediately on one page.
- **Reverb Pre-Delay & Decay Table** — 7 musical spaces (**Hall**, **Big Room**, **Small Room**, **Tight Ambience**, **Vocal Plate**, **Cathedral**, **Slapback**) where `Pre-Delay + Decay = Exact Musical Space`, switchable between **Plugin (`ms / s`)**, **`ms`**, and **`sec`**. Click any value to copy.
- **Delay Times (`ms`) Table** — Clean `1/1` through `1/128` grid across **Straight**, **Dotted (`× 1.5`)**, and **Triplet (`× 2/3`)** in milliseconds. Click any value to copy.

## Run Locally & Verify Tests

```bash
node --test tests/timing-math.test.mjs
python3 -m http.server 8080
```

---

© Saint Gordon Collective · MIT License
