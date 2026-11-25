/**
 * Reverb & Delay Counter — Pure Tempo & Time-Domain Math Engine
 * Zero DOM dependencies (runs identically in browser ES Modules and Node.js tests).
 */

export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 120;

export const SAMPLE_RATES = Object.freeze({
  STANDARD: 44100,
  STUDIO: 48000,
});

export const SUBDIVISIONS = Object.freeze([
  { id: '1/1', denom: 1, label: '1/1', name: 'Whole', beats: 4 },
  { id: '1/2', denom: 2, label: '1/2', name: 'Half', beats: 2 },
  { id: '1/4', denom: 4, label: '1/4', name: 'Quarter', beats: 1 },
  { id: '1/8', denom: 8, label: '1/8', name: 'Eighth', beats: 0.5 },
  { id: '1/16', denom: 16, label: '1/16', name: 'Sixteenth', beats: 0.25 },
  { id: '1/32', denom: 32, label: '1/32', name: 'Thirty-Second', beats: 0.125 },
  { id: '1/64', denom: 64, label: '1/64', name: 'Sixty-Fourth', beats: 0.0625 },
  { id: '1/128', denom: 128, label: '1/128', name: '128th', beats: 0.03125 },
]);

export const VARIATIONS = Object.freeze({
  straight: { id: 'straight', label: 'Straight', shortLabel: '', factor: 1 },
  dotted: { id: 'dotted', label: 'Dotted', shortLabel: 'D', factor: 1.5 },
  triplet: { id: 'triplet', label: 'Triplet', shortLabel: 'T', factor: 2 / 3 },
});

export const GENRE_TEMPO_PRESETS = Object.freeze([
  { bpm: 75, label: 'Slow' },
  { bpm: 90, label: 'Boom-Bap' },
  { bpm: 120, label: 'House' },
  { bpm: 140, label: 'Trap' },
  { bpm: 160, label: 'Fast' },
]);

export const REVERB_PRESET_DEFS = Object.freeze([
  {
    id: 'hall',
    name: 'Hall',
    tag: '2 BARS · CHORUS / SUSTAIN',
    totalBeats: 8,
    totalLabel: '2 Bars · 8 Beats',
    preDelayDenom: 32,
    preDelayVariation: 'straight',
    preDelayLabel: '1/32',
    description: 'Lush 2-bar concert hall wash that lifts vocals cleanly and clears on the next phrase.',
    auditionColor: 'large-hall',
  },
  {
    id: 'big-room',
    name: 'Big Room',
    tag: '1 BAR · DRUMS / ENSEMBLE',
    totalBeats: 4,
    totalLabel: '1 Bar · 4 Beats',
    preDelayDenom: 64,
    preDelayVariation: 'straight',
    preDelayLabel: '1/64',
    description: 'Full studio live-room bloom for snares, acoustic guitars, and cohesive ensemble glue.',
    auditionColor: 'small-hall',
  },
  {
    id: 'small-room',
    name: 'Small Room',
    tag: '1/2 BAR · VERSES / INTIMATE',
    totalBeats: 2,
    totalLabel: '1/2 Bar · 2 Beats',
    preDelayDenom: 128,
    preDelayVariation: 'straight',
    preDelayLabel: '1/128',
    description: 'Immediate studio chamber depth for rap verses, dry drums, and upfront vocal pockets.',
    auditionColor: 'room',
  },
  {
    id: 'tight-ambience',
    name: 'Tight Ambience',
    tag: '1 BEAT · DRY GLUE / PERC',
    totalBeats: 1,
    totalLabel: '1 Beat · 1/4 Note',
    preDelayDenom: 512,
    preDelayVariation: 'straight',
    preDelayLabel: '1/512',
    description: 'Ultra-short early reflection space that puts dry tracks in a room without audible tail.',
    auditionColor: 'room',
  },
  {
    id: 'vocal-plate',
    name: 'Vocal Plate',
    tag: '1 BAR · LEAD VOCAL / POP',
    totalBeats: 4,
    totalLabel: '1 Bar · 4 Beats',
    preDelayDenom: 32,
    preDelayVariation: 'straight',
    preDelayLabel: '1/32',
    description: 'Crisp upfront consonant separation before a dense 1-bar dark-pop vocal plate bloom.',
    auditionColor: 'plate',
  },
  {
    id: 'cathedral-wide',
    name: 'Cathedral / Wide',
    tag: '4 BARS · AMBIENT / PADS',
    totalBeats: 16,
    totalLabel: '4 Bars · 16 Beats',
    preDelayDenom: 16,
    preDelayVariation: 'straight',
    preDelayLabel: '1/16',
    description: 'Huge 4-bar architectural wash for ambient swells, sparse hooks, and cinematic pads.',
    auditionColor: 'cathedral',
  },
  {
    id: 'slapback-vocal',
    name: 'Slapback Vocal',
    tag: '1/2 BEAT · TAPE SLAP ECHO',
    totalBeats: 0.5,
    totalLabel: '1/2 Beat · 1/8 Note',
    preDelayDenom: 32,
    preDelayVariation: 'straight',
    preDelayLabel: '1/32',
    description: 'Classic tight vocal slap gap with a controlled 1/8-note chamber tail for thickness.',
    auditionColor: 'slapback',
  },
]);

export const REVERB_PRE_DELAY_OPTIONS = Object.freeze([
  { value: '0', denom: 0, label: 'None (0 ms)' },
  { value: '512', denom: 512, label: '1/512' },
  { value: '128', denom: 128, label: '1/128' },
  { value: '64', denom: 64, label: '1/64' },
  { value: '32', denom: 32, label: '1/32' },
  { value: '16', denom: 16, label: '1/16' },
  { value: '8', denom: 8, label: '1/8' },
]);

export const REVERB_TOTAL_OPTIONS = Object.freeze([
  { value: '0.5', beats: 0.5, label: '1/2 Beat (1/8 Note)' },
  { value: '1', beats: 1, label: '1 Beat (1/4 Note)' },
  { value: '2', beats: 2, label: '2 Beats (1/2 Bar)' },
  { value: '4', beats: 4, label: '1 Bar (4 Beats)' },
  { value: '8', beats: 8, label: '2 Bars (8 Beats)' },
  { value: '16', beats: 16, label: '4 Bars (16 Beats)' },
]);

export const QUICK_DELAY_DEFS = Object.freeze([
  {
    id: 'slapback-16',
    name: 'Slapback 1/16',
    tag: 'VOCAL THICKNESS',
    denom: 16,
    variation: 'straight',
  },
  {
    id: 'eighth-throw',
    name: '1/8 Throw',
    tag: 'POCKETED PHRASE TAIL',
    denom: 8,
    variation: 'straight',
  },
  {
    id: 'eighth-dotted',
    name: '1/8 Dotted',
    tag: 'SYNCOPATED POP BOUNCE',
    denom: 8,
    variation: 'dotted',
  },
  {
    id: 'quarter-echo',
    name: '1/4 Echo',
    tag: 'CLASSIC BEAT REPEAT',
    denom: 4,
    variation: 'straight',
  },
]);

export const SWING_LEVELS = Object.freeze([
  { percent: 54, name: 'Subtle Pocket', note: 'Gentle MPC humanize feel without losing grid snap' },
  { percent: 58, name: 'Classic Boom-Bap', note: 'Head-nodding hip-hop & R&B off-beat groove' },
  { percent: 62, name: 'Heavy Shuffle', note: 'Deep UK garage, house & swung hi-hat bounce' },
  { percent: 66.6666667, displayPercent: '66.7%', name: 'Full Triplet Swing', note: '2:1 triplet grid lock (classic jazz & shuffle)' },
]);

/**
 * Clamp any numeric BPM safely to [MIN_BPM, MAX_BPM].
 * Returns DEFAULT_BPM if input is non-finite.
 */
export function clampBpm(bpm) {
  const num = Number(bpm);
  if (!Number.isFinite(num)) {
    return DEFAULT_BPM;
  }
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, num));
  return Math.round(clamped);
}

/**
 * Parse a user-entered string/number into a valid clamped BPM or null if empty/invalid.
 */
export function parseBpmInput(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/,/g, '.');
  if (cleaned === '') return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return clampBpm(num);
}

/**
 * Format BPM cleanly (e.g. "120", "128.5", "92.45").
 */
export function formatBpm(bpm) {
  const safe = clampBpm(bpm);
  if (Number.isInteger(safe)) {
    return String(safe);
  }
  return safe.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

export function formatMs(ms) {
  if (!Number.isFinite(ms)) return '0.00';
  return ms.toFixed(2);
}

export function formatSec(ms) {
  if (!Number.isFinite(ms)) return '0.000';
  return (ms / 1000).toFixed(3);
}

export function formatSecShort(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0.00';
  if (ms < 100) {
    return (ms / 1000).toFixed(3);
  }
  return (ms / 1000).toFixed(2);
}

export function formatHz(hz) {
  if (!Number.isFinite(hz) || hz <= 0) return '0.00';
  if (hz >= 100) return hz.toFixed(1);
  if (hz < 1) return hz.toFixed(3);
  return hz.toFixed(2);
}

export function formatSamples(samples) {
  if (!Number.isFinite(samples)) return '0';
  return Math.round(samples).toLocaleString('en-US');
}

/**
 * Format a reverb timing value according to the active unit display mode:
 * - 'plugin' (default): Pre-Delay in ms (with s subtitle); Decay & Total in s (with ms subtitle)
 * - 'ms': All values in ms (exact reverbcalculator.com style, with s subtitle)
 * - 'sec': All values in s (with ms subtitle)
 */
export function formatReverbDisplay(ms, mode = 'plugin', role = 'decay') {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const msVal = formatMs(safeMs);
  const secVal = formatSecShort(safeMs);

  const showAsMs = mode === 'ms' || (mode === 'plugin' && role === 'predelay');

  if (showAsMs) {
    return {
      primary: `${msVal} ms`,
      secondary: `${secVal} s`,
      copyValue: msVal,
      unit: 'ms',
    };
  }

  return {
    primary: `${secVal} s`,
    secondary: `${msVal} ms`,
    copyValue: secVal,
    unit: 's',
  };
}

/**
 * Core note duration calculation in milliseconds.
 * Straight whole note (4 beats) = 240,000 / bpm ms.
 */
export function calculateNoteMs(bpm, denom, variation = 'straight') {
  const safeBpm = clampBpm(bpm);
  const varDef = VARIATIONS[variation] || VARIATIONS.straight;
  if (!Number.isFinite(denom) || denom <= 0) {
    return 0;
  }
  const straightMs = (240000 / safeBpm) / denom;
  return straightMs * varDef.factor;
}

/**
 * Calculate beat (quarter note) and bar (4/4 whole note) summary metrics.
 */
export function calculateTempoSummary(bpm) {
  const safeBpm = clampBpm(bpm);
  const beatMs = 60000 / safeBpm;
  const barMs = 240000 / safeBpm;
  return {
    bpm: safeBpm,
    beatMs,
    beatSeconds: beatMs / 1000,
    beatHz: safeBpm / 60,
    barMs,
    barSeconds: barMs / 1000,
    beatSamples44100: Math.round((beatMs / 1000) * SAMPLE_RATES.STANDARD),
    beatSamples48000: Math.round((beatMs / 1000) * SAMPLE_RATES.STUDIO),
  };
}

/**
 * Calculate a single cell of the Delay Time Matrix.
 */
export function calculateDelayCell(bpm, denom, variation = 'straight') {
  const safeBpm = clampBpm(bpm);
  const varDef = VARIATIONS[variation] || VARIATIONS.straight;
  const ms = calculateNoteMs(safeBpm, denom, varDef.id);
  const seconds = ms / 1000;
  const hz = ms > 0 ? 1000 / ms : 0;
  const samples44100 = Math.round(seconds * SAMPLE_RATES.STANDARD);
  const samples48000 = Math.round(seconds * SAMPLE_RATES.STUDIO);
  const beats = (4 / denom) * varDef.factor;

  const noteTag = varDef.id === 'straight'
    ? `1/${denom}`
    : `1/${denom} ${varDef.label}`;

  return {
    id: `1/${denom}-${varDef.id}`,
    denom,
    variation: varDef.id,
    variationLabel: varDef.label,
    noteTag,
    beats,
    ms,
    seconds,
    hz,
    samples44100,
    samples48000,
  };
}

/**
 * Calculate the 4 featured Quick Vocal Delay cards (Slapback 1/16, 1/8 Throw, 1/8 Dotted, 1/4 Echo).
 */
export function calculateQuickDelays(bpm) {
  const safeBpm = clampBpm(bpm);
  return QUICK_DELAY_DEFS.map((def) => {
    const cell = calculateDelayCell(safeBpm, def.denom, def.variation);
    return {
      ...cell,
      quickId: def.id,
      name: def.name,
      tag: def.tag,
    };
  });
}

/**
 * Build the complete 8-row × 3-variation Delay Time & LFO Matrix.
 */
export function calculateDelayMatrix(bpm) {
  const safeBpm = clampBpm(bpm);
  return SUBDIVISIONS.map((sub) => ({
    ...sub,
    straight: calculateDelayCell(safeBpm, sub.denom, 'straight'),
    dotted: calculateDelayCell(safeBpm, sub.denom, 'dotted'),
    triplet: calculateDelayCell(safeBpm, sub.denom, 'triplet'),
  }));
}

/**
 * Calculate Reverb Pre-Delay + Decay (RT60) timing guaranteed to resolve on target musical length.
 * Invariant when valid: preDelayMs + decayMs === totalMs (within IEEE-754 precision).
 */
export function calculateReverbTiming(bpm, {
  preDelayDenom = 32,
  preDelayVariation = 'straight',
  totalBeats = 4,
} = {}) {
  const safeBpm = clampBpm(bpm);
  const beatMs = 60000 / safeBpm;
  const totalMs = beatMs * totalBeats;
  const preDelayMs = preDelayDenom && preDelayDenom > 0
    ? calculateNoteMs(safeBpm, preDelayDenom, preDelayVariation)
    : 0;

  const varDef = VARIATIONS[preDelayVariation] || VARIATIONS.straight;
  const preDelayNoteLabel = preDelayDenom && preDelayDenom > 0
    ? (varDef.id === 'straight' ? `1/${preDelayDenom}` : `1/${preDelayDenom} ${varDef.label}`)
    : 'None (0 ms)';

  const totalOption = REVERB_TOTAL_OPTIONS.find((opt) => opt.beats === totalBeats);
  const totalLabel = totalOption ? totalOption.label : `${totalBeats} Beats`;

  if (preDelayMs >= totalMs) {
    return {
      bpm: safeBpm,
      valid: false,
      warning: `Pre-Delay (${formatMs(preDelayMs)} ms, ${preDelayNoteLabel}) meets or exceeds Target Reverb Total (${formatMs(totalMs)} ms, ${totalLabel}). Choose a shorter Pre-Delay or longer Target Total so the decay tail has room to resolve.`,
      preDelayDenom,
      preDelayVariation: varDef.id,
      preDelayNoteLabel,
      totalBeats,
      totalLabel,
      preDelayMs,
      preDelaySeconds: preDelayMs / 1000,
      decayMs: 0,
      decaySeconds: 0,
      totalMs,
      totalSeconds: totalMs / 1000,
      preDelaySamples44100: Math.round((preDelayMs / 1000) * SAMPLE_RATES.STANDARD),
      preDelaySamples48000: Math.round((preDelayMs / 1000) * SAMPLE_RATES.STUDIO),
      preDelayRatio: 1,
      decayRatio: 0,
    };
  }

  const decayMs = totalMs - preDelayMs;

  return {
    bpm: safeBpm,
    valid: true,
    warning: null,
    preDelayDenom,
    preDelayVariation: varDef.id,
    preDelayNoteLabel,
    totalBeats,
    totalLabel,
    preDelayMs,
    preDelaySeconds: preDelayMs / 1000,
    decayMs,
    decaySeconds: decayMs / 1000,
    totalMs,
    totalSeconds: totalMs / 1000,
    preDelaySamples44100: Math.round((preDelayMs / 1000) * SAMPLE_RATES.STANDARD),
    preDelaySamples48000: Math.round((preDelayMs / 1000) * SAMPLE_RATES.STUDIO),
    preDelayRatio: totalMs > 0 ? preDelayMs / totalMs : 0,
    decayRatio: totalMs > 0 ? decayMs / totalMs : 0,
  };
}

/**
 * Compute all 7 studio-calibrated Tempo-Synced Reverb Presets for a given BPM.
 */
export function calculateReverbPresets(bpm) {
  const safeBpm = clampBpm(bpm);
  return REVERB_PRESET_DEFS.map((preset) => {
    const timing = calculateReverbTiming(safeBpm, {
      preDelayDenom: preset.preDelayDenom,
      preDelayVariation: preset.preDelayVariation,
      totalBeats: preset.totalBeats,
    });
    return {
      ...preset,
      ...timing,
      totalLabel: preset.totalLabel,
    };
  });
}

/**
 * Compute tempo-synced Compressor Attack / Release & Sidechain Pump timings.
 */
export function calculateDynamicsTimings(bpm) {
  const safeBpm = clampBpm(bpm);
  const specs = [
    {
      id: 'punchy-attack',
      category: 'Attack',
      name: 'Punchy Transient Attack',
      subdivision: '1/128',
      denom: 128,
      variation: 'straight',
      usage: 'Lets kick/snare snap & vocal consonants punch through before gain reduction clamps.',
    },
    {
      id: 'fast-attack',
      category: 'Attack',
      name: 'Fast Peak Control',
      subdivision: '1/256',
      denom: 256,
      variation: 'straight',
      usage: 'Tames sharp vocal sibilance or aggressive transient spikes without dulling tone.',
    },
    {
      id: 'transparent-release',
      category: 'Release',
      name: 'Transparent Glue Release',
      subdivision: '1/16',
      denom: 16,
      variation: 'straight',
      usage: 'Recovers cleanly before the next 16th-note pulse for invisible mix-bus glue.',
    },
    {
      id: 'pumping-sidechain',
      category: 'Sidechain',
      name: 'Pumping Sidechain Release',
      subdivision: '1/8',
      denom: 8,
      variation: 'straight',
      usage: 'Classic 4-on-the-floor kick ducking — breathes back to full level on the upbeat.',
    },
    {
      id: 'dotted-sidechain',
      category: 'Sidechain',
      name: 'Deep Groove Sidechain',
      subdivision: '1/8 Dotted',
      denom: 8,
      variation: 'dotted',
      usage: 'Deep dark-pop / trap bass swell that lingers across the off-beat before snapping open.',
    },
    {
      id: 'vocal-opto-release',
      category: 'Release',
      name: 'Smooth Vocal Opto Release',
      subdivision: '1/4 Triplet',
      denom: 4,
      variation: 'triplet',
      usage: 'Musical optical-style leveling that rides vocal phrases smoothly without pumping.',
    },
  ];

  return specs.map((item) => {
    const ms = calculateNoteMs(safeBpm, item.denom, item.variation);
    return {
      ...item,
      ms,
      seconds: ms / 1000,
    };
  });
}

/**
 * Compute Swing / Humanize delay offsets in milliseconds for off-beat 16th & 8th notes.
 * Formula: For swing percentage P (50 = straight, 66.67 = full triplet),
 * 16th-note swing delay = (1/8 note ms) * ((P - 50) / 100).
 * 8th-note half-time swing delay = (1/4 note ms) * ((P - 50) / 100).
 */
export function calculateSwingOffsets(bpm) {
  const safeBpm = clampBpm(bpm);
  const eighthMs = calculateNoteMs(safeBpm, 8, 'straight');
  const quarterMs = calculateNoteMs(safeBpm, 4, 'straight');
  const sixteenthMs = eighthMs / 2;

  return SWING_LEVELS.map((level) => {
    const shiftRatio = (level.percent - 50) / 100;
    const offset16thMs = eighthMs * shiftRatio;
    const offset8thMs = quarterMs * shiftRatio;
    const long16thMs = sixteenthMs + offset16thMs;
    const short16thMs = sixteenthMs - offset16thMs;

    return {
      ...level,
      displayPercent: level.displayPercent || `${level.percent}%`,
      offset16thMs,
      offset8thMs,
      long16thMs,
      short16thMs,
    };
  });
}

/**
 * Helper to compute median of a numeric array.
 */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Tap Tempo Engine:
 * - Rolling window of last 8 taps (up to 7 intervals)
 * - Automatic reset after 2500 ms idle pause
 * - Outlier rejection: drops spike intervals > 1.8× median interval
 * - Returns smoothed BPM rounded to 0.1 accuracy + tap stability metrics
 */
export class TapTempoEngine {
  constructor({
    maxTaps = 8,
    resetTimeoutMs = 2500,
    outlierMultiplier = 1.8,
  } = {}) {
    this.maxTaps = maxTaps;
    this.resetTimeoutMs = resetTimeoutMs;
    this.outlierMultiplier = outlierMultiplier;
    this.taps = [];
    this.lastResult = {
      bpm: null,
      rawBpm: null,
      tapCount: 0,
      usedIntervals: 0,
      droppedOutliers: 0,
      stability: 0,
      stabilityLabel: 'READY',
      wasReset: false,
    };
  }

  reset() {
    this.taps = [];
    this.lastResult = {
      bpm: null,
      rawBpm: null,
      tapCount: 0,
      usedIntervals: 0,
      droppedOutliers: 0,
      stability: 0,
      stabilityLabel: 'READY',
      wasReset: true,
    };
    return this.lastResult;
  }

  tap(timestampMs = Date.now()) {
    const now = Number(timestampMs);
    if (!Number.isFinite(now)) {
      return this.lastResult;
    }

    let wasReset = false;
    if (this.taps.length > 0) {
      const elapsed = now - this.taps[this.taps.length - 1];
      if (elapsed > this.resetTimeoutMs || elapsed <= 0) {
        this.taps = [];
        wasReset = true;
      }
    }

    this.taps.push(now);
    if (this.taps.length > this.maxTaps) {
      this.taps.shift();
    }

    if (this.taps.length < 2) {
      this.lastResult = {
        bpm: null,
        rawBpm: null,
        tapCount: this.taps.length,
        usedIntervals: 0,
        droppedOutliers: 0,
        stability: 0,
        stabilityLabel: 'TAP AGAIN',
        wasReset,
      };
      return this.lastResult;
    }

    const intervals = [];
    for (let i = 1; i < this.taps.length; i += 1) {
      intervals.push(this.taps[i] - this.taps[i - 1]);
    }

    let kept = intervals;
    let droppedOutliers = 0;

    if (intervals.length >= 3) {
      const med = median(intervals);
      const upperLimit = med * this.outlierMultiplier;
      const filtered = intervals.filter((iv) => iv <= upperLimit);
      if (filtered.length > 0) {
        droppedOutliers = intervals.length - filtered.length;
        kept = filtered;
      }
    }

    const meanInterval = kept.reduce((acc, v) => acc + v, 0) / kept.length;
    const rawBpm = 60000 / meanInterval;
    const clampedBpm = clampBpm(rawBpm);
    const smoothedBpm = Math.round(clampedBpm);

    let stability = 55;
    let stabilityLabel = 'WARMING UP';

    if (kept.length >= 2) {
      const variance = kept.reduce((acc, v) => acc + ((v - meanInterval) ** 2), 0) / kept.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / meanInterval;
      stability = Math.round(Math.max(0, Math.min(100, (1 - cv * 5) * 100)));
      if (this.taps.length < 4) {
        stabilityLabel = 'WARMING UP';
      } else if (stability >= 88) {
        stabilityLabel = 'LOCKED';
      } else if (stability >= 70) {
        stabilityLabel = 'STEADY';
      } else {
        stabilityLabel = 'DRIFTING';
      }
    }

    this.lastResult = {
      bpm: smoothedBpm,
      rawBpm,
      tapCount: this.taps.length,
      usedIntervals: kept.length,
      droppedOutliers,
      stability,
      stabilityLabel,
      wasReset,
    };

    return this.lastResult;
  }
}

/**
 * Generate a clean, paste-ready Studio Timing Cheat Sheet in Markdown format.
 */
export function generateMarkdownSheet(bpm, customReverb = null) {
  const safeBpm = clampBpm(bpm);
  const bpmStr = formatBpm(safeBpm);
  const summary = calculateTempoSummary(safeBpm);
  const reverbPresets = calculateReverbPresets(safeBpm);
  const delayMatrix = calculateDelayMatrix(safeBpm);
  const dynamics = calculateDynamicsTimings(safeBpm);
  const swing = calculateSwingOffsets(safeBpm);

  const lines = [
    `# Studio Timing Sheet — ${bpmStr} BPM`,
    `Generated by **Reverb & Delay Counter** (` + '`TOOL / 006`' + `) · Saint Gordon Collective`,
    '',
    `## Tempo Reference`,
    `- **BPM:** ${bpmStr}`,
    `- **1 Beat (1/4 Note):** ${formatMs(summary.beatMs)} ms (${formatSec(summary.beatMs)} s) · ${formatHz(summary.beatHz)} Hz`,
    `- **1 Bar (4/4 Whole):** ${formatMs(summary.barMs)} ms (${formatSec(summary.barMs)} s)`,
    `- **Samples per Beat:** ${formatSamples(summary.beatSamples44100)} @ 44.1 kHz · ${formatSamples(summary.beatSamples48000)} @ 48 kHz`,
    '',
    '## Reverb Pre-Delay & Decay (RT60)',
    '| Reverb Size | Pre-Delay | Decay Time (RT60) | Total Reverb | Target Length |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const preset of reverbPresets) {
    lines.push(
      `| **${preset.name}** | ${formatMs(preset.preDelayMs)} ms (${preset.preDelayLabel}) | ${formatSecShort(preset.decayMs)} s (${formatMs(preset.decayMs)} ms) | ${formatSecShort(preset.totalMs)} s (${formatMs(preset.totalMs)} ms) | ${preset.totalLabel} |`
    );
  }

  if (customReverb && customReverb.valid) {
    lines.push(
      `| **Custom Reverb** | ${formatMs(customReverb.preDelayMs)} ms (${customReverb.preDelayNoteLabel}) | ${formatSecShort(customReverb.decayMs)} s (${formatMs(customReverb.decayMs)} ms) | ${formatSecShort(customReverb.totalMs)} s (${formatMs(customReverb.totalMs)} ms) | ${customReverb.totalLabel} |`
    );
  }

  lines.push(
    '',
    `## Delay Time & LFO Matrix`,
    '| Note | Straight (ms / Hz) | Dotted 1.5× (ms / Hz) | Triplet 2/3× (ms / Hz) | Straight Samples (44.1k / 48k) |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const row of delayMatrix) {
    lines.push(
      `| **${row.label}** (${row.name}) | ${formatMs(row.straight.ms)} ms (${formatHz(row.straight.hz)} Hz) | ${formatMs(row.dotted.ms)} ms (${formatHz(row.dotted.hz)} Hz) | ${formatMs(row.triplet.ms)} ms (${formatHz(row.triplet.hz)} Hz) | ${formatSamples(row.straight.samples44100)} / ${formatSamples(row.straight.samples48000)} |`
    );
  }

  lines.push(
    '',
    '## Dynamics & Sidechain Timings',
    '| Setting | Musical Value | Time (ms) |',
    '| :--- | :--- | :--- |'
  );

  for (const dyn of dynamics) {
    lines.push(`| **${dyn.name}** (${dyn.category}) | ${dyn.subdivision} | ${formatMs(dyn.ms)} ms |`);
  }

  lines.push(
    '',
    '## Groove & Swing Delay Offsets',
    '| Swing Feel | Percentage | 16th-Note Offset (ms) | 8th-Note Offset (ms) |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const sw of swing) {
    lines.push(`| **${sw.name}** | ${sw.displayPercent} | +${formatMs(sw.offset16thMs)} ms | +${formatMs(sw.offset8thMs)} ms |`);
  }

  lines.push(
    '',
    '---',
    '_Saint Gordon Collective · https://saintgordon.github.io/reverb-delay-counter/_'
  );

  return lines.join('\n');
}
