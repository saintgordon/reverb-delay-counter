/**
 * Reverb & Delay Counter (TOOL / 006) — Saint Gordon Collective
 * Clean Single-Page Controller
 */

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
  calculateDelayMatrix,
  calculateReverbPresets,
  TapTempoEngine,
} from './timing-math.js';
import { StudioAuditionEngine } from './audition-audio.js';

const STORAGE_KEY = 'sg_reverb_delay_bpm_v1';

const state = {
  bpm: DEFAULT_BPM,
  reverbUnitMode: 'plugin', // 'plugin' | 'ms' | 'sec'
  isAnalyzingFile: false,
};

const tapEngine = new TapTempoEngine();
const audioEngine = new StudioAuditionEngine();

let tapResetTimer = null;
let beatPulseTimer = null;

const dom = {};

function cacheDom() {
  dom.studioDeck = document.getElementById('studio-deck');
  dom.deckBeatLed = document.getElementById('deck-beat-led');
  dom.deckLiveReadout = document.getElementById('deck-live-readout');
  dom.bpmInput = document.getElementById('bpm-input');
  dom.btnBpmDec = document.getElementById('btn-bpm-dec');
  dom.btnBpmInc = document.getElementById('btn-bpm-inc');

  dom.btnTapTempo = document.getElementById('btn-tap-tempo');
  dom.tapLabel = document.getElementById('tap-label');

  dom.btnMetronome = document.getElementById('btn-metronome');
  dom.metroGlyph = document.getElementById('metro-glyph');
  dom.metroLabel = document.getElementById('metro-label');

  dom.btnDropSong = document.getElementById('btn-drop-song');
  dom.dropSongLabel = document.getElementById('drop-song-label');
  dom.bpmAudioInput = document.getElementById('bpm-audio-input');
  dom.detectBanner = document.getElementById('bpm-detect-banner');
  dom.detectDetail = document.getElementById('bpm-detect-detail');
  dom.btnDetectDismiss = document.getElementById('btn-detect-dismiss');

  dom.reverbUnitFilter = document.getElementById('reverb-unit-filter');
  dom.reverbPresetsBody = document.getElementById('reverb-presets-body');
  dom.delayMatrixBody = document.getElementById('delay-matrix-body');

  dom.footerYear = document.getElementById('footer-year');
  dom.toastContainer = document.getElementById('toast-container');
}

function showToast(message, { isError = false, durationMs = 2200 } = {}) {
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
    window.setTimeout(() => toast.remove(), 220);
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
    showToast('Clipboard blocked — select text to copy manually.', { isError: true });
  }
}

function loadInitialBpm() {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramBpm = parseBpmInput(params.get('bpm'));
    if (paramBpm !== null) return paramBpm;
  } catch {
    // Ignore
  }

  try {
    const saved = parseBpmInput(window.localStorage.getItem(STORAGE_KEY));
    if (saved !== null) return saved;
  } catch {
    // Ignore
  }

  return DEFAULT_BPM;
}

function saveBpm(bpm) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(bpm));
  } catch {
    // Ignore
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

function pulseBeatVisual() {
  if (!dom.deckBeatLed) return;
  dom.deckBeatLed.classList.add('pulse');
  if (beatPulseTimer !== null) {
    window.clearTimeout(beatPulseTimer);
  }
  beatPulseTimer = window.setTimeout(() => {
    dom.deckBeatLed.classList.remove('pulse');
  }, 100);
}

function updateMetronomeUI() {
  const running = audioEngine.metronomeRunning;
  dom.btnMetronome.classList.toggle('active', running);
  dom.btnMetronome.setAttribute('aria-pressed', String(running));
  dom.metroGlyph.textContent = running ? '■' : '▶';
  dom.metroLabel.textContent = running ? 'Stop' : 'Click';
}

function renderAll() {
  const bpmStr = formatBpm(state.bpm);
  const summary = calculateTempoSummary(state.bpm);
  dom.deckLiveReadout.textContent = `1 Beat ${formatMs(summary.beatMs)} ms · 1 Bar ${formatMs(summary.barMs)} ms`;
  if (dom.btnBpmDec) dom.btnBpmDec.disabled = state.bpm <= MIN_BPM;
  if (dom.btnBpmInc) dom.btnBpmInc.disabled = state.bpm >= MAX_BPM;
  updateMetronomeUI();

  // 1. Reverb Table
  const presets = calculateReverbPresets(state.bpm);
  const unitMode = state.reverbUnitMode;
  const revFrag = document.createDocumentFragment();

  for (const preset of presets) {
    const pd = formatReverbDisplay(preset.preDelayMs, unitMode, 'predelay');
    const dec = formatReverbDisplay(preset.decayMs, unitMode, 'decay');
    const tot = formatReverbDisplay(preset.totalMs, unitMode, 'total');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="space-name">${preset.name}</span>
        <span class="space-meta micro">${preset.totalLabel} · ${preset.preDelayLabel} Pre-Delay</span>
      </td>
      <td>
        <button
          type="button"
          class="val-copy-btn"
          data-copy="${pd.copyValue}"
          data-toast="Copied ${pd.primary} (${preset.name} Pre-Delay @ ${bpmStr} BPM)"
        >${pd.value} <span class="val-unit">${pd.unit}</span></button>
      </td>
      <td>
        <button
          type="button"
          class="val-copy-btn"
          data-copy="${dec.copyValue}"
          data-toast="Copied ${dec.primary} (${preset.name} Decay @ ${bpmStr} BPM)"
        >${dec.value} <span class="val-unit">${dec.unit}</span></button>
      </td>
      <td>
        <button
          type="button"
          class="val-copy-btn"
          data-copy="${tot.copyValue}"
          data-toast="Copied ${tot.primary} (${preset.name} Total @ ${bpmStr} BPM)"
        >${tot.value} <span class="val-unit">${tot.unit}</span></button>
      </td>
    `;
    revFrag.appendChild(tr);
  }
  dom.reverbPresetsBody.innerHTML = '';
  dom.reverbPresetsBody.appendChild(revFrag);

  // 2. Delay Table (ms only)
  const matrix = calculateDelayMatrix(state.bpm);
  const delFrag = document.createDocumentFragment();

  for (const row of matrix) {
    const tr = document.createElement('tr');
    const sMs = formatMs(row.straight.ms);
    const dMs = formatMs(row.dotted.ms);
    const tMs = formatMs(row.triplet.ms);

    tr.innerHTML = `
      <td>
        <span class="note-label">${row.label}</span>
        <span class="note-name micro">${row.name}</span>
      </td>
      <td>
        <button
          type="button"
          class="val-copy-btn"
          data-copy="${sMs}"
          data-toast="Copied ${sMs} ms (${row.straight.noteTag} @ ${bpmStr} BPM)"
        >${sMs} <span class="val-unit">ms</span></button>
      </td>
      <td>
        <button
          type="button"
          class="val-copy-btn"
          data-copy="${dMs}"
          data-toast="Copied ${dMs} ms (${row.dotted.noteTag} @ ${bpmStr} BPM)"
        >${dMs} <span class="val-unit">ms</span></button>
      </td>
      <td>
        <button
          type="button"
          class="val-copy-btn"
          data-copy="${tMs}"
          data-toast="Copied ${tMs} ms (${row.triplet.noteTag} @ ${bpmStr} BPM)"
        >${tMs} <span class="val-unit">ms</span></button>
      </td>
    `;
    delFrag.appendChild(tr);
  }
  dom.delayMatrixBody.innerHTML = '';
  dom.delayMatrixBody.appendChild(delFrag);
}

function triggerTapTempo() {
  const res = tapEngine.tap(performance.now());
  dom.btnTapTempo.classList.add('tapped');
  pulseBeatVisual();

  window.setTimeout(() => {
    dom.btnTapTempo.classList.remove('tapped');
  }, 100);

  if (res.bpm !== null) {
    dom.tapLabel.textContent = `${res.bpm} BPM`;
    setBpm(res.bpm);
  } else {
    dom.tapLabel.textContent = 'Tap…';
  }

  if (tapResetTimer !== null) {
    window.clearTimeout(tapResetTimer);
  }
  tapResetTimer = window.setTimeout(() => {
    dom.tapLabel.textContent = 'Tap';
  }, 2500);
}

async function handleAudioFileForBpm(file) {
  if (!file || state.isAnalyzingFile) return;
  state.isAnalyzingFile = true;
  dom.dropSongLabel.textContent = 'Reading…';

  try {
    const result = await audioEngine.detectBpmFromAudioFile(file);
    setBpm(result.bpm);
    dom.detectBanner.classList.remove('hidden');
    dom.detectDetail.textContent = `Detected ${formatBpm(result.bpm)} BPM from ${result.filename}`;
    showToast(`Detected ${formatBpm(result.bpm)} BPM`);
  } catch (err) {
    showToast(err.message || 'Could not detect BPM from audio file.', { isError: true });
  } finally {
    state.isAnalyzingFile = false;
    dom.dropSongLabel.textContent = 'Drop Song';
  }
}

function bindEvents() {
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
  dom.bpmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitBpmInput();
      dom.bpmInput.select();
    }
  });

  document.querySelectorAll('.deck-nudge-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setBpm(state.bpm + Number(btn.dataset.nudge));
    });
  });

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

  dom.btnMetronome.addEventListener('click', async () => {
    try {
      await audioEngine.toggleMetronome(state.bpm);
      updateMetronomeUI();
    } catch (err) {
      showToast(err.message || 'Unable to start metronome.', { isError: true });
    }
  });

  dom.btnDropSong.addEventListener('click', () => {
    dom.bpmAudioInput.value = '';
    dom.bpmAudioInput.click();
  });

  dom.bpmAudioInput.addEventListener('change', () => {
    const file = dom.bpmAudioInput.files && dom.bpmAudioInput.files[0];
    if (file) handleAudioFileForBpm(file);
  });

  let dragDepth = 0;
  const hasFileDrag = (e) =>
    Boolean(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));

  window.addEventListener('dragenter', (e) => {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    dragDepth += 1;
    dom.studioDeck.classList.add('drag-over');
  });

  window.addEventListener('dragover', (e) => {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    if (!hasFileDrag(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dom.studioDeck.classList.remove('drag-over');
    }
  });

  window.addEventListener('drop', (e) => {
    if (!hasFileDrag(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dom.studioDeck.classList.remove('drag-over');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleAudioFileForBpm(file);
  });

  dom.btnDetectDismiss.addEventListener('click', () => {
    dom.detectBanner.classList.add('hidden');
  });

  dom.reverbUnitFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    state.reverbUnitMode = btn.dataset.unit;
    dom.reverbUnitFilter.querySelectorAll('.seg-btn').forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', String(isActive));
    });
    renderAll();
  });

  const handleCopyClick = (e) => {
    const btn = e.target.closest('[data-copy]');
    if (btn) {
      btn.classList.add('copied');
      window.setTimeout(() => btn.classList.remove('copied'), 550);
      copyTextToClipboard(btn.dataset.copy, btn.dataset.toast);
    }
  };

  dom.reverbPresetsBody.addEventListener('click', handleCopyClick);
  dom.delayMatrixBody.addEventListener('click', handleCopyClick);

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
      audioEngine.stopMetronome();
      updateMetronomeUI();
      return;
    }

    if (isEditing) return;

    const keyLower = e.key.toLowerCase();
    if (keyLower === 't') {
      e.preventDefault();
      triggerTapTempo();
    } else if (keyLower === 'm') {
      e.preventDefault();
      audioEngine.toggleMetronome(state.bpm).then(updateMetronomeUI).catch((err) => {
        showToast(err.message || 'Unable to start metronome.', { isError: true });
      });
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setBpm(state.bpm + 1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setBpm(state.bpm - 1);
    }
  });

  audioEngine.setOnBeat(() => {
    pulseBeatVisual();
  });
}

function init() {
  cacheDom();
  if (dom.footerYear) {
    dom.footerYear.textContent = String(new Date().getFullYear());
  }

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
