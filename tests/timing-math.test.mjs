import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_BPM,
  MAX_BPM,
  DEFAULT_BPM,
  REVERB_PRE_DELAY_OPTIONS,
  clampBpm,
  parseBpmInput,
  formatBpm,
  formatMs,
  formatSec,
  formatSecShort,
  formatHz,
  formatReverbDisplay,
  calculateTempoSummary,
  calculateQuickDelays,
  calculateDelayCell,
  calculateDelayMatrix,
  calculateReverbTiming,
  calculateReverbPresets,
  calculateDynamicsTimings,
  calculateSwingOffsets,
  TapTempoEngine,
  generateMarkdownSheet,
} from '../js/timing-math.js';

describe('BPM clamping, parsing, and formatting', () => {
  it('clamps BPM safely to [20, 300] and handles non-finite inputs', () => {
    assert.equal(clampBpm(5), MIN_BPM);
    assert.equal(clampBpm(-40), MIN_BPM);
    assert.equal(clampBpm(20), 20);
    assert.equal(clampBpm(129), 129);
    assert.equal(clampBpm(120.4), 120);
    assert.equal(clampBpm(300), 300);
    assert.equal(clampBpm(999), MAX_BPM);
    assert.equal(clampBpm(NaN), DEFAULT_BPM);
    assert.equal(clampBpm(Infinity), DEFAULT_BPM);
  });

  it('parses decimal and comma-formatted BPM strings cleanly', () => {
    assert.equal(parseBpmInput('120'), 120);
    assert.equal(parseBpmInput('129'), 129);
    assert.equal(parseBpmInput('92,4'), 92);
    assert.equal(parseBpmInput('10'), 20);
    assert.equal(parseBpmInput('450'), 300);
    assert.equal(parseBpmInput(''), null);
    assert.equal(parseBpmInput('abc'), null);
  });

  it('formats integer and decimal BPM cleanly', () => {
    assert.equal(formatBpm(120), '120');
    assert.equal(formatBpm(129), '129');
    assert.equal(formatBpm(92.45), '92');
  });
});

describe('Delay Time, Quick Vocal Delays & LFO Matrix at 120 BPM', () => {
  it('computes the 4 featured Quick Vocal Delays at 120 BPM', () => {
    const quick = calculateQuickDelays(120);
    assert.equal(quick.length, 4);
    assert.deepEqual(
      quick.map((q) => q.name),
      ['Slapback 1/16', '1/8 Throw', '1/8 Dotted', '1/4 Echo']
    );
    assert.equal(formatMs(quick[0].ms), '125.00');
    assert.equal(formatMs(quick[1].ms), '250.00');
    assert.equal(formatMs(quick[2].ms), '375.00');
    assert.equal(formatMs(quick[3].ms), '500.00');
  });

  it('computes exact 120 BPM textbook values', () => {
    const qStraight = calculateDelayCell(120, 4, 'straight');
    assert.equal(formatMs(qStraight.ms), '500.00');
    assert.equal(formatSec(qStraight.ms), '0.500');
    assert.equal(formatHz(qStraight.hz), '2.00');
    assert.equal(qStraight.samples44100, 22050);
    assert.equal(qStraight.samples48000, 24000);

    const eighthDotted = calculateDelayCell(120, 8, 'dotted');
    assert.equal(formatMs(eighthDotted.ms), '375.00');
    assert.equal(formatSec(eighthDotted.ms), '0.375');
    assert.equal(formatHz(eighthDotted.hz), '2.67');
    assert.equal(eighthDotted.samples48000, 18000);

    const eighthTriplet = calculateDelayCell(120, 8, 'triplet');
    assert.equal(formatMs(eighthTriplet.ms), '166.67');
    assert.equal(formatHz(eighthTriplet.hz), '6.00');
    assert.equal(eighthTriplet.samples48000, 8000);

    const wholeStraight = calculateDelayCell(120, 1, 'straight');
    assert.equal(formatMs(wholeStraight.ms), '2000.00');
    assert.equal(formatHz(wholeStraight.hz), '0.500');
    assert.equal(wholeStraight.samples48000, 96000);

    const n128Straight = calculateDelayCell(120, 128, 'straight');
    assert.equal(formatMs(n128Straight.ms), '15.63');
    assert.equal(formatHz(n128Straight.hz), '64.00');
  });

  it('produces all 8 subdivisions and preserves dotted (1.5x), triplet (2/3x), and Hz invariants', () => {
    const matrix = calculateDelayMatrix(120);
    assert.equal(matrix.length, 8);
    assert.deepEqual(
      matrix.map((r) => r.label),
      ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64', '1/128']
    );

    for (const row of matrix) {
      assert.ok(Math.abs(row.dotted.ms - row.straight.ms * 1.5) < 1e-9);
      assert.ok(Math.abs(row.triplet.ms - row.straight.ms * (2 / 3)) < 1e-9);
      for (const cell of [row.straight, row.dotted, row.triplet]) {
        assert.ok(Math.abs(cell.hz - (1000 / cell.ms)) < 1e-9);
        assert.ok(Math.abs(cell.seconds - (cell.ms / 1000)) < 1e-12);
      }
    }
  });
});

describe('Decimal BPM accuracy (129 BPM & 92 BPM)', () => {
  it('calculates exact fractional delay times, Hz, and samples at 129 BPM', () => {
    const summary = calculateTempoSummary(129);
    const expectedBeatMs = 60000 / 129;
    assert.ok(Math.abs(summary.beatMs - expectedBeatMs) < 1e-9);
    assert.equal(formatMs(summary.beatMs), '465.12');

    const eighthDotted = calculateDelayCell(129, 8, 'dotted');
    const expectedEighthDotted = ((240000 / 129) / 8) * 1.5;
    assert.ok(Math.abs(eighthDotted.ms - expectedEighthDotted) < 1e-9);
    assert.equal(formatMs(eighthDotted.ms), '348.84');
    assert.equal(eighthDotted.samples48000, Math.round((expectedEighthDotted / 1000) * 48000));
    assert.equal(eighthDotted.samples44100, Math.round((expectedEighthDotted / 1000) * 44100));
  });

  it('calculates exact fractional timings at 92 BPM', () => {
    const sixteenth = calculateDelayCell(92, 16, 'straight');
    const expectedMs = (240000 / 92) / 16;
    assert.ok(Math.abs(sixteenth.ms - expectedMs) < 1e-9);
    assert.equal(formatMs(sixteenth.ms), '163.04');
  });
});

describe('Reverb Pre-Delay & Decay (RT60) Engine', () => {
  it('enforces Pre-Delay + Decay === Total Musical Length across all 7 presets and BPMs 20–300', () => {
    const testBpms = [20, 60, 75, 92.4, 120, 129, 140, 174, 240, 300];
    for (const bpm of testBpms) {
      const presets = calculateReverbPresets(bpm);
      assert.equal(presets.length, 7);

      for (const preset of presets) {
        assert.equal(preset.valid, true, `${preset.name} should be valid at ${bpm} BPM`);
        assert.ok(preset.preDelayMs > 0);
        assert.ok(preset.decayMs > 0);
        assert.ok(
          Math.abs((preset.preDelayMs + preset.decayMs) - preset.totalMs) < 1e-9,
          `Invariant failed for ${preset.name} at ${bpm} BPM`
        );
      }
    }
  });

  it('matches exact reverbcalculator.com values at 120 BPM for Hall, Big Room, Small Room, and Tight Ambience', () => {
    const presets = calculateReverbPresets(120);
    assert.deepEqual(
      presets.map((p) => p.name),
      ['Hall', 'Big Room', 'Small Room', 'Tight Ambience', 'Vocal Plate', 'Cathedral / Wide', 'Slapback Vocal']
    );

    const byId = Object.fromEntries(presets.map((p) => [p.id, p]));

    // 1. Hall (2 Bars, 1/32 PD)
    assert.equal(formatMs(byId.hall.preDelayMs), '62.50');
    assert.equal(formatMs(byId.hall.decayMs), '3937.50');
    assert.equal(formatSecShort(byId.hall.decayMs), '3.94');
    assert.equal(formatMs(byId.hall.totalMs), '4000.00');
    assert.equal(formatSecShort(byId.hall.totalMs), '4.00');

    // 2. Big Room (1 Bar, 1/64 PD)
    assert.equal(formatMs(byId['big-room'].preDelayMs), '31.25');
    assert.equal(formatMs(byId['big-room'].decayMs), '1968.75');
    assert.equal(formatSecShort(byId['big-room'].decayMs), '1.97');
    assert.equal(formatMs(byId['big-room'].totalMs), '2000.00');
    assert.equal(formatSecShort(byId['big-room'].totalMs), '2.00');

    // 3. Small Room (1/2 Bar, 1/128 PD)
    assert.equal(formatMs(byId['small-room'].preDelayMs), '15.63');
    assert.equal(formatMs(byId['small-room'].decayMs), '984.38');
    assert.equal(formatSecShort(byId['small-room'].decayMs), '0.98');
    assert.equal(formatMs(byId['small-room'].totalMs), '1000.00');
    assert.equal(formatSecShort(byId['small-room'].totalMs), '1.00');

    // 4. Tight Ambience (1 Beat, 1/512 PD)
    assert.equal(formatMs(byId['tight-ambience'].preDelayMs), '3.91');
    assert.equal(formatMs(byId['tight-ambience'].decayMs), '496.09');
    assert.equal(formatSecShort(byId['tight-ambience'].decayMs), '0.50');
    assert.equal(formatMs(byId['tight-ambience'].totalMs), '500.00');
    assert.equal(formatSecShort(byId['tight-ambience'].totalMs), '0.50');

    // 5. Vocal Plate (1 Bar, 1/32 PD)
    assert.equal(formatMs(byId['vocal-plate'].preDelayMs), '62.50');
    assert.equal(formatMs(byId['vocal-plate'].decayMs), '1937.50');
    assert.equal(formatSecShort(byId['vocal-plate'].decayMs), '1.94');
    assert.equal(formatMs(byId['vocal-plate'].totalMs), '2000.00');

    // 6. Cathedral / Wide (4 Bars, 1/16 PD)
    assert.equal(formatMs(byId['cathedral-wide'].preDelayMs), '125.00');
    assert.equal(formatMs(byId['cathedral-wide'].decayMs), '7875.00');
    assert.equal(formatSecShort(byId['cathedral-wide'].decayMs), '7.88');
    assert.equal(formatMs(byId['cathedral-wide'].totalMs), '8000.00');

    // 7. Slapback Vocal (1/2 Beat, 1/32 PD)
    assert.equal(formatMs(byId['slapback-vocal'].preDelayMs), '62.50');
    assert.equal(formatMs(byId['slapback-vocal'].decayMs), '187.50');
    assert.equal(formatSecShort(byId['slapback-vocal'].decayMs), '0.19');
    assert.equal(formatMs(byId['slapback-vocal'].totalMs), '250.00');
  });

  it('formats reverb display cleanly across plugin, ms, and sec modes', () => {
    const pluginPd = formatReverbDisplay(62.5, 'plugin', 'predelay');
    assert.equal(pluginPd.primary, '62.50 ms');
    assert.equal(pluginPd.copyValue, '62.50');

    const pluginDecay = formatReverbDisplay(3937.5, 'plugin', 'decay');
    assert.equal(pluginDecay.primary, '3.94 s');
    assert.equal(pluginDecay.secondary, '3937.50 ms');
    assert.equal(pluginDecay.copyValue, '3.94');

    const allMsDecay = formatReverbDisplay(3937.5, 'ms', 'decay');
    assert.equal(allMsDecay.primary, '3937.50 ms');
    assert.equal(allMsDecay.secondary, '3.94 s');
    assert.equal(allMsDecay.copyValue, '3937.50');

    const allSecPd = formatReverbDisplay(3.90625, 'sec', 'predelay');
    assert.equal(allSecPd.primary, '0.004 s');
    assert.equal(allSecPd.secondary, '3.91 ms');
  });

  it('supports Custom Reverb Builder including 1/512, None pre-delay, and overlap warning', () => {
    assert.ok(REVERB_PRE_DELAY_OPTIONS.some((o) => o.denom === 512));

    const custom512 = calculateReverbTiming(120, {
      preDelayDenom: 512,
      preDelayVariation: 'straight',
      totalBeats: 1,
    });
    assert.equal(custom512.valid, true);
    assert.equal(formatMs(custom512.preDelayMs), '3.91');
    assert.equal(formatMs(custom512.decayMs), '496.09');

    // None pre-delay -> full total goes to decay
    const noPre = calculateReverbTiming(120, {
      preDelayDenom: 0,
      preDelayVariation: 'straight',
      totalBeats: 4,
    });
    assert.equal(noPre.valid, true);
    assert.equal(noPre.preDelayMs, 0);
    assert.equal(noPre.decayMs, 2000);
    assert.equal(noPre.preDelayMs + noPre.decayMs, noPre.totalMs);

    // Dotted pre-delay on 2 bars
    const dottedCustom = calculateReverbTiming(120, {
      preDelayDenom: 16,
      preDelayVariation: 'dotted',
      totalBeats: 8,
    });
    assert.equal(dottedCustom.valid, true);
    assert.equal(formatMs(dottedCustom.preDelayMs), '187.50');
    assert.equal(formatMs(dottedCustom.decayMs), '3812.50');
    assert.ok(Math.abs((dottedCustom.preDelayMs + dottedCustom.decayMs) - dottedCustom.totalMs) < 1e-9);

    // Overlap: 1/8 straight (250 ms) >= 1/2 beat total (250 ms)
    const equalOverlap = calculateReverbTiming(120, {
      preDelayDenom: 8,
      preDelayVariation: 'straight',
      totalBeats: 0.5,
    });
    assert.equal(equalOverlap.valid, false);
    assert.equal(equalOverlap.decayMs, 0);
    assert.ok(typeof equalOverlap.warning === 'string' && equalOverlap.warning.length > 0);

    // Overlap: 1/8 dotted (375 ms) > 1/2 beat total (250 ms)
    const exceedOverlap = calculateReverbTiming(120, {
      preDelayDenom: 8,
      preDelayVariation: 'dotted',
      totalBeats: 0.5,
    });
    assert.equal(exceedOverlap.valid, false);
    assert.equal(exceedOverlap.decayMs, 0);
  });
});

describe('Dynamics, Sidechain & Swing Groove Bonus Math', () => {
  it('computes exact compressor attack & sidechain release anchors at 120 BPM', () => {
    const dyn = calculateDynamicsTimings(120);
    const byId = Object.fromEntries(dyn.map((d) => [d.id, d]));

    assert.equal(formatMs(byId['punchy-attack'].ms), '15.63');
    assert.equal(formatMs(byId['transparent-release'].ms), '125.00');
    assert.equal(formatMs(byId['pumping-sidechain'].ms), '250.00');
    assert.equal(formatMs(byId['dotted-sidechain'].ms), '375.00');
    assert.equal(formatMs(byId['vocal-opto-release'].ms), '333.33');
  });

  it('computes exact 54%, 58%, 62%, and 66.7% swing offsets at 120 BPM', () => {
    const swing = calculateSwingOffsets(120);
    assert.equal(formatMs(swing[0].offset16thMs), '10.00'); // 54%
    assert.equal(formatMs(swing[1].offset16thMs), '20.00'); // 58%
    assert.equal(formatMs(swing[2].offset16thMs), '30.00'); // 62%
    assert.equal(formatMs(swing[3].offset16thMs), '41.67'); // 66.7% triplet

    for (const sw of swing) {
      assert.ok(Math.abs(sw.offset8thMs - sw.offset16thMs * 2) < 1e-9);
    }
  });
});

describe('Tap Tempo Engine', () => {
  it('locks onto steady 120 BPM taps with 100% stability', () => {
    const engine = new TapTempoEngine();
    const r1 = engine.tap(1000);
    assert.equal(r1.bpm, null);
    assert.equal(r1.tapCount, 1);

    const r2 = engine.tap(1500);
    assert.equal(r2.bpm, 120);

    engine.tap(2000);
    const r4 = engine.tap(2500);
    assert.equal(r4.bpm, 120);
    assert.equal(r4.stability, 100);
    assert.equal(r4.stabilityLabel, 'LOCKED');
    assert.equal(r4.droppedOutliers, 0);
  });

  it('auto-resets tap history after an idle pause > 2.5 seconds', () => {
    const engine = new TapTempoEngine({ resetTimeoutMs: 2500 });
    engine.tap(1000);
    engine.tap(1500);
    engine.tap(2000);

    const afterPause = engine.tap(4600);
    assert.equal(afterPause.wasReset, true);
    assert.equal(afterPause.tapCount, 1);
    assert.equal(afterPause.bpm, null);

    const next = engine.tap(5200);
    assert.equal(next.bpm, 100);
    assert.equal(next.tapCount, 2);
  });

  it('rejects outlier spikes > 1.8x median interval', () => {
    const engine = new TapTempoEngine({ outlierMultiplier: 1.8 });
    engine.tap(0);
    engine.tap(500);
    engine.tap(1000);
    engine.tap(2200);
    const res = engine.tap(2700);

    assert.equal(res.droppedOutliers, 1);
    assert.equal(res.usedIntervals, 3);
    assert.equal(res.bpm, 120);
    assert.equal(res.stability, 100);
  });

  it('maintains a rolling window of the last 8 taps', () => {
    const engine = new TapTempoEngine({ maxTaps: 8 });
    let t = 0;
    for (let i = 0; i < 4; i += 1) {
      engine.tap(t);
      t += 600;
    }
    let last;
    for (let i = 0; i < 8; i += 1) {
      last = engine.tap(t);
      t += 400;
    }
    assert.equal(last.tapCount, 8);
    assert.equal(last.bpm, 150);
  });

  it('clamps extreme tap speeds cleanly to MAX_BPM', () => {
    const engine = new TapTempoEngine();
    engine.tap(1000);
    const res = engine.tap(1100);
    assert.equal(res.bpm, MAX_BPM);
  });
});

describe('Markdown Timing Sheet Export', () => {
  it('generates a complete Markdown sheet with all 7 Reverb presets, Delay, Dynamics, and Swing sections', () => {
    const custom = calculateReverbTiming(129, {
      preDelayDenom: 32,
      preDelayVariation: 'straight',
      totalBeats: 4,
    });
    const md = generateMarkdownSheet(129, custom);

    assert.ok(md.includes('# Studio Timing Sheet — 129 BPM'));
    assert.ok(md.includes('## Reverb Pre-Delay & Decay (RT60)'));
    assert.ok(md.includes('**Hall**'));
    assert.ok(md.includes('**Big Room**'));
    assert.ok(md.includes('**Small Room**'));
    assert.ok(md.includes('**Tight Ambience**'));
    assert.ok(md.includes('**Vocal Plate**'));
    assert.ok(md.includes('**Cathedral / Wide**'));
    assert.ok(md.includes('**Slapback Vocal**'));
    assert.ok(md.includes('**Custom Reverb**'));
    assert.ok(md.includes('## Delay Time & LFO Matrix'));
    assert.ok(md.includes('## Dynamics & Sidechain Timings'));
    assert.ok(md.includes('## Groove & Swing Delay Offsets'));
  });
});
