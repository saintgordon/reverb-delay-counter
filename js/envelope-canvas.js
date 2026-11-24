/**
 * Reverb & Delay Counter — Monochrome Visual Reverb Envelope Diagram
 * Renders Dry Transient Hit -> Pre-Delay Silence Gap -> Exponential Decay Tail
 * aligned against musical beat & bar grid markers.
 */

import { formatMs, formatSec } from './timing-math.js';

export class ReverbEnvelopeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.timing = null;
    this.title = 'Hall';

    // Playhead animation state
    this.playheadActive = false;
    this.playheadStartPerf = 0;
    this.playheadTotalMs = 0;
    this.rafId = null;

    this._onResize = () => this.render();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this._onResize);
      this.resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', this._onResize);
    }
  }

  setTiming(timing, title = '') {
    this.timing = timing;
    this.title = title || '';
    this.render();
  }

  startPlayhead(totalMs, startPerfMs = performance.now()) {
    this.stopPlayhead();
    if (!Number.isFinite(totalMs) || totalMs <= 0) return;

    this.playheadActive = true;
    this.playheadStartPerf = startPerfMs;
    this.playheadTotalMs = totalMs;

    const tick = (now) => {
      if (!this.playheadActive) return;
      const elapsed = now - this.playheadStartPerf;
      if (elapsed >= this.playheadTotalMs) {
        this.playheadActive = false;
        this.rafId = null;
        this.render();
        return;
      }
      const visualTotalMs = (this.timing && this.timing.totalMs) || this.playheadTotalMs;
      const scaledElapsedMs = (elapsed / this.playheadTotalMs) * visualTotalMs;
      this.render(scaledElapsedMs);
      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  stopPlayhead() {
    this.playheadActive = false;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.render();
  }

  destroy() {
    this.stopPlayhead();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this._onResize);
    }
  }

  render(playheadElapsedMs = null) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx || !this.timing) return;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(280, Math.round(rect.width || canvas.width || 720));
    const cssHeight = Math.max(180, Math.round(rect.height || canvas.height || 220));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const w = cssWidth;
    const h = cssHeight;
    const isNarrow = w < 460;
    const isCompact = w < 620;

    // Layout padding
    const padLeft = isNarrow ? 34 : 46;
    const padRight = isNarrow ? 18 : 28;
    const padTop = 40;
    const padBottom = 38;
    const plotW = Math.max(120, w - padLeft - padRight);
    const plotH = Math.max(80, h - padTop - padBottom);
    const baselineY = padTop + plotH;

    // Background hardware canvas
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, w, h);

    // Horizontal dB reference rules (0 dB, -20 dB, -40 dB, -60 dB)
    const dbLevels = [
      { label: '0 dB', frac: 0 },
      { label: '-20', frac: 0.33 },
      { label: '-40', frac: 0.66 },
      { label: '-60', frac: 1 },
    ];

    ctx.font = '700 9px "Courier New", ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    for (const lvl of dbLevels) {
      const y = Math.round(padTop + lvl.frac * plotH) + 0.5;
      ctx.strokeStyle = lvl.frac === 1 ? '#3a3a3a' : '#1e1e1e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = '#6f6f6f';
      ctx.textAlign = 'right';
      ctx.fillText(lvl.label, padLeft - 7, y);
    }

    const timing = this.timing;
    const totalBeats = Math.max(0.5, timing.totalBeats || 4);
    const totalMs = Math.max(1, timing.totalMs || 1000);
    // Display slightly past target total so resolution marker sits inside frame cleanly
    const axisBeats = totalBeats * 1.1;
    const axisMs = totalMs * 1.1;

    const msToX = (ms) => padLeft + (Math.min(ms, axisMs) / axisMs) * plotW;
    const beatToX = (beat) => padLeft + (beat / axisBeats) * plotW;

    // Draw musical Beat & Bar grid lines
    const gridTicks = this._buildMusicalTicks(totalBeats, isNarrow);
    for (const tick of gridTicks) {
      const x = Math.round(beatToX(tick.beat)) + 0.5;
      if (x < padLeft || x > padLeft + plotW + 1) continue;

      ctx.strokeStyle = tick.major ? '#333333' : '#1c1c1c';
      ctx.lineWidth = 1;
      ctx.setLineDash(tick.major ? [] : [2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (tick.label) {
        ctx.fillStyle = tick.isTarget ? '#f2f2f2' : tick.major ? '#9e9e9e' : '#666666';
        ctx.textAlign = tick.beat === 0 ? 'left' : 'center';
        ctx.font = tick.isTarget
          ? '700 10px "Courier New", ui-monospace, monospace'
          : '700 9px "Courier New", ui-monospace, monospace';
        ctx.fillText(tick.label, x, baselineY + 16);
      }
    }

    // Handle invalid custom state (Pre-Delay >= Total Target)
    if (!timing.valid) {
      this._drawOverlapWarning(ctx, padLeft, padTop, plotW, plotH, timing);
      ctx.restore();
      return;
    }

    const x0 = padLeft;
    const xPre = msToX(timing.preDelayMs);
    const xEnd = msToX(totalMs);

    // 1. Pre-Delay Silence Gap region (0 -> preDelayMs)
    if (timing.preDelayMs > 0) {
      const visualPreEnd = Math.max(xPre, x0 + 4);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, padTop, visualPreEnd - x0, plotH);
      ctx.clip();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x0, padTop, visualPreEnd - x0, plotH);

      // Subtle architectural diagonal hatch
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      for (let hx = x0 - plotH; hx < visualPreEnd + plotH; hx += 8) {
        ctx.beginPath();
        ctx.moveTo(hx, baselineY);
        ctx.lineTo(hx + plotH, padTop);
        ctx.stroke();
      }
      ctx.restore();

      // Pre-delay boundary vertical rule
      ctx.strokeStyle = '#cfcfcf';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(Math.round(visualPreEnd) + 0.5, padTop);
      ctx.lineTo(Math.round(visualPreEnd) + 0.5, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Exponential Reverb Decay Tail (preDelayMs -> totalMs)
    const decayStartX = timing.preDelayMs > 0 ? Math.max(xPre, x0 + 4) : x0 + 2;
    const decaySpanX = Math.max(8, xEnd - decayStartX);
    const peakY = padTop + 10;
    const tailHeight = baselineY - peakY;

    const evalCurveY = (u) => {
      // Smooth exponential RT60 visual envelope reaching baseline at u = 1
      const expTerm = Math.exp(-4.6 * u);
      const norm = (expTerm - Math.exp(-4.6)) / (1 - Math.exp(-4.6));
      return baselineY - Math.max(0, norm) * tailHeight;
    };

    // Fill area under exponential curve
    const grad = ctx.createLinearGradient(decayStartX, peakY, xEnd, baselineY);
    grad.addColorStop(0, 'rgba(242, 242, 242, 0.28)');
    grad.addColorStop(0.5, 'rgba(242, 242, 242, 0.12)');
    grad.addColorStop(1, 'rgba(242, 242, 242, 0.02)');

    ctx.beginPath();
    ctx.moveTo(decayStartX, baselineY);
    ctx.lineTo(decayStartX, peakY);

    const steps = 96;
    for (let i = 1; i <= steps; i += 1) {
      const u = i / steps;
      const x = decayStartX + u * decaySpanX;
      const y = evalCurveY(u);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(xEnd, baselineY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle vertical drafting lines inside tail envelope
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    const barStep = Math.max(6, Math.round(decaySpanX / 44));
    for (let sx = decayStartX + barStep; sx < xEnd - 2; sx += barStep) {
      const u = (sx - decayStartX) / decaySpanX;
      const sy = evalCurveY(u);
      ctx.beginPath();
      ctx.moveTo(Math.round(sx) + 0.5, sy);
      ctx.lineTo(Math.round(sx) + 0.5, baselineY);
      ctx.stroke();
    }

    // Crisp monochrome curve stroke
    ctx.beginPath();
    ctx.moveTo(decayStartX, peakY);
    for (let i = 1; i <= steps; i += 1) {
      const u = i / steps;
      ctx.lineTo(decayStartX + u * decaySpanX, evalCurveY(u));
    }
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Decay onset dot
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(decayStartX - 2.5, peakY - 2.5, 5, 5);

    // 3. Dry Transient Hit Spike at t = 0
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0 + 1, baselineY);
    ctx.lineTo(x0 + 1, padTop + 2);
    ctx.stroke();

    // Dry hit diamond marker
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x0 + 1, padTop - 4);
    ctx.lineTo(x0 + 5, padTop + 1);
    ctx.lineTo(x0 + 1, padTop + 6);
    ctx.lineTo(x0 - 3, padTop + 1);
    ctx.closePath();
    ctx.fill();

    // 4. Resolution Boundary vertical rule at t = totalMs
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(xEnd) + 0.5, padTop - 6);
    ctx.lineTo(Math.round(xEnd) + 0.5, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(xEnd - 2.5, baselineY - 2.5, 5, 5);

    // 5. Crisp Top Annotations (non-overlapping across desktop and mobile)
    ctx.font = '700 10px "Courier New", ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    // Left tag: DRY + PRE-DELAY callout
    const preText = timing.preDelayMs > 0
      ? `PRE-DELAY ${formatMs(timing.preDelayMs)} ms`
      : 'PRE-DELAY 0.00 ms';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(isCompact ? preText : `DRY HIT -> ${preText}`, padLeft + 6, 16);

    // Right tag: DECAY + TOTAL resolution
    const decayText = isNarrow
      ? `DECAY ${(timing.decayMs / 1000).toFixed(2)}s`
      : isCompact
        ? `DECAY ${(timing.decayMs / 1000).toFixed(2)}s · TOTAL ${(totalMs / 1000).toFixed(2)}s`
        : `DECAY ${formatSec(timing.decayMs)} s (${formatMs(timing.decayMs)} ms) · TOTAL ${formatSec(totalMs)} s`;
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'right';
    ctx.fillText(decayText, padLeft + plotW, 16);

    // Mid-tail subtle label inside plot if enough room
    if (decaySpanX > 130) {
      const labelX = decayStartX + decaySpanX * 0.42;
      const labelY = Math.min(baselineY - 18, evalCurveY(0.42) - 16);
      ctx.fillStyle = '#bdbdbd';
      ctx.textAlign = 'center';
      ctx.font = '700 9px "Courier New", ui-monospace, monospace';
      ctx.fillText(`RT60 TAIL (${formatSec(timing.decayMs)}s)`, labelX, Math.max(padTop + 14, labelY));
    }

    // 6. Live Audition Playhead Sweep
    if (playheadElapsedMs !== null && playheadElapsedMs >= 0) {
      const px = msToX(Math.min(playheadElapsedMs, totalMs));
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, padTop - 4);
      ctx.lineTo(px, baselineY);
      ctx.stroke();

      // Highlight dot on envelope curve or floor during pre-delay
      let dotY = baselineY;
      if (playheadElapsedMs >= timing.preDelayMs && timing.decayMs > 0) {
        const u = Math.min(1, (playheadElapsedMs - timing.preDelayMs) / timing.decayMs);
        dotY = evalCurveY(u);
      } else {
        dotY = baselineY - 2;
      }

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, dotY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _buildMusicalTicks(totalBeats, isNarrow) {
    const ticks = [];

    if (totalBeats === 0.5) {
      ticks.push(
        { beat: 0, label: 'HIT', major: true },
        { beat: 0.125, label: isNarrow ? '' : '1/32', major: false },
        { beat: 0.25, label: '1/16', major: true },
        { beat: 0.375, label: '', major: false },
        { beat: 0.5, label: '1/8 END', major: true, isTarget: true }
      );
      return ticks;
    }

    if (totalBeats === 1) {
      ticks.push(
        { beat: 0, label: 'BEAT 1', major: true },
        { beat: 0.25, label: isNarrow ? '' : '1/16', major: false },
        { beat: 0.5, label: '1/8', major: true },
        { beat: 0.75, label: '', major: false },
        { beat: 1, label: 'BEAT 2', major: true, isTarget: true }
      );
      return ticks;
    }

    if (totalBeats === 2) {
      ticks.push(
        { beat: 0, label: 'BEAT 1', major: true },
        { beat: 0.5, label: '', major: false },
        { beat: 1, label: 'BEAT 2', major: true },
        { beat: 1.5, label: '', major: false },
        { beat: 2, label: 'BEAT 3 (1/2 BAR)', major: true, isTarget: true }
      );
      return ticks;
    }

    if (totalBeats === 4) {
      ticks.push(
        { beat: 0, label: 'BAR 1', major: true },
        { beat: 1, label: isNarrow ? 'B2' : 'BEAT 2', major: false },
        { beat: 2, label: isNarrow ? 'B3' : 'BEAT 3', major: true },
        { beat: 3, label: isNarrow ? 'B4' : 'BEAT 4', major: false },
        { beat: 4, label: 'BAR 2', major: true, isTarget: true }
      );
      return ticks;
    }

    if (totalBeats === 8) {
      for (let b = 0; b <= 8; b += 1) {
        const isBar = b % 4 === 0;
        const barNum = b / 4 + 1;
        let label = '';
        if (isBar) {
          label = `BAR ${barNum}`;
        } else if (!isNarrow && b % 2 === 0) {
          label = `BEAT ${b + 1}`;
        }
        ticks.push({
          beat: b,
          label,
          major: isBar,
          isTarget: b === 8,
        });
      }
      return ticks;
    }

    // 16 beats (4 bars) or other large counts
    const step = totalBeats >= 16 ? 2 : 1;
    for (let b = 0; b <= totalBeats; b += step) {
      const isBar = b % 4 === 0;
      const barNum = Math.floor(b / 4) + 1;
      ticks.push({
        beat: b,
        label: isBar ? `BAR ${barNum}` : '',
        major: isBar,
        isTarget: b === totalBeats,
      });
    }
    return ticks;
  }

  _drawOverlapWarning(ctx, padLeft, padTop, plotW, plotH, timing) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    for (let x = padLeft - plotH; x < padLeft + plotW + plotH; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, padTop + plotH);
      ctx.lineTo(x + plotH, padTop);
      ctx.stroke();
    }
    ctx.restore();

    const boxW = Math.min(plotW - 24, 380);
    const boxH = 54;
    const bx = padLeft + (plotW - boxW) / 2;
    const by = padTop + (plotH - boxH) / 2;

    ctx.fillStyle = '#101010';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 11px "Courier New", ui-monospace, monospace';
    ctx.fillText('PRE-DELAY EXCEEDS TARGET TOTAL', bx + boxW / 2, by + 20);

    ctx.fillStyle = '#bdbdbd';
    ctx.font = '700 10px "Courier New", ui-monospace, monospace';
    ctx.fillText(
      `${formatMs(timing.preDelayMs)} ms >= ${formatMs(timing.totalMs)} ms · SHORTEN PRE-DELAY`,
      bx + boxW / 2,
      by + 37
    );
  }
}
