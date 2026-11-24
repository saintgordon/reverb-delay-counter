/**
 * Reverb & Delay Counter (TOOL / 006) — Saint Gordon Collective
 * Application Controller
 */

import {
  DEFAULT_BPM,
  clampBpm,
  parseBpmInput,
  formatBpm,
  formatMs,
  formatSec,
  formatHz,
  formatSamples,
  calculateTempoSummary,
  calculateDelayMatrix,
  calculateReverbPresets,
  calculateReverbTiming,
  calculateDynamicsTimings,
  calculateSwingOffsets,
  TapTempoEngine,
  generateMarkdownSheet,
} from './timing-math.js';
import { StudioAuditionEngine } from './audition-audio.js';
import { ReverbEnvelopeRenderer } from './envelope-canvas.js';

const STORAGE_KEY = 'sg_reverb_delay_bpm_v1';

const state = {
  bpm: DEFAULT_BPM,
  sampleRateView: 'both', // 'both' | '48000' | '44100'
  selectedReverbSource: 'vocal-plate', // preset id or 'custom'
  customPreDelayDenom: 32,
  customPreDelayVariation: 'straight',
  customTotalBeats: 4,
  activeAuditionId: null,
  activeAuditionType: null,
  activeAuditionLabel: '',
  isAnalyzingFile: false,
};

const tapEngine = new TapTempoEngine({
  maxTaps: 8,
  resetTimeoutMs: 2500,
  outlierMultiplier: 1.8,
});

const audioEngine = new StudioAuditionEngine();
let envelopeRenderer = null;
let tapIdleTimer = null;
let beatPulseTimer = null;
let lastDetectMeta = null;

// Cached DOM references
const dom = {};

function cacheDom() {
  dom.studioDeck = document.getElementById('studio-deck');
  dom.deckBeatLed = document.getElementById('deck-beat-led');
  dom.deckLiveReadout = document.getElementById('deck-live-readout');
  dom.deckStatePill = document.getElementById('deck-state-pill');
  dom.bpmHeroDisplay = document.getElementById('bpm-hero-display');
  dom.bpmInput = document.getElementById('bpm-input');
  dom.beatDots = Array.from(document.querySelectorAll('#beat-dots .beat-dot'));
  dom.genrePills = Array.from(document.querySelectorAll('#genre-pills .genre-pill'));

  dom.btnTapTempo = document.getElementById('btn-tap-tempo');
  dom.tapPadLed = document.getElementById('tap-pad-led');
  dom.tapStabilityLabel = document.getElementById('tap-stability-label');
  dom.tapCountMeta = document.getElementById('tap-count-meta');

  dom.btnMetronome = document.getElementById('btn-metronome');
  dom.metroGlyph = document.getElementById('metro-glyph');
  dom.metroLabel = document.getElementById('metro-label');
  dom.btnStopAudio = document.getElementById('btn-stop-audio');
  dom.volumeSlider = document.getElementById('audition-volume-slider');

  dom.btnDropSong = document.getElementById('btn-drop-song');
  dom.dropSongLabel = document.getElementById('drop-song-label');
  dom.bpmAudioInput = document.getElementById('bpm-audio-input');
  dom.detectBanner = document.getElementById('bpm-detect-banner');
  dom.detectDetail = document.getElementById('bpm-detect-detail');
  dom.btnDetectHalf = document.getElementById('btn-detect-half');
  dom.btnDetectDouble = document.getElementById('btn-detect-double');
  dom.btnDetectDismiss = document.getElementById('btn-detect-dismiss');

  dom.summaryBeatBtn = document.getElementById('summary-beat-btn');
  dom.summaryBeatMs = document.getElementById('summary-beat-ms');
  dom.summaryBeatSec = document.getElementById('summary-beat-sec');
  dom.summaryBarBtn = document.getElementById('summary-bar-btn');
  dom.summaryBarMs = document.getElementById('summary-bar-ms');
  dom.summaryBarSec = document.getElementById('summary-bar-sec');
  dom.summaryHzBtn = document.getElementById('summary-hz-btn');
  dom.summaryBeatHz = document.getElementById('summary-beat-hz');
  dom.summarySamplesBtn = document.getElementById('summary-samples-btn');
  dom.summaryBeat48k = document.getElementById('summary-beat-48k');
  dom.summaryBeat44k = document.getElementById('summary-beat-44k');

  dom.sampleRateFilter = document.getElementById('sample-rate-filter');
  dom.delayMatrixBody = document.getElementById('delay-matrix-body');

  dom.envelopeCanvas = document.getElementById('reverb-envelope-canvas');
  dom.envelopeKicker = document.getElementById('envelope-kicker');
  dom.envelopeTitle = document.getElementById('envelope-title');
  dom.envelopeVerifyBadge = document.getElementById('envelope-verify-badge');
  dom.btnAuditionEnvelope = document.getElementById('btn-audition-envelope');
  dom.btnCopyEnvelope = document.getElementById('btn-copy-envelope');
  dom.envCopyPreDelay = document.getElementById('env-copy-predelay');
  dom.envValPreDelay = document.getElementById('env-val-predelay');
  dom.envSubPreDelay = document.getElementById('env-sub-predelay');
  dom.envCopyDecay = document.getElementById('env-copy-decay');
  dom.envValDecay = document.getElementById('env-val-decay');
  dom.envSubDecay = document.getElementById('env-sub-decay');
  dom.envCopyTotal = document.getElementById('env-copy-total');
  dom.envValTotal = document.getElementById('env-val-total');
  dom.envSubTotal = document.getElementById('env-sub-total');

  dom.reverbPresetsGrid = document.getElementById('reverb-presets-grid');

  dom.customPreDelayNote = document.getElementById('custom-predelay-note');
  dom.customPreDelayVarGroup = document.getElementById('custom-predelay-variation');
  dom.customTotalBeats = document.getElementById('custom-total-beats');
  dom.customReverbWarning = document.getElementById('custom-reverb-warning');
  dom.customReverbWarningText = document.getElementById('custom-reverb-warning-text');
  dom.btnInspectCustom = document.getElementById('btn-inspect-custom');
  dom.btnAuditionCustom = document.getElementById('btn-audition-custom');
  dom.customCopyPreDelay = document.getElementById('custom-copy-predelay');
  dom.customOutPreDelay = document.getElementById('custom-out-predelay');
  dom.customOutPreDelaySub = document.getElementById('custom-out-predelay-sub');
  dom.customCopyDecay = document.getElementById('custom-copy-decay');
  dom.customOutDecay = document.getElementById('custom-out-decay');
  dom.customOutDecaySub = document.getElementById('custom-out-decay-sub');
  dom.customCopyTotal = document.getElementById('custom-copy-total');
  dom.customOutTotal = document.getElementById('custom-out-total');
  dom.customOutTotalSub = document.getElementById('custom-out-total-sub');

  dom.dynamicsList = document.getElementById('dynamics-list');
  dom.swingTableBody = document.getElementById('swing-table-body');

  dom.exportBpmLabel = document.getElementById('export-bpm-label');
  dom.btnCopySheet = document.getElementById('btn-copy-sheet');
  dom.btnExportMd = document.getElementById('btn-export-md');

  dom.navLinks = Array.from(document.querySelectorAll('.phase-step[data-nav]'));
  dom.footerYear = document.getElementById('footer-year');
  dom.toastContainer = document.getElementById('toast-container');
}

/* ==========================================================================
   TOAST & CLIPBOARD HELPERS
   ========================================================================== */

function showToast(message, { isError = false, durationMs = 2400 } = {}) {
  if (!dom.toastContainer) return;

  // Keep toast stack crisp and uncluttered (max 3 visible)
  while (dom.toastContainer.children.length >= 3) {
    dom.toastContainer.removeChild(dom.toastContainer.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = isError ? 'toast toast-error' : 'toast';
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    window.setTimeout(() => {
      toast.remove();
    }, 240);
  }, durationMs);
}

async function copyTextToClipboard(text, toastLabel) {
  let copied = false;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (!copied) {
    // Fallback for non-HTTPS or legacy browser contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    ta.remove();
  }

  if (copied) {
    showToast(toastLabel || `Copied ${text}`);
  } else {
    showToast('Clipboard blocked by browser — select text to copy manually.', { isError: true });
  }
}

/* ==========================================================================
   BPM STATE & PERSISTENCE
   ========================================================================== */

function loadInitialBpm() {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramBpm = parseBpmInput(params.get('bpm'));
    if (paramBpm !== null) {
      return paramBpm;
    }
  } catch {
    // Ignore malformed query string
  }

  try {
    const saved = parseBpmInput(window.localStorage.getItem(STORAGE_KEY));
    if (saved !== null) {
      return saved;
    }
  } catch {
    // Ignore private browsing storage restrictions
  }

  return DEFAULT_BPM;
}

function saveBpm(bpm) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(bpm));
  } catch {
    // Ignore storage errors
  }
}

function setBpm(nextBpm, { syncInput = true } = {}) {
  const clamped = clampBpm(nextBpm);
  state.bpm = clamped;
  audioEngine.setBpm(clamped);
  saveBpm(clamped);

  if (syncInput && dom.bpmInput) {
    dom.bpmInput.value = formatBpm(clamped);
  }

  renderAll();
}

function updateDeckStatusVisuals() {
  const isAudioActive = audioEngine.metronomeRunning || Boolean(state.activeAuditionId);

  if (dom.studioDeck) {
    dom.studioDeck.dataset.state = isAudioActive || state.isAnalyzingFile ? 'active' : 'standby';
  }

  if (dom.deckStatePill) {
    if (state.isAnalyzingFile) {
      dom.deckStatePill.textContent = 'ANALYZING';
    } else if (state.activeAuditionId) {
      dom.deckStatePill.textContent = state.activeAuditionType === 'reverb' ? 'REVERB AUDITION' : 'DELAY AUDITION';
    } else if (audioEngine.metronomeRunning) {
      dom.deckStatePill.textContent = 'METRONOME ON';
    } else {
      dom.deckStatePill.textContent = 'STANDBY';
    }
  }

  if (dom.deckLiveReadout) {
    if (state.activeAuditionId && state.activeAuditionLabel) {
      dom.deckLiveReadout.textContent = `AUDITIONING ${state.activeAuditionLabel}`;
    } else {
      dom.deckLiveReadout.textContent = `${formatBpm(state.bpm)} BPM · 4/4 GRID`;
    }
  }

  if (dom.btnMetronome) {
    dom.btnMetronome.classList.toggle('active', audioEngine.metronomeRunning);
    dom.btnMetronome.setAttribute('aria-pressed', String(audioEngine.metronomeRunning));
    dom.metroGlyph.textContent = audioEngine.metronomeRunning ? '■' : '▶';
    dom.metroLabel.textContent = audioEngine.metronomeRunning ? 'Click On' : 'Metronome';
  }

  if (dom.btnStopAudio) {
    dom.btnStopAudio.disabled = !isAudioActive;
  }
}

function pulseBeatVisual(beatIndex = 0, isDownbeat = true) {
  if (dom.deckBeatLed) {
    dom.deckBeatLed.classList.add('pulse');
  }
  dom.beatDots.forEach((dot, idx) => {
    const active = idx === beatIndex;
    dot.classList.toggle('lit', active);
    dot.classList.toggle('downbeat', active && isDownbeat);
  });

  if (beatPulseTimer !== null) {
    window.clearTimeout(beatPulseTimer);
  }
  beatPulseTimer = window.setTimeout(() => {
    if (dom.deckBeatLed) {
      dom.deckBeatLed.classList.remove('pulse');
    }
    dom.beatDots.forEach((dot) => dot.classList.remove('lit', 'downbeat'));
  }, 110);
}

/* ==========================================================================
   RENDERING PIPELINE
   ========================================================================== */

function getActiveReverbContext() {
  const presets = calculateReverbPresets(state.bpm);
  const custom = calculateReverbTiming(state.bpm, {
    preDelayDenom: state.customPreDelayDenom,
    preDelayVariation: state.customPreDelayVariation,
    totalBeats: state.customTotalBeats,
  });

  if (state.selectedReverbSource === 'custom') {
    return {
      sourceId: 'custom',
      isCustom: true,
      name: 'Custom Reverb',
      kicker: 'LIVE ENVELOPE DIAGRAM · CUSTOM BUILDER',
      auditionColor: 'plate',
      timing: custom,
      presets,
      custom,
    };
  }

  const preset = presets.find((p) => p.id === state.selectedReverbSource) || presets[1];
  return {
    sourceId: preset.id,
    isCustom: false,
    name: preset.name,
    kicker: `LIVE ENVELOPE DIAGRAM · ${preset.tag}`,
    auditionColor: preset.auditionColor,
    timing: preset,
    presets,
    custom,
  };
}

function renderTempoHeaderAndSummary() {
  const bpmStr = formatBpm(state.bpm);
  const summary = calculateTempoSummary(state.bpm);

  if (bpmStr.includes('.')) {
    const [wholePart, decPart] = bpmStr.split('.');
    dom.bpmHeroDisplay.innerHTML = `${wholePart}<span class="bpm-dec">.${decPart}</span>`;
  } else {
    dom.bpmHeroDisplay.textContent = bpmStr;
  }
  dom.exportBpmLabel.textContent = `${bpmStr} BPM`;

  dom.genrePills.forEach((pill) => {
    const pillBpm = Number(pill.dataset.bpm);
    pill.classList.toggle('active', Math.abs(pillBpm - state.bpm) < 0.05);
  });

  dom.summaryBeatMs.textContent = `${formatMs(summary.beatMs)} ms`;
  dom.summaryBeatSec.textContent = `${formatSec(summary.beatMs)} s · CLICK TO COPY`;
  dom.summaryBeatBtn.dataset.copyVal = formatMs(summary.beatMs);
  dom.summaryBeatBtn.dataset.copyLabel = `Copied ${formatMs(summary.beatMs)} ms (1 Beat @ ${bpmStr} BPM)`;

  dom.summaryBarMs.textContent = `${formatMs(summary.barMs)} ms`;
  dom.summaryBarSec.textContent = `${formatSec(summary.barMs)} s · CLICK TO COPY`;
  dom.summaryBarBtn.dataset.copyVal = formatMs(summary.barMs);
  dom.summaryBarBtn.dataset.copyLabel = `Copied ${formatMs(summary.barMs)} ms (1 Bar @ ${bpmStr} BPM)`;

  dom.summaryBeatHz.textContent = `${formatHz(summary.beatHz)} Hz`;
  dom.summaryHzBtn.dataset.copyVal = formatHz(summary.beatHz);
  dom.summaryHzBtn.dataset.copyLabel = `Copied ${formatHz(summary.beatHz)} Hz (1/4 LFO @ ${bpmStr} BPM)`;

  dom.summaryBeat48k.textContent = `${formatSamples(summary.beatSamples48000)} smp`;
  dom.summaryBeat44k.textContent = `48k · 44.1k: ${formatSamples(summary.beatSamples44100)}`;
  dom.summarySamplesBtn.dataset.copyVal = String(summary.beatSamples48000);
  dom.summarySamplesBtn.dataset.copyLabel = `Copied ${formatSamples(summary.beatSamples48000)} samples (1 Beat @ 48 kHz)`;

  updateDeckStatusVisuals();
}

function renderDelayMatrix() {
  const matrix = calculateDelayMatrix(state.bpm);
  const bpmStr = formatBpm(state.bpm);
  const srView = state.sampleRateView;
  const fragment = document.createDocumentFragment();

  for (const row of matrix) {
    const tr = document.createElement('tr');

    const noteTd = document.createElement('td');
    noteTd.className = 'col-note-cell';
    noteTd.innerHTML = `
      <span class="note-fraction">${row.label}</span>
      <span class="note-name micro">${row.name}</span>
    `;
    tr.appendChild(noteTd);

    const cells = [row.straight, row.dotted, row.triplet];
    for (const cell of cells) {
      const td = document.createElement('td');
      const auditionId = `delay:${cell.id}`;
      const isPlaying = state.activeAuditionId === auditionId;
      td.className = isPlaying ? 'delay-cell auditioning' : 'delay-cell';
      td.dataset.delayMs = String(cell.ms);
      td.dataset.auditionId = auditionId;
      td.dataset.noteTag = cell.noteTag;
      td.title = `Double-click to audition ${cell.noteTag} (${formatMs(cell.ms)} ms)`;

      const msStr = formatMs(cell.ms);
      const secStr = formatSec(cell.ms);
      const hzStr = formatHz(cell.hz);
      const s44 = formatSamples(cell.samples44100);
      const s48 = formatSamples(cell.samples48000);

      let samplesHtml = '';
      if (srView === '44100') {
        samplesHtml = `
          <button type="button" class="sample-chip" data-copy="${cell.samples44100}" data-toast="Copied ${s44} samples (${cell.noteTag} @ 44.1 kHz)">
            44.1k: ${s44} smp
          </button>
        `;
      } else if (srView === '48000') {
        samplesHtml = `
          <button type="button" class="sample-chip" data-copy="${cell.samples48000}" data-toast="Copied ${s48} samples (${cell.noteTag} @ 48 kHz)">
            48k: ${s48} smp
          </button>
        `;
      } else {
        samplesHtml = `
          <button type="button" class="sample-chip" data-copy="${cell.samples44100}" data-toast="Copied ${s44} samples (${cell.noteTag} @ 44.1 kHz)">
            44.1k: ${s44}
          </button>
          <button type="button" class="sample-chip" data-copy="${cell.samples48000}" data-toast="Copied ${s48} samples (${cell.noteTag} @ 48 kHz)">
            48k: ${s48}
          </button>
        `;
      }

      td.innerHTML = `
        <div class="delay-cell-top">
          <button
            type="button"
            class="copy-ms-btn"
            data-copy="${msStr}"
            data-toast="Copied ${msStr} ms (${cell.noteTag} @ ${bpmStr} BPM)"
            title="Click to copy ${msStr} ms"
          >${msStr} <span class="unit">ms</span></button>
          <button
            type="button"
            class="audition-cell-btn"
            data-audition-delay="${cell.ms}"
            data-audition-id="${auditionId}"
            data-audition-label="${cell.noteTag} (${msStr} ms)"
            aria-label="Audition ${cell.noteTag} delay at ${msStr} milliseconds"
            title="${isPlaying ? 'Stop audition' : `Audition ${cell.noteTag} delay`}"
          >${isPlaying ? '■' : '▶'}</button>
        </div>
        <div class="delay-cell-mid">
          <button
            type="button"
            class="copy-hz-btn"
            data-copy="${hzStr}"
            data-toast="Copied ${hzStr} Hz (${cell.noteTag} LFO @ ${bpmStr} BPM)"
            title="Click to copy ${hzStr} Hz"
          >${hzStr} Hz</button>
          <span class="delay-sec-tag">${secStr} s</span>
        </div>
        <div class="delay-cell-samples">${samplesHtml}</div>
      `;

      tr.appendChild(td);
    }

    fragment.appendChild(tr);
  }

  dom.delayMatrixBody.innerHTML = '';
  dom.delayMatrixBody.appendChild(fragment);
}

function renderReverbSection() {
  const ctx = getActiveReverbContext();
  const bpmStr = formatBpm(state.bpm);
  const activeTiming = ctx.timing;

  // 1. Update Envelope Diagram & Header
  dom.envelopeKicker.textContent = ctx.kicker;
  dom.envelopeTitle.textContent = `${ctx.name} — ${activeTiming.totalLabel}`;

  if (activeTiming.valid) {
    dom.envelopeVerifyBadge.textContent = `PRE + DECAY = ${formatSec(activeTiming.totalMs)}s`;
    dom.btnAuditionEnvelope.disabled = false;
    dom.btnCopyEnvelope.disabled = false;

    const preMsStr = formatMs(activeTiming.preDelayMs);
    const decayMsStr = formatMs(activeTiming.decayMs);
    const totalMsStr = formatMs(activeTiming.totalMs);

    dom.envValPreDelay.textContent = `${preMsStr} ms`;
    dom.envSubPreDelay.textContent = `${activeTiming.preDelayNoteLabel} · CLICK TO COPY`;
    dom.envCopyPreDelay.disabled = false;
    dom.envCopyPreDelay.dataset.copy = preMsStr;
    dom.envCopyPreDelay.dataset.toast = `Copied ${preMsStr} ms (${ctx.name} Pre-Delay @ ${bpmStr} BPM)`;

    dom.envValDecay.textContent = `${decayMsStr} ms`;
    dom.envSubDecay.textContent = `${formatSec(activeTiming.decayMs)} s RT60 · CLICK TO COPY`;
    dom.envCopyDecay.disabled = false;
    dom.envCopyDecay.dataset.copy = decayMsStr;
    dom.envCopyDecay.dataset.toast = `Copied ${decayMsStr} ms / ${formatSec(activeTiming.decayMs)} s (${ctx.name} Decay @ ${bpmStr} BPM)`;

    dom.envValTotal.textContent = `${totalMsStr} ms`;
    dom.envSubTotal.textContent = `${formatSec(activeTiming.totalMs)} s · ${activeTiming.totalLabel}`;
    dom.envCopyTotal.disabled = false;
    dom.envCopyTotal.dataset.copy = totalMsStr;
    dom.envCopyTotal.dataset.toast = `Copied ${totalMsStr} ms (${ctx.name} Total Tail @ ${bpmStr} BPM)`;
  } else {
    dom.envelopeVerifyBadge.textContent = 'OVERLAP WARNING';
    dom.btnAuditionEnvelope.disabled = true;
    dom.btnCopyEnvelope.disabled = true;

    const preMsStr = formatMs(activeTiming.preDelayMs);
    const totalMsStr = formatMs(activeTiming.totalMs);

    dom.envValPreDelay.textContent = `${preMsStr} ms`;
    dom.envSubPreDelay.textContent = `${activeTiming.preDelayNoteLabel} (EXCEEDS TOTAL)`;
    dom.envCopyPreDelay.disabled = false;
    dom.envCopyPreDelay.dataset.copy = preMsStr;
    dom.envCopyPreDelay.dataset.toast = `Copied ${preMsStr} ms (${activeTiming.preDelayNoteLabel} @ ${bpmStr} BPM)`;

    dom.envValDecay.textContent = '—';
    dom.envSubDecay.textContent = 'SHORTEN PRE-DELAY OR EXTEND TARGET';
    dom.envCopyDecay.disabled = true;

    dom.envValTotal.textContent = `${totalMsStr} ms`;
    dom.envSubTotal.textContent = `${formatSec(activeTiming.totalMs)} s · ${activeTiming.totalLabel}`;
    dom.envCopyTotal.disabled = false;
    dom.envCopyTotal.dataset.copy = totalMsStr;
    dom.envCopyTotal.dataset.toast = `Copied ${totalMsStr} ms (${activeTiming.totalLabel} @ ${bpmStr} BPM)`;
  }

  const activeReverbAudId = `reverb:${ctx.sourceId}`;
  dom.btnAuditionEnvelope.textContent = state.activeAuditionId === activeReverbAudId
    ? '■ Stop Reverb'
    : '▶ Audition Reverb';

  if (envelopeRenderer) {
    envelopeRenderer.setTiming(activeTiming, ctx.name);
  }

  // 2. Render 6 Studio Reverb Preset Cards
  const presetsFrag = document.createDocumentFragment();
  for (const preset of ctx.presets) {
    const isSelected = state.selectedReverbSource === preset.id;
    const auditionId = `reverb:${preset.id}`;
    const isPlaying = state.activeAuditionId === auditionId;

    const card = document.createElement('article');
    card.className = [
      'reverb-preset-card',
      isSelected ? 'selected' : '',
      isPlaying ? 'auditioning' : '',
    ].filter(Boolean).join(' ');
    card.dataset.presetId = preset.id;
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${preset.name} reverb preset`);

    const preMsStr = formatMs(preset.preDelayMs);
    const decayMsStr = formatMs(preset.decayMs);
    const decaySecStr = formatSec(preset.decayMs);
    const totalMsStr = formatMs(preset.totalMs);

    card.innerHTML = `
      <div>
        <div class="preset-top">
          <span class="micro preset-tag">${preset.tag}</span>
          ${isSelected ? '<span class="preset-selected-pill">ON DIAGRAM</span>' : ''}
        </div>
        <h3 class="preset-name">${preset.name}</h3>
        <p class="preset-desc">${preset.description}</p>
      </div>

      <div class="preset-metrics">
        <button
          type="button"
          class="preset-stat-btn"
          data-copy="${preMsStr}"
          data-toast="Copied ${preMsStr} ms (${preset.name} Pre-Delay · ${preset.preDelayLabel} @ ${bpmStr} BPM)"
          title="Click to copy Pre-Delay ms"
        >
          <span class="micro">PRE-DELAY (${preset.preDelayLabel})</span>
          <strong>${preMsStr} ms</strong>
          <span class="preset-stat-sub">${formatSamples(preset.preDelaySamples48000)} smp @ 48k</span>
        </button>

        <button
          type="button"
          class="preset-stat-btn"
          data-copy="${decayMsStr}"
          data-toast="Copied ${decayMsStr} ms (${preset.name} Decay RT60 · ${decaySecStr} s @ ${bpmStr} BPM)"
          title="Click to copy Decay RT60 ms"
        >
          <span class="micro">DECAY (RT60)</span>
          <strong>${decayMsStr} ms</strong>
          <span class="preset-stat-sub">${decaySecStr} s</span>
        </button>
      </div>

      <div class="preset-foot">
        <span class="preset-math-line">Total: <strong>${totalMsStr} ms</strong> (${preset.totalLabel})</span>
        <button
          type="button"
          class="preset-audition-btn"
          data-audition-reverb="${preset.id}"
          aria-label="Audition ${preset.name} reverb"
        >${isPlaying ? '■ Stop' : '▶ Audition'}</button>
      </div>
    `;

    presetsFrag.appendChild(card);
  }
  dom.reverbPresetsGrid.innerHTML = '';
  dom.reverbPresetsGrid.appendChild(presetsFrag);

  // 3. Render Custom Reverb Builder State
  const custom = ctx.custom;
  dom.customPreDelayNote.value = String(state.customPreDelayDenom);
  dom.customTotalBeats.value = String(state.customTotalBeats);

  const varBtns = Array.from(dom.customPreDelayVarGroup.querySelectorAll('.seg-btn'));
  varBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.var === state.customPreDelayVariation);
    btn.disabled = state.customPreDelayDenom === 0;
  });

  if (custom.valid) {
    dom.customReverbWarning.classList.add('hidden');
    dom.btnAuditionCustom.disabled = false;

    const preMsStr = formatMs(custom.preDelayMs);
    const decayMsStr = formatMs(custom.decayMs);
    const totalMsStr = formatMs(custom.totalMs);

    dom.customOutPreDelay.textContent = `${preMsStr} ms`;
    dom.customOutPreDelaySub.textContent = `${custom.preDelayNoteLabel} · ${formatSamples(custom.preDelaySamples48000)} smp @ 48k`;
    dom.customCopyPreDelay.disabled = false;
    dom.customCopyPreDelay.dataset.copy = preMsStr;
    dom.customCopyPreDelay.dataset.toast = `Copied ${preMsStr} ms (Custom Pre-Delay @ ${bpmStr} BPM)`;

    dom.customOutDecay.textContent = `${decayMsStr} ms`;
    dom.customOutDecaySub.textContent = `${formatSec(custom.decayMs)} s RT60`;
    dom.customCopyDecay.disabled = false;
    dom.customCopyDecay.dataset.copy = decayMsStr;
    dom.customCopyDecay.dataset.toast = `Copied ${decayMsStr} ms (${formatSec(custom.decayMs)} s Custom Decay @ ${bpmStr} BPM)`;

    dom.customOutTotal.textContent = `${totalMsStr} ms`;
    dom.customOutTotalSub.textContent = `${formatSec(custom.totalMs)} s · ${custom.totalLabel}`;
    dom.customCopyTotal.disabled = false;
    dom.customCopyTotal.dataset.copy = totalMsStr;
    dom.customCopyTotal.dataset.toast = `Copied ${totalMsStr} ms (Custom Reverb Total @ ${bpmStr} BPM)`;
  } else {
    dom.customReverbWarning.classList.remove('hidden');
    dom.customReverbWarningText.textContent = custom.warning;
    dom.btnAuditionCustom.disabled = true;

    const preMsStr = formatMs(custom.preDelayMs);
    const totalMsStr = formatMs(custom.totalMs);

    dom.customOutPreDelay.textContent = `${preMsStr} ms`;
    dom.customOutPreDelaySub.textContent = `${custom.preDelayNoteLabel} — TOO LONG`;
    dom.customCopyPreDelay.disabled = false;
    dom.customCopyPreDelay.dataset.copy = preMsStr;
    dom.customCopyPreDelay.dataset.toast = `Copied ${preMsStr} ms (Custom Pre-Delay @ ${bpmStr} BPM)`;

    dom.customOutDecay.textContent = '0.00 ms';
    dom.customOutDecaySub.textContent = 'REDUCE PRE-DELAY OR RAISE TARGET';
    dom.customCopyDecay.disabled = true;

    dom.customOutTotal.textContent = `${totalMsStr} ms`;
    dom.customOutTotalSub.textContent = `${formatSec(custom.totalMs)} s · ${custom.totalLabel}`;
    dom.customCopyTotal.disabled = false;
    dom.customCopyTotal.dataset.copy = totalMsStr;
    dom.customCopyTotal.dataset.toast = `Copied ${totalMsStr} ms (Custom Target Total @ ${bpmStr} BPM)`;
  }

  dom.btnAuditionCustom.textContent = state.activeAuditionId === 'reverb:custom'
    ? '■ Stop Custom'
    : '▶ Audition Custom';
}

function renderDynamicsAndGroove() {
  const bpmStr = formatBpm(state.bpm);
  const dynamics = calculateDynamicsTimings(state.bpm);
  const dynFrag = document.createDocumentFragment();

  for (const item of dynamics) {
    const msStr = formatMs(item.ms);
    const row = document.createElement('div');
    row.className = 'dynamics-item';
    row.innerHTML = `
      <div class="dynamics-info">
        <div class="dynamics-title-row">
          <span class="dynamics-cat-tag">${item.category}</span>
          <span class="dynamics-name">${item.name}</span>
        </div>
        <p class="dynamics-usage">${item.usage}</p>
      </div>
      <button
        type="button"
        class="dynamics-copy-btn"
        data-copy="${msStr}"
        data-toast="Copied ${msStr} ms (${item.name} · ${item.subdivision} @ ${bpmStr} BPM)"
        title="Click to copy ${msStr} ms"
      >
        <strong>${msStr} ms</strong>
        <span>${item.subdivision}</span>
      </button>
    `;
    dynFrag.appendChild(row);
  }
  dom.dynamicsList.innerHTML = '';
  dom.dynamicsList.appendChild(dynFrag);

  const swingLevels = calculateSwingOffsets(state.bpm);
  const swingFrag = document.createDocumentFragment();
  for (const sw of swingLevels) {
    const off16 = formatMs(sw.offset16thMs);
    const off8 = formatMs(sw.offset8thMs);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="swing-feel-name">
          <span class="swing-feel-pct">${sw.displayPercent}</span>${sw.name}
        </span>
        <span class="swing-feel-note">${sw.note}</span>
      </td>
      <td>
        <button
          type="button"
          class="swing-copy-btn"
          data-copy="${off16}"
          data-toast="Copied ${off16} ms (${sw.displayPercent} 16th Swing Offset @ ${bpmStr} BPM)"
          title="Click to copy 16th-note swing offset"
        >+${off16} ms</button>
      </td>
      <td>
        <button
          type="button"
          class="swing-copy-btn"
          data-copy="${off8}"
          data-toast="Copied ${off8} ms (${sw.displayPercent} 8th Half-Time Swing @ ${bpmStr} BPM)"
          title="Click to copy 8th-note half-time swing offset"
        >+${off8} ms</button>
      </td>
    `;
    swingFrag.appendChild(tr);
  }
  dom.swingTableBody.innerHTML = '';
  dom.swingTableBody.appendChild(swingFrag);
}

function renderAll() {
  renderTempoHeaderAndSummary();
  renderDelayMatrix();
  renderReverbSection();
  renderDynamicsAndGroove();
}

/* ==========================================================================
   AUDITION & TAP TEMPO ACTIONS
   ========================================================================== */

function triggerTapTempo() {
  const res = tapEngine.tap(performance.now());

  // Tactile visual pulse
  dom.btnTapTempo.classList.add('tapped');
  dom.tapPadLed.classList.add('flash');
  pulseBeatVisual((res.tapCount - 1) % 4, (res.tapCount - 1) % 4 === 0);

  window.setTimeout(() => {
    dom.btnTapTempo.classList.remove('tapped');
    dom.tapPadLed.classList.remove('flash');
  }, 110);

  dom.tapStabilityLabel.textContent = res.stabilityLabel;
  if (res.bpm !== null) {
    const outlierNote = res.droppedOutliers > 0 ? ` · ${res.droppedOutliers} SPIKE DROPPED` : '';
    dom.tapCountMeta.textContent = `TAPS: ${res.tapCount}/8 · STABILITY ${res.stability}%${outlierNote}`;
    setBpm(res.bpm);
  } else {
    dom.tapCountMeta.textContent = `TAP 1/8 · TAP AGAIN TO LOCK TEMPO`;
  }

  // Schedule clean visual idle reset matching engine's 2.5s auto-reset
  if (tapIdleTimer !== null) {
    window.clearTimeout(tapIdleTimer);
  }
  tapIdleTimer = window.setTimeout(() => {
    dom.tapStabilityLabel.textContent = 'READY';
    dom.tapCountMeta.textContent = '8-TAP ROLLING AVG · AUTO-RESET 2.5S';
  }, 2600);
}

async function handleAuditionDelay(delayMs, auditionId, label) {
  if (state.activeAuditionId === auditionId) {
    audioEngine.stopAudition();
    return;
  }

  try {
    if (envelopeRenderer) {
      envelopeRenderer.stopPlayhead();
    }
    await audioEngine.auditionDelay({
      delayMs,
      id: auditionId,
      label,
    });
  } catch (err) {
    showToast(err.message || 'Unable to initialize Web Audio.', { isError: true });
  }
}

async function handleAuditionReverb(sourceId) {
  state.selectedReverbSource = sourceId;
  const ctx = getActiveReverbContext();
  const auditionId = `reverb:${ctx.sourceId}`;

  if (state.activeAuditionId === auditionId) {
    audioEngine.stopAudition();
    return;
  }

  if (!ctx.timing.valid) {
    showToast('Shorten Pre-Delay or increase Target Total before auditioning.', { isError: true });
    renderReverbSection();
    return;
  }

  renderReverbSection();

  try {
    const info = await audioEngine.auditionReverb({
      preDelayMs: ctx.timing.preDelayMs,
      decayMs: ctx.timing.decayMs,
      color: ctx.auditionColor,
      id: auditionId,
      label: `${ctx.name} (${formatMs(ctx.timing.preDelayMs)}ms / ${formatSec(ctx.timing.decayMs)}s)`,
    });
    if (envelopeRenderer) {
      envelopeRenderer.startPlayhead(info.totalMs, info.startPerfMs);
    }
  } catch (err) {
    showToast(err.message || 'Unable to synthesize reverb audition.', { isError: true });
  }
}

async function handleAudioFileForBpm(file) {
  if (!file) return;
  state.isAnalyzingFile = true;
  dom.dropSongLabel.textContent = 'Analyzing BPM...';
  updateDeckStatusVisuals();

  try {
    const result = await audioEngine.detectBpmFromAudioFile(file);
    lastDetectMeta = result;
    setBpm(result.bpm);

    dom.detectBanner.classList.remove('hidden');
    dom.detectDetail.textContent = `${result.filename} -> ${formatBpm(result.bpm)} BPM (~${result.confidence}% lock)`;
    showToast(`Detected ${formatBpm(result.bpm)} BPM from ${result.filename}`);
  } catch (err) {
    showToast(err.message || 'Could not decode or analyze audio file.', { isError: true });
  } finally {
    state.isAnalyzingFile = false;
    dom.dropSongLabel.textContent = 'Drop Song to Read BPM';
    updateDeckStatusVisuals();
  }
}

/* ==========================================================================
   EXPORT & SHEET COPY
   ========================================================================== */

function getCurrentMarkdownSheet() {
  const custom = calculateReverbTiming(state.bpm, {
    preDelayDenom: state.customPreDelayDenom,
    preDelayVariation: state.customPreDelayVariation,
    totalBeats: state.customTotalBeats,
  });
  return generateMarkdownSheet(state.bpm, custom);
}

function downloadMarkdownSheet() {
  const md = getCurrentMarkdownSheet();
  const bpmSlug = formatBpm(state.bpm).replace(/\./g, '-');
  const filename = `saint-gordon-timing-sheet-${bpmSlug}bpm.md`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast(`Exported ${filename}`);
}

/* ==========================================================================
   EVENT WIRING
   ========================================================================== */

function bindEvents() {
  // Direct numeric BPM input (non-intrusive while typing decimals)
  dom.bpmInput.addEventListener('input', () => {
    const raw = dom.bpmInput.value.trim();
    if (raw === '') return;
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 20 && num <= 300) {
      setBpm(num, { syncInput: false });
    }
  });

  const commitBpmInput = () => {
    const parsed = parseBpmInput(dom.bpmInput.value);
    if (parsed !== null) {
      setBpm(parsed, { syncInput: true });
    } else {
      dom.bpmInput.value = formatBpm(state.bpm);
    }
  };

  dom.bpmInput.addEventListener('change', commitBpmInput);
  dom.bpmInput.addEventListener('blur', commitBpmInput);

  // Precision nudge & ÷2 / ×2 buttons
  document.querySelectorAll('.deck-nudge-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.nudge) {
        setBpm(state.bpm + Number(btn.dataset.nudge));
      } else if (btn.dataset.scale) {
        const next = state.bpm * Number(btn.dataset.scale);
        setBpm(next);
        showToast(`Tempo scaled to ${formatBpm(state.bpm)} BPM`);
      }
    });
  });

  // Genre quick preset pills
  dom.genrePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      setBpm(Number(pill.dataset.bpm));
    });
  });

  // Tactile Tap Tempo Pad (pointerdown for zero-latency tap feel + keyboard accessibility)
  let pointerHandledTap = false;
  dom.btnTapTempo.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerHandledTap = true;
    triggerTapTempo();
  });

  dom.btnTapTempo.addEventListener('click', () => {
    if (pointerHandledTap) {
      pointerHandledTap = false;
      return;
    }
    triggerTapTempo();
  });

  // Metronome & Stop Audio & Volume
  dom.btnMetronome.addEventListener('click', async () => {
    try {
      await audioEngine.toggleMetronome(state.bpm);
      updateDeckStatusVisuals();
    } catch (err) {
      showToast(err.message || 'Unable to start metronome.', { isError: true });
    }
  });

  dom.btnStopAudio.addEventListener('click', () => {
    audioEngine.stopAll();
    if (envelopeRenderer) envelopeRenderer.stopPlayhead();
    updateDeckStatusVisuals();
  });

  dom.volumeSlider.addEventListener('input', () => {
    audioEngine.setVolume(dom.volumeSlider.value);
  });

  // Quick Audio Drop Auto-BPM
  dom.btnDropSong.addEventListener('click', () => {
    dom.bpmAudioInput.value = '';
    dom.bpmAudioInput.click();
  });

  dom.bpmAudioInput.addEventListener('change', () => {
    const file = dom.bpmAudioInput.files && dom.bpmAudioInput.files[0];
    if (file) {
      handleAudioFileForBpm(file);
    }
  });

  // Drag & drop directly onto the Studio Deck console
  ['dragenter', 'dragover'].forEach((evt) => {
    dom.studioDeck.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dom.studioDeck.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dom.studioDeck.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dom.studioDeck.classList.remove('drag-over');
    });
  });

  dom.studioDeck.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      handleAudioFileForBpm(file);
    }
  });

  dom.btnDetectHalf.addEventListener('click', () => {
    setBpm(state.bpm / 2);
    if (lastDetectMeta) {
      dom.detectDetail.textContent = `${lastDetectMeta.filename} -> ${formatBpm(state.bpm)} BPM (Half-Time ÷2)`;
    }
  });

  dom.btnDetectDouble.addEventListener('click', () => {
    setBpm(state.bpm * 2);
    if (lastDetectMeta) {
      dom.detectDetail.textContent = `${lastDetectMeta.filename} -> ${formatBpm(state.bpm)} BPM (Double-Time ×2)`;
    }
  });

  dom.btnDetectDismiss.addEventListener('click', () => {
    dom.detectBanner.classList.add('hidden');
  });

  // Summary Reference Tiles copy
  [dom.summaryBeatBtn, dom.summaryBarBtn, dom.summaryHzBtn, dom.summarySamplesBtn].forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.copyVal) {
        copyTextToClipboard(btn.dataset.copyVal, btn.dataset.copyLabel);
      }
    });
  });

  // Sample Rate Filter Segmented Control
  dom.sampleRateFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    state.sampleRateView = btn.dataset.sr;
    dom.sampleRateFilter.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    renderDelayMatrix();
  });

  // Delay Matrix delegated Click (Copy & Audition) + Double-Click Audition
  dom.delayMatrixBody.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      copyTextToClipboard(copyBtn.dataset.copy, copyBtn.dataset.toast);
      return;
    }

    const audBtn = e.target.closest('[data-audition-delay]');
    if (audBtn) {
      handleAuditionDelay(
        Number(audBtn.dataset.auditionDelay),
        audBtn.dataset.auditionId,
        audBtn.dataset.auditionLabel
      );
    }
  });

  dom.delayMatrixBody.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    const cell = e.target.closest('.delay-cell');
    if (!cell) return;
    const ms = Number(cell.dataset.delayMs);
    handleAuditionDelay(ms, cell.dataset.auditionId, `${cell.dataset.noteTag} (${formatMs(ms)} ms)`);
  });

  // Envelope Header Actions & Clickable Metrics
  dom.btnAuditionEnvelope.addEventListener('click', () => {
    handleAuditionReverb(state.selectedReverbSource);
  });

  dom.btnCopyEnvelope.addEventListener('click', () => {
    const ctx = getActiveReverbContext();
    if (!ctx.timing.valid) return;
    const pairText = `Pre-Delay: ${formatMs(ctx.timing.preDelayMs)} ms (${ctx.timing.preDelayNoteLabel}) | Decay: ${formatMs(ctx.timing.decayMs)} ms (${formatSec(ctx.timing.decayMs)} s) | Total: ${formatMs(ctx.timing.totalMs)} ms @ ${formatBpm(state.bpm)} BPM`;
    copyTextToClipboard(pairText, `Copied ${ctx.name} Pre-Delay + Decay pair`);
  });

  [dom.envCopyPreDelay, dom.envCopyDecay, dom.envCopyTotal].forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!btn.disabled && btn.dataset.copy) {
        copyTextToClipboard(btn.dataset.copy, btn.dataset.toast);
      }
    });
  });

  // Reverb Preset Cards Grid (Select, Copy Metric, Audition)
  dom.reverbPresetsGrid.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    const card = e.target.closest('.reverb-preset-card');

    if (copyBtn) {
      e.stopPropagation();
      if (card) {
        state.selectedReverbSource = card.dataset.presetId;
        renderReverbSection();
      }
      copyTextToClipboard(copyBtn.dataset.copy, copyBtn.dataset.toast);
      return;
    }

    const audBtn = e.target.closest('[data-audition-reverb]');
    if (audBtn) {
      e.stopPropagation();
      handleAuditionReverb(audBtn.dataset.auditionReverb);
      return;
    }

    if (card) {
      state.selectedReverbSource = card.dataset.presetId;
      renderReverbSection();
    }
  });

  dom.reverbPresetsGrid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.reverb-preset-card');
    if (!card || e.target.closest('button')) return;
    e.preventDefault();
    state.selectedReverbSource = card.dataset.presetId;
    renderReverbSection();
  });

  // Custom Reverb Builder Controls
  dom.customPreDelayNote.addEventListener('change', () => {
    state.customPreDelayDenom = Number(dom.customPreDelayNote.value);
    state.selectedReverbSource = 'custom';
    renderReverbSection();
  });

  dom.customPreDelayVarGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || btn.disabled) return;
    state.customPreDelayVariation = btn.dataset.var;
    state.selectedReverbSource = 'custom';
    renderReverbSection();
  });

  dom.customTotalBeats.addEventListener('change', () => {
    state.customTotalBeats = Number(dom.customTotalBeats.value);
    state.selectedReverbSource = 'custom';
    renderReverbSection();
  });

  dom.btnInspectCustom.addEventListener('click', () => {
    state.selectedReverbSource = 'custom';
    renderReverbSection();
    dom.envelopeCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  dom.btnAuditionCustom.addEventListener('click', () => {
    handleAuditionReverb('custom');
  });

  [dom.customCopyPreDelay, dom.customCopyDecay, dom.customCopyTotal].forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!btn.disabled && btn.dataset.copy) {
        copyTextToClipboard(btn.dataset.copy, btn.dataset.toast);
      }
    });
  });

  // Dynamics & Swing Copy Delegation
  dom.dynamicsList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (btn) {
      copyTextToClipboard(btn.dataset.copy, btn.dataset.toast);
    }
  });

  dom.swingTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (btn) {
      copyTextToClipboard(btn.dataset.copy, btn.dataset.toast);
    }
  });

  // Export & Copy Full Sheet
  dom.btnCopySheet.addEventListener('click', () => {
    copyTextToClipboard(
      getCurrentMarkdownSheet(),
      `Copied full ${formatBpm(state.bpm)} BPM Studio Timing Sheet (.md)`
    );
  });

  dom.btnExportMd.addEventListener('click', downloadMarkdownSheet);

  // Header nav active state
  dom.navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      dom.navLinks.forEach((l) => l.classList.toggle('active', l === link));
    });
  });

  // Global Studio Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
      audioEngine.stopAll();
      if (envelopeRenderer) envelopeRenderer.stopPlayhead();
      updateDeckStatusVisuals();
      return;
    }

    if (isEditing) return;

    const keyLower = e.key.toLowerCase();
    if (keyLower === 't') {
      e.preventDefault();
      triggerTapTempo();
    } else if (keyLower === 'm') {
      e.preventDefault();
      audioEngine.toggleMetronome(state.bpm).then(updateDeckStatusVisuals).catch((err) => {
        showToast(err.message || 'Unable to start metronome.', { isError: true });
      });
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setBpm(state.bpm + (e.shiftKey ? 0.5 : 1));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setBpm(state.bpm - (e.shiftKey ? 0.5 : 1));
    }
  });

  // Wire audio engine callbacks
  audioEngine.setOnBeat((beatIndex, isDownbeat) => {
    pulseBeatVisual(beatIndex, isDownbeat);
  });

  audioEngine.setOnAuditionStateChange((info) => {
    state.activeAuditionId = info.active ? info.id : null;
    state.activeAuditionType = info.active ? info.type : null;
    state.activeAuditionLabel = info.active ? info.label : '';

    if (!info.active && envelopeRenderer) {
      envelopeRenderer.stopPlayhead();
    }

    renderDelayMatrix();
    renderReverbSection();
    updateDeckStatusVisuals();
  });
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

function init() {
  cacheDom();
  if (dom.footerYear) {
    dom.footerYear.textContent = String(new Date().getFullYear());
  }

  envelopeRenderer = new ReverbEnvelopeRenderer(dom.envelopeCanvas);

  state.bpm = loadInitialBpm();
  audioEngine.setBpm(state.bpm);
  dom.bpmInput.value = formatBpm(state.bpm);

  bindEvents();
  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
