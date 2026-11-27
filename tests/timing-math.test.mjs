import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_BPM,
  MAX_BPM,
  DEFAULT_BPM,
  clampBpm,
  parseBpmInput,
  formatBpm,
  formatMs,
  formatReverbDisplay,
  calculateTempoSummary,
  calculateDelayCell,
  calculateDelayMatrix,
  calculateReverbPresets,
  calculateReverbTiming,
  TapTempoEngine,
} from '../js/timing-math.js';

describe('Whole-number BPM clamping, parsing, and formatting', () => {
  it('clamps BPM safely to [20, 300] and rounds decimals to nearest whole number', () => {
    assert.equal(clampBpm(5), MIN_BPM);
    assert.equal(clampBpm(-40), MIN_BPM);
    assert.equal(clampBpm(20), 20);
    assert.equal(clampBpm(120.4), 120);
    assert.equal(clampBpm(120.5), 121);
    assert.equal(clampBpm(128.5), 129);
    assert.equal(clampBpm(300), 300);
    assert.equal(clampBpm(999), MAX_BPM);
    assert.equal(clampBpm(NaN), DEFAULT_BPM);
    assert.equal(clampBpm(Infinity), DEFAULT_BPM);
  });

  it('parses decimal and comma-formatted BPM strings into rounded whole numbers', () => {
    assert.equal(parseBpmInput('120'), 120);
    assert.equal(parseBpmInput('128.5'), 129);
    assert.equal(parseBpmInput('92,4'), 92);
    assert.equal(parseBpmInput('10'), 20);
    assert.equal(parseBpmInput('450'), 300);
    assert.equal(parseBpmInput(''), null);
    assert.equal(parseBpmInput('abc'), null);
  });

  it('formats BPM cleanly as whole numbers', () => {
    assert.equal(formatBpm(120), '120');
    assert.equal(formatBpm(128.5), '129');
    assert.equal(formatBpm(92.45), '92');
  });
});

describe('Delay Time Matrix (ms)', () => {
  it('computes exact 120 BPM textbook values', () => {
    const summary = calculateTempoSummary(120);
    assert.equal(summary.beatMs, 500);
    assert.equal(summary.barMs, 2000);
    assert.equal(calculateDelayCell(120, 4, 'straight').ms, 500);
    assert.equal(calculateDelayCell(120, 8, 'straight').ms, 250);
    assert.equal(calculateDelayCell(120, 8, 'dotted').ms, 375);
    assert.equal(formatMs(calculateDelayCell(120, 4, 'triplet').ms), '333.33');
  });

  it('produces all 8 subdivisions and preserves dotted (1.5x) and triplet (2/3x) invariants', () => {
    const matrix = calculateDelayMatrix(129);
    assert.equal(matrix.length, 8);
    assert.deepEqual(
      matrix.map((r) => r.label),
      ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64', '1/128']
    );
    for (const row of matrix) {
      assert.ok(Math.abs(row.dotted.ms - row.straight.ms * 1.5) < 1e-9);
      assert.ok(Math.abs(row.triplet.ms - row.straight.ms * (2 / 3)) < 1e-9);
    }
  });
});

describe('Reverb Pre-Delay & Decay (RT60) Engine', () => {
  it('enforces Pre-Delay + Decay === Total Musical Length across all 7 spaces and BPMs 20–300', () => {
    for (const bpm of [20, 75, 120, 129, 174, 300]) {
      const presets = calculateReverbPresets(bpm);
      assert.equal(presets.length, 7);
      for (const p of presets) {
        assert.equal(p.valid, true);
        assert.ok(Math.abs(p.preDelayMs + p.decayMs - p.totalMs) < 1e-9);
      }
    }
  });

  it('formats reverb display cleanly across plugin, ms, and sec modes', () => {
    const custom = calculateReverbTiming(120, { preDelayDenom: 32, totalBeats: 4 });
    assert.equal(formatReverbDisplay(custom.preDelayMs, 'plugin', 'predelay').primary, '62.50 ms');
    assert.equal(formatReverbDisplay(custom.decayMs, 'plugin', 'decay').primary, '1.94 s');
    assert.equal(formatReverbDisplay(custom.decayMs, 'ms', 'decay').primary, '1937.50 ms');
    assert.equal(formatReverbDisplay(custom.preDelayMs, 'sec', 'predelay').primary, '0.063 s');
  });
});

describe('Tap Tempo Engine', () => {
  it('locks onto steady taps, auto-resets after >2.5s idle, and rejects outlier spikes', () => {
    const engine = new TapTempoEngine();
    assert.equal(engine.tap(1000).bpm, null);
    assert.equal(engine.tap(1500).bpm, 120);
    assert.equal(engine.tap(2000).bpm, 120);
    // Outlier spike > 1.8x median (500ms) -> rejected
    assert.equal(engine.tap(3100).bpm, 120);
    // Idle > 2500ms -> resets
    assert.equal(engine.tap(7000).bpm, null);
    assert.equal(engine.tap(7600).bpm, 100);
  });
});
