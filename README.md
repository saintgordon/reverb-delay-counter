# Reverb & Delay Counter (`TOOL / 006`)

> **Saint Gordon Collective** — 100% client-side, instant-glance studio tempo calculator for tempo-synced reverb pre-delay & RT60 decay, vocal & matrix delay timings (`ms`, `Hz`, `44.1 / 48 kHz` samples), sidechain dynamics, swing groove offsets, tap tempo, and real-time Web Audio auditioning.

**Live App:** https://saintgordon.github.io/reverb-delay-counter/  
**Repository:** https://github.com/saintgordon/reverb-delay-counter  
**Collective:** https://saintgordon.vercel.app

---

## Features

- **Zero-Scroll Above-the-Fold Reverb Workspace** — Land on the page, type any BPM (`20–300`, including decimals like `128.5`), tap tempo, or drop an audio track, and immediately see all **7 Tempo-Synced Reverb Sizes** above the fold with zero extra clicks.
- **Sleek Compact Dark Tempo Bar** — Direct live-updating BPM input, `-1 / +1 / ÷2 / ×2` controls, quick presets (`75 / 90 / 120 / 140 / 160`), tactile **Tap Tempo (`T`)** with stability readout, studio click **Metronome (`M`)**, **Volume**, and drag-and-drop **Auto-BPM** detection.
- **7 Musically Exact Reverb Presets + Unit Switcher** — Switch seamlessly between **Plugin Ready (`ms / s`)** (Pre-Delay in `ms`, Decay & Total in `s` matching Valhalla VintageVerb, Logic ChromaVerb, FabFilter Pro-R 2, and Waves H-Reverb), **All `ms`**, and **All `sec`**. Every preset guarantees `Pre-Delay + Decay = Exact Musical Length`:
  1. **Hall** — `2 Bars · 8 Beats` (`1/32` Pre-Delay -> `62.50 ms` PD / `3.94 s` (`3937.50 ms`) Decay / `4.00 s` Total @ 120 BPM)
  2. **Big Room** — `1 Bar · 4 Beats` (`1/64` Pre-Delay -> `31.25 ms` PD / `1.97 s` (`1968.75 ms`) Decay / `2.00 s` Total @ 120 BPM)
  3. **Small Room** — `1/2 Bar · 2 Beats` (`1/128` Pre-Delay -> `15.63 ms` PD / `0.98 s` (`984.38 ms`) Decay / `1.00 s` Total @ 120 BPM)
  4. **Tight Ambience** — `1 Beat · 1/4 Note` (`1/512` Pre-Delay -> `3.91 ms` PD / `0.50 s` (`496.09 ms`) Decay / `0.50 s` Total @ 120 BPM)
  5. **Vocal Plate** — `1 Bar · 4 Beats` (`1/32` Pre-Delay -> `62.50 ms` PD / `1.94 s` (`1937.50 ms`) Decay / `2.00 s` Total @ 120 BPM)
  6. **Cathedral / Wide** — `4 Bars · 16 Beats` (`1/16` Pre-Delay -> `125.00 ms` PD / `7.88 s` (`7875.00 ms`) Decay / `8.00 s` Total @ 120 BPM)
  7. **Slapback Vocal** — `1/2 Beat · 1/8 Note` (`1/32` Pre-Delay -> `62.50 ms` PD / `0.19 s` (`187.50 ms`) Decay / `0.25 s` Total @ 120 BPM)
- **Live Visual Reverb Envelope & Custom Builder** — High-DPI monochrome Canvas diagram showing **Dry Transient Hit → Pre-Delay Silence Gap → Exponential RT60 Decay Tail** aligned to beat/bar markers with a live audition playhead, paired side-by-side with a **Custom Reverb Builder** (`None / 1/512 .. 1/8` × `Straight / Dotted / Triplet` × `1/2 Beat .. 4 Bars`).
- **Tab II — Quick Vocal Delays & Full Delay Matrix** — 4 featured vocal delay cards (**Slapback 1/16**, **1/8 Throw**, **1/8 Dotted**, **1/4 Echo**) above a complete 8-subdivision (`1/1`–`1/128`) × 3-variation (**Straight**, **Dotted × 1.5**, **Triplet × 2/3**) matrix with `ms`, `Hz`, and `44.1 / 48 kHz` sample counts.
- **Live Web Audio Auditioning** — Click `▶ Hear` on any reverb row, custom reverb, quick delay card, or delay matrix cell to hear exact pre-delay + stereo RT60 convolution or real Web Audio `DelayNode` repeats before touching your DAW.
- **Tab III — Groove & Markdown Export** — Tempo-locked compressor attack/release & sidechain anchors, off-beat **Swing / Humanize** delay offsets (`54%`, `58%`, `62%`, `66.7%`), and 1-click **Studio Timing Sheet (`.md`)** export from any tab.

---

## Core Formulas

| Calculation | Formula |
| :--- | :--- |
| **Quarter Note (1 Beat)** | `beatMs = 60,000 / BPM` |
| **Straight Subdivision (`1/D`)** | `ms = (240,000 / BPM) / D` |
| **Dotted Subdivision** | `ms_dotted = ms_straight × 1.5` |
| **Triplet Subdivision** | `ms_triplet = ms_straight × (2 / 3)` |
| **LFO / Modulation Rate** | `Hz = 1,000 / ms` |
| **Sample Count** | `samples = round((ms / 1,000) × sampleRate)` (`44,100` / `48,000`) |
| **Tempo-Synced Reverb Decay** | `decayMs = totalMusicalMs − preDelayMs` (where `preDelayMs + decayMs === totalMusicalMs`) |
| **16th-Note Swing Delay Offset (`P%`)** | `offsetMs = eighthNoteMs × ((P − 50) / 100)` |

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `1` / `2` / `3` | Switch between **Reverb**, **Delay**, and **Groove & Export** tabs |
| `T` | Tap Tempo (8-tap rolling window, 2.5s auto-reset, `> 1.8×` median spike rejection) |
| `M` | Toggle Studio Click Metronome |
| `-` / `+` | Adjust BPM by `-1` / `+1` |
| `Shift` + `-` / `+` | Adjust BPM by `-0.5` / `+0.5` |
| `Esc` | Stop Metronome & Active Audition |

---

## Architecture & Testing

Zero external runtime dependencies, zero build steps, zero npm packages — pure vanilla HTML, CSS, Canvas, Web Audio API, and native ES Modules:

- `index.html` — Reverb-first 3-tab workspace & Saint Gordon Collective shell
- `app.css` — Editorial monochrome styling, compact dark `.studio-deck` bar & mobile-responsive cards
- `js/timing-math.js` — Pure tempo, reverb, delay, dynamics, swing, tap-tempo, and Markdown export math (zero DOM deps)
- `js/audition-audio.js` — Web Audio lookahead metronome, `DelayNode` echo audition, stereo RT60 `ConvolverNode` synthesis, and onset-autocorrelation audio BPM detector
- `js/envelope-canvas.js` — Responsive high-DPI monochrome Reverb Envelope Diagram renderer
- `js/app.js` — Interactive 3-tab UI controller, clipboard fallback, and keyboard shortcut handler
- `tests/timing-math.test.mjs` — Node.js automated test suite

### Run Locally & Verify Tests

```bash
# Run pure math & tap-tempo unit tests (Node 20+)
node --test tests/timing-math.test.mjs

# Serve locally with any static server
python3 -m http.server 8080
```

---

© Saint Gordon Collective · MIT License
