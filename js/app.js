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
  formatSecShort,
  formatHz,
  formatSamples,
  formatReverbDisplay,
  calculateTempoSummary,
  calculateQuickDelays,
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
  activeTab: 'reverb', // 'reverb' | 'delay' | 'groove'
  reverbUnitMode: 'plugin', // 'plugin' | 'ms' | 'sec'
  sampleRateView: 'both', // 'both' | '48000' | '44100'
  selectedReverbSource: 'hall', // preset id or 'custom'
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

  // Navigation & Tabs
  dom.navLinks = Array.from(document.querySelectorAll('.phase-step[data-nav]'));
  dom.wsTabs = Array.from(document.querySelectorAll('.ws-tab[data-tab]'));
  dom.tabPanels = {
    reverb: document.getElementById('panel-reverb'),
    delay: document.getElementById('panel-delay'),
    groove: document.getElementById('panel-groove'),
  };
  dom.btnQuickBeatCopy = document.getElementById('btn-quick-beat-copy');
  dom.quickBeatVal = document.getElementById('quick-beat-val');
  dom.btnQuickExportMd = document.getElementById('btn-quick-export-md');

  // Tab I: Reverb Table + Envelope + Custom Builder
  dom.reverbUnitFilter = document.getElementById('reverb-unit-filter');
  dom.reverbPresetsBody = document.getElementById('reverb-presets-body');

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

  // Tab II: Delay
  dom.quickDelaysGrid = document.getElementById('quick-delays-grid');
  dom.sampleRateFilter = document.getElementById('sample-rate-filter');
  dom.delayMatrixBody = document.getElementById('delay-matrix-body');

  // Tab III: Groove & Export
  dom.dynamicsList = document.getElementById('dynamics-list');
  dom.swingTableBody = document.getElementById('swing-table-body');
  dom.exportBpmLabel = document.getElementById('export-bpm-label');
  dom.btnCopySheet = document.getElementById('btn-copy-sheet');
  dom.btnExportMd = document.getElementById('btn-export-md');

  dom.footerYear = document.getElementById('footer-year');
  dom.toastContainer = document.getElementById('toast-container');
}

/* ==========================================================================
   TOAST & CLIPBOARD HELPERS
   ========================================================================== */

function showToast(message, { isError = false, durationMs = 2400 } = {}) {
  if (!dom.toastContainer) return;

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
   TAB SWITCHING
   ========================================================================== */

function setActiveTab(tabId) {
  if (!dom.tabPanels[tabId]) return;
  state.activeTab = tabId;

  dom.wsTabs.forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  dom.navLinks.forEach((link) => {
    const isActive = link.dataset.nav === tabId;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  Object.entries(dom.tabPanels).forEach(([key, panel]) => {
    if (!panel) return;
    panel.classList.toggle('hidden', key !== tabId);
  });

  if (tabId === 'reverb' && envelopeRenderer) {
    window.requestAnimationFrame(() => {
      envelopeRenderer.render();
    });
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

function loadInitialTab() {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = (params.get('tab') || '').toLowerCase();
    if (tab === 'reverb' || tab === 'delay' || tab === 'groove') {
      return tab;
    }
  } catch {
    // Ignore
  }
  return 'reverb';
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
  const summary = calculateTempoSummary(state.bpm);

  if (dom.studioDeck) {
    dom.studioDeck.dataset.state = isAudioActive || state.isAnalyzingFile ? 'active' : 'standby';
  }

  if (dom.deckStatePill) {
    if (state.isAnalyzingFile) {
      dom.deckStatePill.textContent = 'ANALYZING';
    } else if (state.activeAuditionId) {
      dom.deckStatePill.textContent = state.activeAuditionType === 'reverb' ? 'REVERB AUDITION' : 'DELAY AUDITION';
    } else if (audioEngine.metronomeRunning) {
      dom.deckStatePill.textContent = 'CLICK ON';
    } else {
      dom.deckStatePill.textContent = 'STANDBY';
    }
  }

  if (dom.deckLiveReadout) {
    if (state.activeAuditionId && state.activeAuditionLabel) {
      dom.deckLiveReadout.textContent = `AUDITIONING ${state.activeAuditionLabel}`;
    } else {
      dom.deckLiveReadout.textContent = `${formatBpm(state.bpm)} BPM · 1 BEAT ${formatMs(summary.beatMs)} ms · 1 BAR ${formatMs(summary.barMs)} ms`;
    }
  }

  if (dom.btnMetronome) {
    dom.btnMetronome.classList.toggle('active', audioEngine.metronomeRunning);
    dom.btnMetronome.setAttribute('aria-pressed', String(audioEngine.metronomeRunning));
    dom.metroGlyph.textContent = audioEngine.metronomeRunning ? '■' : '▶';
    dom.metroLabel.textContent = audioEngine.metronomeRunning ? 'Click On' : 'Click';
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
      kicker: 'LIVE ENVELOPE · CUSTOM BUILDER',
      auditionColor: 'plate',
      timing: custom,
      presets,
      custom,
    };
  }

  const preset = presets.find((p) => p.id === state.selectedReverbSource) || presets[0];
  return {
    sourceId: preset.id,
    isCustom: false,
    name: preset.name,
    kicker: `LIVE ENVELOPE · ${preset.tag}`,
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

  const beatMsStr = formatMs(summary.beatMs);
  dom.quickBeatVal.textContent = `${beatMsStr} ms`;
  dom.btnQuickBeatCopy.dataset.copyVal = beatMsStr;
  dom.btnQuickBeatCopy.dataset.copyLabel = `Copied ${beatMsStr} ms (1 Beat @ ${bpmStr} BPM)`;

  updateDeckStatusVisuals();
}

function renderReverbSection() {
  const ctx = getActiveReverbContext();
  const bpmStr = formatBpm(state.bpm);
  const unitMode = state.reverbUnitMode;
  const activeTiming = ctx.timing;

  // 1. Render 7-Row Scannable Reverb Table
  const tbodyFrag = document.createDocumentFragment();
  for (const preset of ctx.presets) {
    const isSelected = state.selectedReverbSource === preset.id;
    const auditionId = `reverb:${preset.id}`;
    const isPlaying = state.activeAuditionId === auditionId;

    const pd = formatReverbDisplay(preset.preDelayMs, unitMode, 'predelay');
    const dec = formatReverbDisplay(preset.decayMs, unitMode, 'decay');
    const tot = formatReverbDisplay(preset.totalMs, unitMode, 'total');

    const rowSummary = `${preset.name} @ ${bpmStr} BPM: Pre-Delay ${formatMs(preset.preDelayMs)} ms, Decay ${formatSecShort(preset.decayMs)} s (${formatMs(preset.decayMs)} ms), Total ${formatSecShort(preset.totalMs)} s`;

    const tr = document.createElement('tr');
    tr.className = [
      'reverb-row',
      isSelected ? 'selected' : '',
      isPlaying ? 'auditioning' : '',
    ].filter(Boolean).join(' ');
    tr.dataset.presetId = preset.id;
    tr.tabIndex = 0;

    tr.innerHTML = `
      <td class="rev-cell-name">
        <div class="rev-name-top">
          <strong class="rev-size-name">${preset.name}</strong>
          <span class="rev-pd-pill micro">${preset.preDelayLabel} PD</span>
          ${isSelected ? '<span class="rev-active-pill micro">ENVELOPE</span>' : ''}
        </div>
        <span class="rev-size-tag micro">${preset.tag}</span>
      </td>
      <td class="rev-cell-val" data-label="Pre-Delay">
        <button
          type="button"
          class="rev-copy-btn"
          data-copy="${pd.copyValue}"
          data-toast="Copied ${pd.primary} (${preset.name} Pre-Delay · ${preset.preDelayLabel} @ ${bpmStr} BPM)"
          title="Click to copy ${pd.primary}"
        >
          <span class="rev-val-primary">${pd.primary}</span>
          <span class="rev-val-sub">${pd.secondary}</span>
        </button>
      </td>
      <td class="rev-cell-val" data-label="Decay (RT60)">
        <button
          type="button"
          class="rev-copy-btn rev-copy-decay"
          data-copy="${dec.copyValue}"
          data-toast="Copied ${dec.primary} (${dec.secondary} · ${preset.name} Decay @ ${bpmStr} BPM)"
          title="Click to copy ${dec.primary}"
        >
          <span class="rev-val-primary">${dec.primary}</span>
          <span class="rev-val-sub">${dec.secondary}</span>
        </button>
      </td>
      <td class="rev-cell-val" data-label="Total Reverb">
        <button
          type="button"
          class="rev-copy-btn"
          data-copy="${tot.copyValue}"
          data-toast="Copied ${tot.primary} (${tot.secondary} · ${preset.name} Total @ ${bpmStr} BPM)"
          title="Click to copy ${tot.primary}"
        >
          <span class="rev-val-primary">${tot.primary}</span>
          <span class="rev-val-sub">${tot.secondary}</span>
        </button>
      </td>
      <td class="rev-cell-actions">
        <div class="rev-actions-wrap">
          <button
            type="button"
            class="rev-hear-btn"
            data-audition-reverb="${preset.id}"
            aria-label="Hear ${preset.name} reverb live"
            title="${isPlaying ? 'Stop audition' : `Hear ${preset.name} (${pd.primary} PD / ${dec.primary} Decay)`}"
          >${isPlaying ? '■ Stop' : '▶ Hear'}</button>
          <button
            type="button"
            class="rev-copy-row-btn"
            data-copy="${rowSummary}"
            data-toast="Copied ${preset.name} @ ${bpmStr} BPM summary"
            title="Copy full ${preset.name} settings"
          >Copy Row</button>
        </div>
      </td>
    `;

    tbodyFrag.appendChild(tr);
  }
  dom.reverbPresetsBody.innerHTML = '';
  dom.reverbPresetsBody.appendChild(tbodyFrag);

  // 2. Update Visual Reverb Envelope Card
  dom.envelopeKicker.textContent = ctx.kicker;
  dom.envelopeTitle.textContent = `${ctx.name} — ${activeTiming.totalLabel}`;

  if (activeTiming.valid) {
    const pd = formatReverbDisplay(activeTiming.preDelayMs, unitMode, 'predelay');
    const dec = formatReverbDisplay(activeTiming.decayMs, unitMode, 'decay');
    const tot = formatReverbDisplay(activeTiming.totalMs, unitMode, 'total');

    dom.envelopeVerifyBadge.textContent = `PRE + DECAY = ${tot.primary}`;
    dom.btnAuditionEnvelope.disabled = false;
    dom.btnCopyEnvelope.disabled = false;

    dom.envValPreDelay.textContent = pd.primary;
    dom.envSubPreDelay.textContent = `${activeTiming.preDelayNoteLabel} · ${pd.secondary}`;
    dom.envCopyPreDelay.disabled = false;
    dom.envCopyPreDelay.dataset.copy = pd.copyValue;
    dom.envCopyPreDelay.dataset.toast = `Copied ${pd.primary} (${ctx.name} Pre-Delay @ ${bpmStr} BPM)`;

    dom.envValDecay.textContent = dec.primary;
    dom.envSubDecay.textContent = `${dec.secondary} · RT60`;
    dom.envCopyDecay.disabled = false;
    dom.envCopyDecay.dataset.copy = dec.copyValue;
    dom.envCopyDecay.dataset.toast = `Copied ${dec.primary} (${dec.secondary} · ${ctx.name} Decay @ ${bpmStr} BPM)`;

    dom.envValTotal.textContent = tot.primary;
    dom.envSubTotal.textContent = `${tot.secondary} · ${activeTiming.totalLabel}`;
    dom.envCopyTotal.disabled = false;
    dom.envCopyTotal.dataset.copy = tot.copyValue;
    dom.envCopyTotal.dataset.toast = `Copied ${tot.primary} (${ctx.name} Total @ ${bpmStr} BPM)`;
  } else {
    const pd = formatReverbDisplay(activeTiming.preDelayMs, unitMode, 'predelay');
    const tot = formatReverbDisplay(activeTiming.totalMs, unitMode, 'total');

    dom.envelopeVerifyBadge.textContent = 'OVERLAP WARNING';
    dom.btnAuditionEnvelope.disabled = true;
    dom.btnCopyEnvelope.disabled = true;

    dom.envValPreDelay.textContent = pd.primary;
    dom.envSubPreDelay.textContent = `${activeTiming.preDelayNoteLabel} (EXCEEDS TOTAL)`;
    dom.envCopyPreDelay.disabled = false;
    dom.envCopyPreDelay.dataset.copy = pd.copyValue;
    dom.envCopyPreDelay.dataset.toast = `Copied ${pd.primary} (${activeTiming.preDelayNoteLabel} @ ${bpmStr} BPM)`;

    dom.envValDecay.textContent = '—';
    dom.envSubDecay.textContent = 'SHORTEN PRE-DELAY';
    dom.envCopyDecay.disabled = true;

    dom.envValTotal.textContent = tot.primary;
    dom.envSubTotal.textContent = `${tot.secondary} · ${activeTiming.totalLabel}`;
    dom.envCopyTotal.disabled = false;
    dom.envCopyTotal.dataset.copy = tot.copyValue;
    dom.envCopyTotal.dataset.toast = `Copied ${tot.primary} (${activeTiming.totalLabel} @ ${bpmStr} BPM)`;
  }

  const activeReverbAudId = `reverb:${ctx.sourceId}`;
  dom.btnAuditionEnvelope.textContent = state.activeAuditionId === activeReverbAudId
    ? '■ Stop'
    : '▶ Hear';

  if (envelopeRenderer) {
    envelopeRenderer.setTiming(activeTiming, ctx.name);
  }

  // 3. Update Custom Reverb Builder Card
  const custom = ctx.custom;
  dom.customPreDelayNote.value = String(state.customPreDelayDenom);
  dom.customTotalBeats.value = String(state.customTotalBeats);

  const varBtns = Array.from(dom.customPreDelayVarGroup.querySelectorAll('.seg-btn'));
  varBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.var === state.customPreDelayVariation);
    btn.disabled = state.customPreDelayDenom === 0;
  });

  if (custom.valid) {
    const pd = formatReverbDisplay(custom.preDelayMs, unitMode, 'predelay');
    const dec = formatReverbDisplay(custom.decayMs, unitMode, 'decay');
    const tot = formatReverbDisplay(custom.totalMs, unitMode, 'total');

    dom.customReverbWarning.classList.add('hidden');
    dom.btnAuditionCustom.disabled = false;

    dom.customOutPreDelay.textContent = pd.primary;
    dom.customOutPreDelaySub.textContent = `${custom.preDelayNoteLabel} · ${formatSamples(custom.preDelaySamples48000)} smp @ 48k`;
    dom.customCopyPreDelay.disabled = false;
    dom.customCopyPreDelay.dataset.copy = pd.copyValue;
    dom.customCopyPreDelay.dataset.toast = `Copied ${pd.primary} (Custom Pre-Delay @ ${bpmStr} BPM)`;

    dom.customOutDecay.textContent = dec.primary;
    dom.customOutDecaySub.textContent = `${dec.secondary} · RT60`;
    dom.customCopyDecay.disabled = false;
    dom.customCopyDecay.dataset.copy = dec.copyValue;
    dom.customCopyDecay.dataset.toast = `Copied ${dec.primary} (${dec.secondary} · Custom Decay @ ${bpmStr} BPM)`;

    dom.customOutTotal.textContent = tot.primary;
    dom.customOutTotalSub.textContent = `${tot.secondary} · ${custom.totalLabel}`;
    dom.customCopyTotal.disabled = false;
    dom.customCopyTotal.dataset.copy = tot.copyValue;
    dom.customCopyTotal.dataset.toast = `Copied ${tot.primary} (Custom Total @ ${bpmStr} BPM)`;
  } else {
    const pd = formatReverbDisplay(custom.preDelayMs, unitMode, 'predelay');
    const tot = formatReverbDisplay(custom.totalMs, unitMode, 'total');

    dom.customReverbWarning.classList.remove('hidden');
    dom.customReverbWarningText.textContent = custom.warning;
    dom.btnAuditionCustom.disabled = true;

    dom.customOutPreDelay.textContent = pd.primary;
    dom.customOutPreDelaySub.textContent = `${custom.preDelayNoteLabel} — TOO LONG`;
    dom.customCopyPreDelay.disabled = false;
    dom.customCopyPreDelay.dataset.copy = pd.copyValue;
    dom.customCopyPreDelay.dataset.toast = `Copied ${pd.primary} (Custom Pre-Delay @ ${bpmStr} BPM)`;

    dom.customOutDecay.textContent = '0.00';
    dom.customOutDecaySub.textContent = 'REDUCE PRE-DELAY';
    dom.customCopyDecay.disabled = true;

    dom.customOutTotal.textContent = tot.primary;
    dom.customOutTotalSub.textContent = `${tot.secondary} · ${custom.totalLabel}`;
    dom.customCopyTotal.disabled = false;
    dom.customCopyTotal.dataset.copy = tot.copyValue;
    dom.customCopyTotal.dataset.toast = `Copied ${tot.primary} (Custom Target @ ${bpmStr} BPM)`;
  }

  dom.btnAuditionCustom.textContent = state.activeAuditionId === 'reverb:custom'
    ? '■ Stop Custom'
    : '▶ Hear Custom';
}

function renderDelaySection() {
  const bpmStr = formatBpm(state.bpm);

  // 1. Top 4 Quick Vocal Delay Cards
  const quickDelays = calculateQuickDelays(state.bpm);
  const quickFrag = document.createDocumentFragment();
  for (const qd of quickDelays) {
    const auditionId = `delay:${qd.id}`;
    const isPlaying = state.activeAuditionId === auditionId;
    const msStr = formatMs(qd.ms);
    const hzStr = formatHz(qd.hz);

    const card = document.createElement('article');
    card.className = isPlaying ? 'quick-delay-card auditioning' : 'quick-delay-card';
    card.innerHTML = `
      <div class="qd-top">
        <div>
          <span class="micro qd-tag">${qd.tag}</span>
          <h3 class="qd-name">${qd.name}</h3>
        </div>
        <button
          type="button"
          class="qd-hear-btn"
          data-audition-delay="${qd.ms}"
          data-audition-id="${auditionId}"
          data-audition-label="${qd.name} (${msStr} ms)"
          aria-label="Hear ${qd.name} delay live"
        >${isPlaying ? '■ Stop' : '▶ Hear'}</button>
      </div>
      <button
        type="button"
        class="qd-ms-btn"
        data-copy="${msStr}"
        data-toast="Copied ${msStr} ms (${qd.name} @ ${bpmStr} BPM)"
        title="Click to copy ${msStr} ms"
      >
        <strong>${msStr} <span>ms</span></strong>
        <span class="micro qd-sub">${hzStr} Hz · ${formatSec(qd.ms)} s · CLICK TO COPY</span>
      </button>
    `;
    quickFrag.appendChild(card);
  }
  dom.quickDelaysGrid.innerHTML = '';
  dom.quickDelaysGrid.appendChild(quickFrag);

  // 2. Full 8-Subdivision × 3-Variation Delay Matrix
  const matrix = calculateDelayMatrix(state.bpm);
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
  renderReverbSection();
  renderDelaySection();
  renderDynamicsAndGroove();
}

/* ==========================================================================
   AUDITION & TAP TEMPO ACTIONS
   ========================================================================== */

function triggerTapTempo() {
  const res = tapEngine.tap(performance.now());

  dom.btnTapTempo.classList.add('tapped');
  dom.tapPadLed.classList.add('flash');
  pulseBeatVisual((res.tapCount - 1) % 4, (res.tapCount - 1) % 4 === 0);

  window.setTimeout(() => {
    dom.btnTapTempo.classList.remove('tapped');
    dom.tapPadLed.classList.remove('flash');
  }, 110);

  if (res.bpm !== null) {
    dom.tapStabilityLabel.textContent = `${res.stabilityLabel} ${res.tapCount}/8`;
    setBpm(res.bpm);
  } else {
    dom.tapStabilityLabel.textContent = 'TAP AGAIN';
  }

  if (tapIdleTimer !== null) {
    window.clearTimeout(tapIdleTimer);
  }
  tapIdleTimer = window.setTimeout(() => {
    dom.tapStabilityLabel.textContent = 'READY';
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
    showToast('Shorten Pre-Delay or increase Total Length before auditioning.', { isError: true });
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
      label: `${ctx.name} (${formatMs(ctx.timing.preDelayMs)}ms / ${formatSecShort(ctx.timing.decayMs)}s)`,
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
  // Direct numeric BPM input — live instant updates as you type
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

  // Nudge & ÷2 / ×2 buttons
  document.querySelectorAll('.deck-nudge-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.nudge) {
        setBpm(state.bpm + Number(btn.dataset.nudge));
      } else if (btn.dataset.scale) {
        setBpm(state.bpm * Number(btn.dataset.scale));
        showToast(`Tempo scaled to ${formatBpm(state.bpm)} BPM`);
      }
    });
  });

  // Quick BPM preset pills
  dom.genrePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      setBpm(Number(pill.dataset.bpm));
    });
  });

  // Tactile Tap Tempo Button (pointerdown for zero-latency tap feel + keyboard click)
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

  // Metronome, Stop, Volume
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

  // Audio Drop Auto-BPM
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

  // Header nav & Workspace tabs
  dom.navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      setActiveTab(link.dataset.nav);
    });
  });

  dom.wsTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setActiveTab(tab.dataset.tab);
    });
  });

  // Workspace quick actions
  dom.btnQuickBeatCopy.addEventListener('click', () => {
    if (dom.btnQuickBeatCopy.dataset.copyVal) {
      copyTextToClipboard(
        dom.btnQuickBeatCopy.dataset.copyVal,
        dom.btnQuickBeatCopy.dataset.copyLabel
      );
    }
  });

  dom.btnQuickExportMd.addEventListener('click', downloadMarkdownSheet);

  // Reverb Unit Mode Switcher
  dom.reverbUnitFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    state.reverbUnitMode = btn.dataset.unit;
    dom.reverbUnitFilter.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    renderReverbSection();
  });

  // Reverb Table delegation (Copy Value, Copy Row, Hear, Select Row for Envelope)
  dom.reverbPresetsBody.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    const row = e.target.closest('.reverb-row');

    if (copyBtn) {
      e.stopPropagation();
      if (row) {
        state.selectedReverbSource = row.dataset.presetId;
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

    if (row) {
      state.selectedReverbSource = row.dataset.presetId;
      renderReverbSection();
    }
  });

  dom.reverbPresetsBody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.reverb-row');
    if (!row || e.target.closest('button')) return;
    e.preventDefault();
    state.selectedReverbSource = row.dataset.presetId;
    renderReverbSection();
  });

  // Envelope Header Actions & Clickable Metrics
  dom.btnAuditionEnvelope.addEventListener('click', () => {
    handleAuditionReverb(state.selectedReverbSource);
  });

  dom.btnCopyEnvelope.addEventListener('click', () => {
    const ctx = getActiveReverbContext();
    if (!ctx.timing.valid) return;
    const pairText = `${ctx.name} @ ${formatBpm(state.bpm)} BPM: Pre-Delay ${formatMs(ctx.timing.preDelayMs)} ms (${ctx.timing.preDelayNoteLabel}), Decay ${formatSecShort(ctx.timing.decayMs)} s (${formatMs(ctx.timing.decayMs)} ms), Total ${formatSecShort(ctx.timing.totalMs)} s`;
    copyTextToClipboard(pairText, `Copied ${ctx.name} Pre-Delay + Decay pair`);
  });

  [dom.envCopyPreDelay, dom.envCopyDecay, dom.envCopyTotal].forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!btn.disabled && btn.dataset.copy) {
        copyTextToClipboard(btn.dataset.copy, btn.dataset.toast);
      }
    });
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

  // Quick Vocal Delays Delegation
  dom.quickDelaysGrid.addEventListener('click', (e) => {
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

  // Sample Rate Filter Segmented Control
  dom.sampleRateFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    state.sampleRateView = btn.dataset.sr;
    dom.sampleRateFilter.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    renderDelaySection();
  });

  // Delay Matrix delegated Click & Double-Click
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
    if (e.key === '1') {
      e.preventDefault();
      setActiveTab('reverb');
    } else if (e.key === '2') {
      e.preventDefault();
      setActiveTab('delay');
    } else if (e.key === '3') {
      e.preventDefault();
      setActiveTab('groove');
    } else if (keyLower === 't') {
      e.preventDefault();
      triggerTapTempo();
    } else if (keyLower === 'm') {
      e.preventDefault();
      audioEngine.toggleMetronome(state.bpm).then(updateDeckStatusVisuals).catch((err) => {
        showToast(err.message || 'Unable to start metronome.', { isError: true });
      });
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setBpm(state.bpm + (1));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setBpm(state.bpm - (1));
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

    renderReverbSection();
    renderDelaySection();
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
  setActiveTab(loadInitialTab());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
