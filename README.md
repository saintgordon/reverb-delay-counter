# Reverb & Delay Counter (`TOOL / 006`)

> **Saint Gordon Collective** — 100% client-side studio tempo calculator for delay times, LFO modulation Hz, sample-accurate counts, tempo-synced reverb pre-delay & RT60 decay architecture, sidechain dynamics, swing groove offsets, tap tempo, and real-time Web Audio auditioning.

**Live App:** https://saintgordon.github.io/reverb-delay-counter/  
**Collective:** https://saintgordon.vercel.app

---

## Features

- **Dark Hardware Tempo & Audition Console** — Enter any tempo from **20 to 300 BPM** (including decimals like `128.5` or `92.4`), nudge by `±0.5` / `±1`, flip `÷2` Half-Time / `×2` Double-Time, jump to quick genre presets (`75`, `90`, `120`, `140`, `160`), tap live, or drop an audio track directly onto the console for instant client-side onset-autocorrelation BPM detection.
- **Delay Time, LFO Hz & Sample Matrix** — Covers `1/1`, `1/2`, `1/4`, `1/8`, `1/16`, `1/32`, `1/64`, and `1/128` across **Straight**, **Dotted (× 1.5)**, and **Triplet (× 2/3)** with exact **ms**, **s**, **Hz**, and **44.1 kHz / 48 kHz samples** in every cell.
- **Tempo-Synced Reverb Engine (RT60)** — 6 studio-calibrated presets (**Tight Room**, **Vocal Plate**, **Small Hall**, **Large Hall / Ballad**, **Wide Cathedral / Ambient**, **Slapback Vocal Echo**) plus a **Custom Reverb Builder** guaranteeing `Pre-Delay + Decay = Exact Musical Length` so tails resolve cleanly on the next beat or bar boundary.
- **Visual Reverb Envelope Diagram** — Monochrome high-DPI Canvas diagram showing **Dry Transient Hit → Pre-Delay Silence Gap → Exponential Decay Tail (RT60)** aligned to beat/bar markers, with a synchronized live playhead during auditioning.
- **Live Web Audio Auditioning** — Click `▶` (or double-click) any delay cell to hear a synthesized rimshot/vocal snap routed through an actual Web Audio `DelayNode` feedback loop at that exact millisecond value, or click any reverb preset to hear a synthesized stereo RT60 `ConvolverNode` impulse response with exact pre-delay.
- **Dynamics, Sidechain & Groove Pocket** — Tempo-locked compressor attack/release anchors and manual off-beat **Swing / Humanize** delay offsets (`54%`, `58%`, `62%`, `66.7%`) for both 16th-note and 8th-note half-time grooves.
- **1-Click Copy & Markdown Export** — Click any `ms`, `Hz`, or sample figure to copy immediately, or export a formatted `.md` Studio Timing Sheet for Logic Pro, Ableton Live, or Pro Tools session notes.

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
| `T` | Tap Tempo (8-tap rolling window, 2.5s auto-reset, `> 1.8×` median spike rejection) |
| `M` | Toggle Studio Click Metronome |
| `-` / `+` | Adjust BPM by `-1` / `+1` |
| `Shift` + `-` / `+` | Adjust BPM by `-0.5` / `+0.5` |
| `Esc` | Stop Metronome & Active Audition |

---

## Architecture & Testing

Zero external runtime dependencies, zero build steps, zero npm packages — pure vanilla HTML, CSS, Canvas, Web Audio API, and native ES Modules:

- `index.html` — Semantic layout & Saint Gordon Collective shell
- `app.css` — Editorial monochrome styling & dark `.studio-deck` hardware console
- `js/timing-math.js` — Pure tempo, delay, reverb, dynamics, swing, tap-tempo, and Markdown export math (zero DOM deps)
- `js/audition-audio.js` — Web Audio lookahead metronome, `DelayNode` echo audition, stereo RT60 `ConvolverNode` synthesis, and onset-autocorrelation audio BPM detector
- `js/envelope-canvas.js` — Responsive high-DPI monochrome Reverb Envelope Diagram renderer
- `js/app.js` — Interactive UI state controller, clipboard fallback, and keyboard shortcut handler
- `tests/timing-math.test.mjs` — Node.js automated test suite

### Run Locally & Verify Tests

```bash
# Run pure math & tap-tempo unit tests (Node 20+)
node --test tests/timing-math.test.mjs

# Serve locally with any static server
python3 -m http.server 8080
```

---

## Cross-Browser Notes

- Works across **Chrome, Safari (macOS & iOS), Firefox, and Edge** with zero plugins.
- `AudioContext` initializes lazily on the first user gesture and safely resumes suspended states on iOS Safari.
- Clipboard copying uses `navigator.clipboard.writeText` with an automatic `execCommand('copy')` fallback for non-HTTPS local previews.
- Audio file BPM analysis runs 100% locally in browser memory — no audio files ever leave your device.

---

© Saint Gordon Collective · MIT License
