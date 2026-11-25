/**
 * Reverb & Delay Counter — Web Audio Audition & Onset-Autocorrelation BPM Engine
 * 100% client-side Web Audio API synthesis (Chrome, Safari/iOS Safari, Firefox, Edge).
 */

import { clampBpm } from './timing-math.js';

export class StudioAuditionEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.limiter = null;
    this.volume = 0.85;

    // Metronome scheduler state
    this.bpm = 120;
    this.metronomeRunning = false;
    this.metronomeTimer = null;
    this.nextBeatTime = 0;
    this.currentBeat = 0;
    this.beatVisualTimers = new Set();
    this.onBeatCallback = null;

    // Active audition cleanup handle
    this.activeAudition = null;
    this.onAuditionStateChange = null;
  }

  /**
   * Lazily create and unlock the AudioContext on user gesture.
   */
  async ensureContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;

      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.08;

      this.masterGain.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    return this.ctx;
  }

  setBpm(bpm) {
    this.bpm = clampBpm(bpm);
  }

  setVolume(val) {
    const clamped = Math.max(0, Math.min(1, Number(val)));
    this.volume = Number.isFinite(clamped) ? clamped : 0.85;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.015);
    }
  }

  setOnBeat(callback) {
    this.onBeatCallback = callback;
  }

  setOnAuditionStateChange(callback) {
    this.onAuditionStateChange = callback;
  }

  /* ========================================================================
     METRONOME (Web Audio Lookahead Scheduler)
     ======================================================================== */

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
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextBeatTime += secondsPerBeat;
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

    // Subtle crisp attack click for studio precision
    const clickOsc = ctx.createOscillator();
    const clickEnv = ctx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(isDownbeat ? 3200 : 2200, time);
    clickEnv.gain.setValueAtTime(isDownbeat ? 0.18 : 0.1, time);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.01);
    clickOsc.connect(clickEnv);
    clickEnv.connect(this.masterGain);
    clickOsc.start(time);
    clickOsc.stop(time + 0.015);

    // Trigger visual beat indicator synchronized to audio time
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    const tid = window.setTimeout(() => {
      this.beatVisualTimers.delete(tid);
      if (this.metronomeRunning && typeof this.onBeatCallback === 'function') {
        this.onBeatCallback(beatIndex, isDownbeat);
      }
    }, delayMs);
    this.beatVisualTimers.add(tid);
  }

  /* ========================================================================
     AUDITION LIFECYCLE MANAGEMENT
     ======================================================================== */

  stopAudition() {
    if (!this.activeAudition) return;
    const prev = this.activeAudition;
    this.activeAudition = null;

    if (prev.timerId !== null) {
      window.clearTimeout(prev.timerId);
    }

    if (prev.busGain && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        prev.busGain.gain.cancelScheduledValues(now);
        prev.busGain.gain.setValueAtTime(prev.busGain.gain.value, now);
        prev.busGain.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      } catch {
        // Ignore if already disconnected
      }
      window.setTimeout(() => {
        try {
          prev.cleanup();
        } catch {
          // Ignore teardown errors
        }
      }, 65);
    } else {
      try {
        prev.cleanup();
      } catch {
        // Ignore
      }
    }

    if (typeof this.onAuditionStateChange === 'function') {
      this.onAuditionStateChange({ active: false, id: null, type: null, label: '' });
    }
  }

  stopAll() {
    this.stopMetronome();
    this.stopAudition();
  }

  /* ========================================================================
     DELAY TIME AUDITION (Synthesized Studio Rimshot -> Web Audio DelayNode)
     ======================================================================== */

  async auditionDelay({ delayMs, id = '', label = '' }) {
    const ctx = await this.ensureContext();
    this.stopAudition();

    const now = ctx.currentTime + 0.015;
    const rawDelaySec = Math.max(0.002, delayMs / 1000);
    // Clamp Web Audio delay node cleanly while keeping accurate real-world times
    const delaySec = Math.min(rawDelaySec, 12.0);
    const maxDelayTime = Math.min(16.0, Math.max(2.0, delaySec + 0.5));

    const busGain = ctx.createGain();
    busGain.gain.setValueAtTime(1.0, now);
    busGain.connect(this.masterGain);

    // Dry + Wet mix buses
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.85;
    dryGain.connect(busGain);

    const delayNode = ctx.createDelay(maxDelayTime);
    delayNode.delayTime.setValueAtTime(delaySec, now);

    const feedbackFilter = ctx.createBiquadFilter();
    feedbackFilter.type = 'lowpass';
    feedbackFilter.frequency.value = 3800;

    const feedbackHp = ctx.createBiquadFilter();
    feedbackHp.type = 'highpass';
    feedbackHp.frequency.value = 180;

    const feedbackGain = ctx.createGain();
    // Gentler feedback for ultra-short comb/slap delays (< 45ms)
    feedbackGain.gain.value = delaySec < 0.045 ? 0.36 : 0.48;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.72;

    delayNode.connect(feedbackFilter);
    feedbackFilter.connect(feedbackHp);
    feedbackHp.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    feedbackFilter.connect(wetGain);
    wetGain.connect(busGain);

    // Synthesize crisp studio rimshot / vocal-snap transient
    const srcGain = ctx.createGain();
    srcGain.gain.value = 1.0;
    srcGain.connect(dryGain);
    srcGain.connect(delayNode);

    const bodyOsc = ctx.createOscillator();
    const bodyEnv = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(420, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(155, now + 0.032);
    bodyEnv.gain.setValueAtTime(0.0001, now);
    bodyEnv.gain.linearRampToValueAtTime(0.55, now + 0.002);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    bodyOsc.connect(bodyEnv);
    bodyEnv.connect(srcGain);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.055);

    const crackOsc = ctx.createOscillator();
    const crackEnv = ctx.createGain();
    crackOsc.type = 'sine';
    crackOsc.frequency.setValueAtTime(1750, now);
    crackOsc.frequency.exponentialRampToValueAtTime(920, now + 0.015);
    crackEnv.gain.setValueAtTime(0.35, now);
    crackEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    crackOsc.connect(crackEnv);
    crackEnv.connect(srcGain);
    crackOsc.start(now);
    crackOsc.stop(now + 0.025);

    // Filtered noise snap for crisp echo transients
    const noiseLen = Math.floor(ctx.sampleRate * 0.035);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i += 1) {
      const env = Math.exp((-i / noiseLen) * 7.5);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const noiseBand = ctx.createBiquadFilter();
    noiseBand.type = 'bandpass';
    noiseBand.frequency.value = 2600;
    noiseBand.Q.value = 1.1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.55;
    noiseSrc.connect(noiseBand);
    noiseBand.connect(noiseGain);
    noiseGain.connect(srcGain);
    noiseSrc.start(now);

    // Schedule automatic clean fade-out after ~3-4 repeats (guaranteeing at least 1 full echo on long notes)
    const targetRepeatWindow = Math.max(delaySec * 3.6 + 0.35, 1.35);
    const maxWindow = Math.min(13.5, Math.max(6.5, delaySec + 1.25));
    const audibleDurationSec = Math.min(targetRepeatWindow, maxWindow);
    const fadeStart = now + audibleDurationSec - 0.18;
    busGain.gain.setValueAtTime(1.0, fadeStart);
    busGain.gain.linearRampToValueAtTime(0.0001, now + audibleDurationSec);

    const nodes = [busGain, dryGain, delayNode, feedbackFilter, feedbackHp, feedbackGain, wetGain, srcGain];
    const cleanup = () => {
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          // Ignore
        }
      }
    };

    const handle = {
      id,
      type: 'delay',
      label,
      busGain,
      cleanup,
      timerId: null,
    };

    handle.timerId = window.setTimeout(() => {
      if (this.activeAudition === handle) {
        this.activeAudition = null;
        cleanup();
        if (typeof this.onAuditionStateChange === 'function') {
          this.onAuditionStateChange({ active: false, id: null, type: null, label: '' });
        }
      }
    }, Math.ceil(audibleDurationSec * 1000) + 60);

    this.activeAudition = handle;
    if (typeof this.onAuditionStateChange === 'function') {
      this.onAuditionStateChange({
        active: true,
        id,
        type: 'delay',
        label,
        durationMs: audibleDurationSec * 1000,
      });
    }

    return { durationMs: audibleDurationSec * 1000 };
  }

  /* ========================================================================
     REVERB AUDITION (Pre-Delay DelayNode + Synthesized RT60 Stereo Convolver)
     ======================================================================== */

  async auditionReverb({ preDelayMs, decayMs, color = 'plate', id = '', label = '' }) {
    const ctx = await this.ensureContext();
    this.stopAudition();

    const now = ctx.currentTime + 0.015;
    const preDelaySec = Math.max(0, Math.min(preDelayMs / 1000, 4.0));
    // Cap IR buffer at 9.5 seconds to stay lightweight on mobile Safari
    const decaySec = Math.max(0.04, Math.min(decayMs / 1000, 9.5));

    const busGain = ctx.createGain();
    busGain.gain.setValueAtTime(1.0, now);
    busGain.connect(this.masterGain);

    // Dry signal path
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.72;
    dryGain.connect(busGain);

    // Pre-Delay -> Stereo Exponential RT60 Convolver -> Air Damping -> Wet Gain
    const preDelayNode = ctx.createDelay(Math.max(1.0, preDelaySec + 0.25));
    preDelayNode.delayTime.setValueAtTime(preDelaySec, now);

    const convolver = ctx.createConvolver();
    convolver.normalize = false;
    convolver.buffer = this._createReverbImpulseResponse(ctx, decaySec, color);

    const dampFilter = ctx.createBiquadFilter();
    dampFilter.type = 'lowpass';
    dampFilter.frequency.value = color === 'plate' ? 7800 : color === 'room' ? 5200 : 6200;

    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 140;

    const wetGain = ctx.createGain();
    wetGain.gain.value = color === 'slapback' ? 0.85 : 0.75;

    preDelayNode.connect(convolver);
    convolver.connect(hpFilter);
    hpFilter.connect(dampFilter);
    dampFilter.connect(wetGain);
    wetGain.connect(busGain);

    // Synthesize musical studio dark-pop pluck + transient click so pre-delay gap is crystal clear
    const srcGain = ctx.createGain();
    srcGain.gain.value = 0.9;
    srcGain.connect(dryGain);
    srcGain.connect(preDelayNode);

    const freqs = [220, 261.63, 329.63, 440]; // A minor studio triad
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);

      const amp = idx === 0 ? 0.22 : idx === 3 ? 0.14 : 0.16;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(amp, now + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      osc.connect(env);
      env.connect(srcGain);
      osc.start(now);
      osc.stop(now + 0.13);
    });

    // Short percussive consonant click to highlight pre-delay gap cleanly
    const snapLen = Math.floor(ctx.sampleRate * 0.018);
    const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i += 1) {
      snapData[i] = (Math.random() * 2 - 1) * Math.exp((-i / snapLen) * 9);
    }
    const snapSrc = ctx.createBufferSource();
    snapSrc.buffer = snapBuf;
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.frequency.value = 3400;
    snapFilter.Q.value = 1.4;
    const snapGain = ctx.createGain();
    snapGain.gain.value = 0.4;
    snapSrc.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(srcGain);
    snapSrc.start(now);

    const totalSec = preDelaySec + decaySec;
    const endSec = totalSec + 0.25;
    busGain.gain.setValueAtTime(1.0, now + Math.max(0.05, totalSec));
    busGain.gain.linearRampToValueAtTime(0.0001, now + endSec);

    const nodes = [busGain, dryGain, preDelayNode, convolver, dampFilter, hpFilter, wetGain, srcGain];
    const cleanup = () => {
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          // Ignore
        }
      }
    };

    const handle = {
      id,
      type: 'reverb',
      label,
      busGain,
      cleanup,
      timerId: null,
    };

    handle.timerId = window.setTimeout(() => {
      if (this.activeAudition === handle) {
        this.activeAudition = null;
        cleanup();
        if (typeof this.onAuditionStateChange === 'function') {
          this.onAuditionStateChange({ active: false, id: null, type: null, label: '' });
        }
      }
    }, Math.ceil(endSec * 1000) + 80);

    this.activeAudition = handle;
    const startPerfMs = performance.now();
    const totalMs = totalSec * 1000;

    if (typeof this.onAuditionStateChange === 'function') {
      this.onAuditionStateChange({
        active: true,
        id,
        type: 'reverb',
        label,
        preDelayMs: preDelaySec * 1000,
        decayMs: decaySec * 1000,
        totalMs,
        startPerfMs,
      });
    }

    return {
      preDelayMs: preDelaySec * 1000,
      decayMs: decaySec * 1000,
      totalMs,
      startPerfMs,
    };
  }

  /**
   * Generate a stereo exponentially decaying Impulse Response matching exact RT60 (-60 dB at decaySec).
   */
  _createReverbImpulseResponse(ctx, decaySec, color) {
    const sampleRate = ctx.sampleRate;
    const length = Math.max(256, Math.floor(sampleRate * (decaySec + 0.08)));
    const buffer = ctx.createBuffer(2, length, sampleRate);

    // ln(1000) = 6.90775527898 -> amplitude drops to 0.001 (-60 dB) exactly at t = decaySec
    const decayRate = Math.LN10 * 3 / decaySec;
    const attackSec = color === 'cathedral' ? 0.025 : color === 'large-hall' ? 0.014 : 0.004;
    const lpCoeff = color === 'plate' ? 0.36 : color === 'room' ? 0.45 : 0.55;

    // Normalize overall IR RMS gently so short rooms and huge cathedrals feel level-balanced
    const baseScale = 0.24 / Math.sqrt(Math.max(0.25, Math.min(decaySec, 4.0)));

    for (let ch = 0; ch < 2; ch += 1) {
      const out = buffer.getChannelData(ch);
      let lpState = 0;

      // Subtle distinct stereo early reflections
      const erTimes = ch === 0 ? [0.007, 0.015, 0.029] : [0.009, 0.019, 0.034];
      const erAmps = [0.35, 0.24, 0.16];

      for (let i = 0; i < length; i += 1) {
        const t = i / sampleRate;
        const attackEnv = t < attackSec ? t / attackSec : 1.0;
        const decayEnv = Math.exp(-decayRate * t);
        const white = Math.random() * 2 - 1;
        // One-pole darkening filter whose warmth deepens slightly over time
        const dynLp = Math.min(0.88, lpCoeff + (t / (decaySec + 0.5)) * 0.28);
        lpState = lpState * dynLp + white * (1 - dynLp);

        out[i] = lpState * attackEnv * decayEnv * baseScale;
      }

      // Inject subtle early reflections for studio space realism
      for (let e = 0; e < erTimes.length; e += 1) {
        const idx = Math.floor(erTimes[e] * sampleRate);
        if (idx < length) {
          out[idx] += (ch === 0 ? 1 : -1) * erAmps[e] * 0.28;
        }
      }
    }

    return buffer;
  }

  /* ========================================================================
     LIGHTWEIGHT AUDIO FILE AUTO-BPM ESTIMATOR (Onset Autocorrelation)
     ======================================================================== */

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

    // Analyze up to 45 seconds from the heart of the track (skip quiet intro if > 60s)
    const maxAnalyzeSec = 45;
    const startSec = duration > 60 ? Math.min(20, (duration - maxAnalyzeSec) * 0.35) : 0;
    const startSample = Math.floor(startSec * sr);
    const analyzeSamples = Math.min(totalSamples - startSample, Math.floor(maxAnalyzeSec * sr));

    // Mix channels to mono slice
    const mono = new Float32Array(analyzeSamples);
    const numCh = audioBuffer.numberOfChannels;
    for (let c = 0; c < numCh; c += 1) {
      const chData = audioBuffer.getChannelData(c);
      const scale = 1 / numCh;
      for (let i = 0; i < analyzeSamples; i += 1) {
        mono[i] += chData[startSample + i] * scale;
      }
    }

    // Compute onset strength envelope in ~11ms frames
    const hopSize = Math.max(256, Math.round(sr * 0.0116));
    const frameRate = sr / hopSize;
    const numFrames = Math.floor(analyzeSamples / hopSize);

    if (numFrames < 100) {
      throw new Error('Audio clip is too short for reliable tempo autocorrelation.');
    }

    // Extract low-band (kick/bass) + broadband energy per frame
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

    // Half-wave rectified first-order difference (onset flux)
    const onset = new Float32Array(numFrames);
    for (let f = 1; f < numFrames; f += 1) {
      const dLow = Math.max(0, lowEnergy[f] - lowEnergy[f - 1]);
      const dFull = Math.max(0, fullEnergy[f] - fullEnergy[f - 1]);
      onset[f] = dLow * 1.45 + dFull * 0.85;
    }

    // Local mean subtraction (adaptive threshold to sharpen beat peaks)
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

    // Autocorrelation across musical tempo range 62..185 BPM
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

    // Score each lag with harmonic reinforcement (2× lag = bar/half-note confirmation)
    // and gentle perceptual Gaussian weighting centered at 116 BPM
    let bestLag = minLag;
    let bestScore = -1;
    let secondScore = -1;

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

    // Compute rough confidence by comparing best peak against median score
    const scoreSamples = [];
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (Math.abs(lag - bestLag) > 3) {
        scoreSamples.push(scores[lag]);
      }
    }
    scoreSamples.sort((a, b) => a - b);
    secondScore = scoreSamples.length ? scoreSamples[Math.floor(scoreSamples.length * 0.8)] : 0;

    // Parabolic interpolation around bestLag for sub-frame 0.1 BPM precision
    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < maxLag) {
      const y1 = scores[bestLag - 1];
      const y2 = scores[bestLag];
      const y3 = scores[bestLag + 1];
      const denom = y1 - 2 * y2 + y3;
      if (Math.abs(denom) > 1e-12) {
        const delta = 0.5 * (y1 - y3) / denom;
        if (Math.abs(delta) < 1) {
          refinedLag = bestLag + delta;
        }
      }
    }

    const detectedBpm = clampBpm(Math.round((60 * frameRate) / refinedLag));
    const ratio = secondScore > 0 ? bestScore / secondScore : 1.5;
    const confidence = Math.round(Math.max(35, Math.min(99, (ratio - 0.9) * 55)));

    return {
      bpm: detectedBpm,
      confidence,
      duration,
      sampleRate: sr,
      filename: file.name || 'Audio Track',
    };
  }
}
