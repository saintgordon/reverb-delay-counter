/**
 * Reverb & Delay Counter — Pure Tempo & Time-Domain Math Engine
 * Zero DOM dependencies (runs identically in browser ES Modules and Node.js tests).
 */

export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 120;

export const SUBDIVISIONS = Object.freeze([
  { id: '1/1', denom: 1, label: '1/1', name: 'Whole', beats: 4 },
  { id: '1/2', denom: 2, label: '1/2', name: 'Half', beats: 2 },
  { id: '1/4', denom: 4, label: '1/4', name: 'Quarter', beats: 1 },
  { id: '1/8', denom: 8, label: '1/8', name: 'Eighth', beats: 0.5 },
  { id: '1/16', denom: 16, label: '1/16', name: 'Sixteenth', beats: 0.25 },
  { id: '1/32', denom: 32, label: '1/32', name: '32nd', beats: 0.125 },
  { id: '1/64', denom: 64, label: '1/64', name: '64th', beats: 0.0625 },
  { id: '1/128', denom: 128, label: '1/128', name: '128th', beats: 0.03125 },
]);

export const VARIATIONS = Object.freeze({
  straight: { id: 'straight', label: 'Straight', factor: 1 },
  dotted: { id: 'dotted', label: 'Dotted', factor: 1.5 },
  triplet: { id: 'triplet', label: 'Triplet', factor: 2 / 3 },
});

export const REVERB_PRESET_DEFS = Object.freeze([
  {
    id: 'hall',
    name: 'Hall',
    totalBeats: 8,
    totalLabel: '2 Bars',
    preDelayDenom: 32,
    preDelayVariation: 'straight',
    preDelayLabel: '1/32',
  },
  {
    id: 'big-room',
    name: 'Big Room',
    totalBeats: 4,
    totalLabel: '1 Bar',
    preDelayDenom: 64,
    preDelayVariation: 'straight',
    preDelayLabel: '1/64',
  },
  {
    id: 'small-room',
    name: 'Small Room',
    totalBeats: 2,
    totalLabel: '1/2 Bar',
    preDelayDenom: 128,
    preDelayVariation: 'straight',
    preDelayLabel: '1/128',
  },
  {
    id: 'tight-ambience',
    name: 'Tight Ambience',
    totalBeats: 1,
    totalLabel: '1 Beat',
    preDelayDenom: 512,
    preDelayVariation: 'straight',
    preDelayLabel: '1/512',
  },
  {
    id: 'vocal-plate',
    name: 'Vocal Plate',
    totalBeats: 4,
    totalLabel: '1 Bar',
    preDelayDenom: 32,
    preDelayVariation: 'straight',
    preDelayLabel: '1/32',
  },
  {
    id: 'cathedral-wide',
    name: 'Cathedral',
    totalBeats: 16,
    totalLabel: '4 Bars',
    preDelayDenom: 16,
    preDelayVariation: 'straight',
    preDelayLabel: '1/16',
  },
  {
    id: 'slapback-vocal',
    name: 'Slapback',
    totalBeats: 0.5,
    totalLabel: '1/8 Note',
    preDelayDenom: 32,
    preDelayVariation: 'straight',
    preDelayLabel: '1/32',
  },
]);

/**
 * Clamp any numeric BPM safely to whole-number [MIN_BPM, MAX_BPM].
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
 * Parse a user-entered string/number into a valid whole-number BPM or null if empty/invalid.
 */
export function parseBpmInput(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/,/g, '.');
  if (cleaned === '') return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return clampBpm(num);
}

export function formatBpm(bpm) {
  return String(clampBpm(bpm));
}

export function formatMs(ms) {
  if (!Number.isFinite(ms)) return '0.00';
  return ms.toFixed(2);
}

export function formatSecShort(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0.00';
  if (ms < 100) {
    return (ms / 1000).toFixed(3);
  }
  return (ms / 1000).toFixed(2);
}

/**
 * Format a reverb timing value according to the active unit display mode:
 * - 'plugin' (default): Pre-Delay in ms; Decay & Total in s
 * - 'ms': All values in ms
 * - 'sec': All values in s
 */
export function formatReverbDisplay(ms, mode = 'plugin', role = 'decay') {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const msVal = formatMs(safeMs);
  const secVal = formatSecShort(safeMs);
  const showAsMs = mode === 'ms' || (mode === 'plugin' && role === 'predelay');

  if (showAsMs) {
    return {
      value: msVal,
      unit: 'ms',
      primary: `${msVal} ms`,
      copyValue: msVal,
    };
  }

  return {
    value: secVal,
    unit: 's',
    primary: `${secVal} s`,
    copyValue: secVal,
  };
}

export function calculateNoteMs(bpm, denom, variation = 'straight') {
  const safeBpm = clampBpm(bpm);
  const varDef = VARIATIONS[variation] || VARIATIONS.straight;
  if (!Number.isFinite(denom) || denom <= 0) {
    return 0;
  }
  return ((240000 / safeBpm) / denom) * varDef.factor;
}

export function calculateTempoSummary(bpm) {
  const safeBpm = clampBpm(bpm);
  const beatMs = 60000 / safeBpm;
  const barMs = 240000 / safeBpm;
  return {
    bpm: safeBpm,
    beatMs,
    barMs,
  };
}

export function calculateDelayCell(bpm, denom, variation = 'straight') {
  const safeBpm = clampBpm(bpm);
  const varDef = VARIATIONS[variation] || VARIATIONS.straight;
  const ms = calculateNoteMs(safeBpm, denom, varDef.id);
  const noteTag = varDef.id === 'straight' ? `1/${denom}` : `1/${denom} ${varDef.label}`;

  return {
    id: `1/${denom}-${varDef.id}`,
    denom,
    variation: varDef.id,
    noteTag,
    ms,
  };
}

export function calculateDelayMatrix(bpm) {
  const safeBpm = clampBpm(bpm);
  return SUBDIVISIONS.map((sub) => ({
    ...sub,
    straight: calculateDelayCell(safeBpm, sub.denom, 'straight'),
    dotted: calculateDelayCell(safeBpm, sub.denom, 'dotted'),
    triplet: calculateDelayCell(safeBpm, sub.denom, 'triplet'),
  }));
}

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
  const decayMs = Math.max(0, totalMs - preDelayMs);

  return {
    bpm: safeBpm,
    valid: preDelayMs < totalMs,
    preDelayDenom,
    totalBeats,
    preDelayMs,
    decayMs,
    totalMs,
  };
}

export function calculateReverbPresets(bpm) {
  const safeBpm = clampBpm(bpm);
  return REVERB_PRESET_DEFS.map((preset) => ({
    ...preset,
    ...calculateReverbTiming(safeBpm, {
      preDelayDenom: preset.preDelayDenom,
      preDelayVariation: preset.preDelayVariation,
      totalBeats: preset.totalBeats,
    }),
  }));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Tap Tempo Engine (8-tap rolling window, 2.5s auto-reset, outlier spike rejection).
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
  }

  reset() {
    this.taps = [];
  }

  tap(timestampMs = Date.now()) {
    const now = Number(timestampMs);
    if (!Number.isFinite(now)) {
      return { bpm: null, tapCount: this.taps.length };
    }

    if (this.taps.length > 0) {
      const elapsed = now - this.taps[this.taps.length - 1];
      if (elapsed > this.resetTimeoutMs || elapsed <= 0) {
        this.taps = [];
      }
    }

    this.taps.push(now);
    if (this.taps.length > this.maxTaps) {
      this.taps.shift();
    }

    if (this.taps.length < 2) {
      return { bpm: null, tapCount: this.taps.length };
    }

    const intervals = [];
    for (let i = 1; i < this.taps.length; i += 1) {
      intervals.push(this.taps[i] - this.taps[i - 1]);
    }

    let kept = intervals;
    if (intervals.length >= 3) {
      const med = median(intervals);
      const filtered = intervals.filter((iv) => iv <= med * this.outlierMultiplier);
      if (filtered.length > 0) {
        kept = filtered;
      }
    }

    const meanInterval = kept.reduce((acc, v) => acc + v, 0) / kept.length;
    const bpm = clampBpm(60000 / meanInterval);
    return { bpm, tapCount: this.taps.length };
  }
}
