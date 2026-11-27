/**
 * Reverb & Delay Counter — Click Metronome & Audio Auto-BPM Engine
 * 100% client-side Web Audio API (Chrome, Safari/iOS Safari, Firefox, Edge).
 */

import { clampBpm } from './timing-math.js';

export class StudioAuditionEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bpm = 120;
    this.metronomeRunning = false;
    this.metronomeTimer = null;
    this.nextBeatTime = 0;
    this.currentBeat = 0;
    this.beatVisualTimers = new Set();
    this.onBeatCallback = null;
  }

  async ensureContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    return this.ctx;
  }

  setBpm(bpm) {
    this.bpm = clampBpm(bpm);
  }

  setOnBeat(callback) {
    this.onBeatCallback = callback;
  }

  async startMetronome(bpm = this.bpm) {
    this.setBpm(bpm);
    const ctx = await this.ensureContext();
    if (this.metronomeRunning) return;

    this.metronomeRunning = true;
    this.currentBeat = 0;
    this.nextBeatTime = ctx.currentTime + 0.04;

    const scheduleAheadTime = 0.12;
    const lookaheadMs = 25;

    const scheduler = () => {
      if (!this.metronomeRunning || !this.ctx) return;
      while (this.nextBeatTime < this.ctx.currentTime + scheduleAheadTime) {
        this._scheduleClick(this.currentBeat, this.nextBeatTime);
        this.nextBeatTime += 60.0 / this.bpm;
        this.currentBeat = (this.currentBeat + 1) % 4;
      }
    };

    scheduler();
    this.metronomeTimer = window.setInterval(scheduler, lookaheadMs);
  }

  stopMetronome() {
    this.metronomeRunning = false;
    if (this.metronomeTimer !== null) {
      window.clearInterval(this.metronomeTimer);
      this.metronomeTimer = null;
    }
    for (const tid of this.beatVisualTimers) {
      window.clearTimeout(tid);
    }
    this.beatVisualTimers.clear();
  }

  async toggleMetronome(bpm = this.bpm) {
    if (this.metronomeRunning) {
      this.stopMetronome();
      return false;
    }
    await this.startMetronome(bpm);
    return true;
  }

  _scheduleClick(beatIndex, time) {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;

    const isDownbeat = beatIndex === 0;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isDownbeat ? 1560 : 1040, time);
    osc.frequency.exponentialRampToValueAtTime(isDownbeat ? 880 : 620, time + 0.028);

    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(isDownbeat ? 0.42 : 0.26, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.055);

    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    const tid = window.setTimeout(() => {
      this.beatVisualTimers.delete(tid);
      if (this.metronomeRunning && typeof this.onBeatCallback === 'function') {
        this.onBeatCallback(beatIndex, isDownbeat);
      }
    }, delayMs);
    this.beatVisualTimers.add(tid);
  }

  async detectBpmFromAudioFile(file) {
    if (!file) {
      throw new Error('No audio file provided.');
    }

    const ctx = await this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    const sr = audioBuffer.sampleRate;
    const totalSamples = audioBuffer.length;
    const duration = audioBuffer.duration;

    if (duration < 2) {
      throw new Error('Audio clip is too short to estimate BPM (need at least 2 seconds).');
    }

    const maxAnalyzeSec = 45;
    const startSec = duration > 60 ? Math.min(20, (duration - maxAnalyzeSec) * 0.35) : 0;
    const startSample = Math.floor(startSec * sr);
    const analyzeSamples = Math.min(totalSamples - startSample, Math.floor(maxAnalyzeSec * sr));

    const mono = new Float32Array(analyzeSamples);
    const numCh = audioBuffer.numberOfChannels;
    for (let c = 0; c < numCh; c += 1) {
      const chData = audioBuffer.getChannelData(c);
      const scale = 1 / numCh;
      for (let i = 0; i < analyzeSamples; i += 1) {
        mono[i] += chData[startSample + i] * scale;
      }
    }

    const hopSize = Math.max(256, Math.round(sr * 0.0116));
    const frameRate = sr / hopSize;
    const numFrames = Math.floor(analyzeSamples / hopSize);

    if (numFrames < 100) {
      throw new Error('Audio clip is too short for reliable tempo detection.');
    }

    const lowEnergy = new Float32Array(numFrames);
    const fullEnergy = new Float32Array(numFrames);
    const lpAlpha = Math.exp((-2 * Math.PI * 180) / sr);
    let lp = 0;

    for (let f = 0; f < numFrames; f += 1) {
      const offset = f * hopSize;
      let sumLow = 0;
      let sumFull = 0;
      for (let j = 0; j < hopSize; j += 1) {
        const s = mono[offset + j];
        lp = lpAlpha * lp + (1 - lpAlpha) * s;
        sumLow += lp * lp;
        sumFull += s * s;
      }
      lowEnergy[f] = Math.sqrt(sumLow / hopSize);
      fullEnergy[f] = Math.sqrt(sumFull / hopSize);
    }

    const onset = new Float32Array(numFrames);
    for (let f = 1; f < numFrames; f += 1) {
      const dLow = Math.max(0, lowEnergy[f] - lowEnergy[f - 1]);
      const dFull = Math.max(0, fullEnergy[f] - fullEnergy[f - 1]);
      onset[f] = dLow * 1.45 + dFull * 0.85;
    }

    const winRadius = Math.round(frameRate * 0.16);
    const flux = new Float32Array(numFrames);
    let meanFlux = 0;
    for (let f = 0; f < numFrames; f += 1) {
      const lo = Math.max(0, f - winRadius);
      const hi = Math.min(numFrames - 1, f + winRadius);
      let sum = 0;
      for (let k = lo; k <= hi; k += 1) {
        sum += onset[k];
      }
      const localMean = sum / (hi - lo + 1);
      const val = Math.max(0, onset[f] - localMean * 0.92);
      flux[f] = val;
      meanFlux += val;
    }
    meanFlux /= numFrames;

    if (meanFlux < 1e-6) {
      throw new Error('Could not detect clear rhythmic transients in this audio file.');
    }

    const minBpm = 62;
    const maxBpm = 185;
    const minLag = Math.max(4, Math.floor((60 / maxBpm) * frameRate));
    const maxLag = Math.min(Math.floor(numFrames / 3), Math.ceil((60 / minBpm) * frameRate));

    const acf = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      const count = numFrames - lag;
      for (let i = 0; i < count; i += 1) {
        sum += flux[i] * flux[i + lag];
      }
      acf[lag] = sum / count;
    }

    let bestLag = minLag;
    let bestScore = -1;
    const scores = new Float32Array(maxLag + 2);
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      const candBpm = (60 * frameRate) / lag;
      const prior = Math.exp(-0.5 * (((candBpm - 116) / 42) ** 2));
      const dblLag = lag * 2;
      const harmonicBoost = dblLag <= maxLag ? acf[dblLag] * 0.35 : 0;
      const score = (acf[lag] + harmonicBoost) * (0.65 + 0.35 * prior);
      scores[lag] = score;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }

    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < maxLag) {
      const y1 = scores[bestLag - 1];
      const y2 = scores[bestLag];
      const y3 = scores[bestLag + 1];
      const denom = y1 - 2 * y2 + y3;
      if (Math.abs(denom) > 1e-12) {
        const delta = (0.5 * (y1 - y3)) / denom;
        if (Math.abs(delta) < 1) {
          refinedLag = bestLag + delta;
        }
      }
    }

    const detectedBpm = clampBpm(Math.round((60 * frameRate) / refinedLag));
    return {
      bpm: detectedBpm,
      filename: file.name || 'Audio Track',
    };
  }
}
