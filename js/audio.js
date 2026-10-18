/**
 * Tiledly Procedural Web Audio Engine
 *
 * Generates zero-latency sound effects procedurally via Web Audio API.
 * Requires 0 external audio files, works 100% offline, and adheres to
 * CrazyGames and Poki audio guidelines and mute settings.
 */

import { Storage } from './storage.js';
import { AdAdapter } from './ads/ad-adapter.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.userMuted = Storage.getSetting('sound_enabled', true) === false;
    this.adMuted = false;
    this.platformMuted = false;
    this.comboCount = 0;
    this.lastTapTime = 0;

    // Listen for platform events (e.g. CrazyGames SDK muteAudio settings)
    if (typeof window !== 'undefined') {
      window.addEventListener('platform-audio-settings', (e) => {
        this.platformMuted = !!e.detail?.muteAudio;
        this._updateGain();
      });

      window.addEventListener('ad:started', () => {
        this.adMuted = true;
        this._updateGain();
      });

      window.addEventListener('ad:finished', () => {
        this.adMuted = false;
        this._updateGain();
      });

      // Resume suspended AudioContext on first user interaction
      const unlock = () => {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this._updateGain();
    } catch (e) {
      console.warn('[Audio] Web Audio API init failed:', e);
    }
  }

  isMuted() {
    return this.userMuted || this.platformMuted || this.adMuted || AdAdapter.isAudioMuted();
  }

  toggleMute() {
    this.userMuted = !this.userMuted;
    Storage.setSetting('sound_enabled', !this.userMuted);
    this._updateGain();
    return !this.userMuted;
  }

  setMuted(muted) {
    this.userMuted = !!muted;
    Storage.setSetting('sound_enabled', !this.userMuted);
    this._updateGain();
  }

  _updateGain() {
    if (!this.masterGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.isMuted()) {
      this.masterGain.gain.setValueAtTime(0, now);
    } else {
      this.masterGain.gain.setValueAtTime(0.85, now);
    }
  }

  _ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx && !this.isMuted();
  }

  /**
   * Pleasant pop/blip on correct tile taps.
   * Consecutive fast taps scale up through a pentatonic scale for maximum game feel.
   */
  playTap() {
    if (!this._ensureContext()) return;
    const now = this.ctx.currentTime;
    const timeSinceLast = performance.now() - this.lastTapTime;
    this.lastTapTime = performance.now();

    if (timeSinceLast < 1200) {
      this.comboCount = Math.min(this.comboCount + 1, 15);
    } else {
      this.comboCount = 0;
    }

    // Pentatonic scale pitches (C5, D5, E5, G5, A5, C6...)
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
    const freq = scale[this.comboCount % scale.length];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Low buzzy sawtooth wave on mistakes or mine triggers.
   */
  playError() {
    if (!this._ensureContext()) return;
    this.comboCount = 0;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.25);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Countdown beeps (3, 2, 1 -> tick; GO! -> high chime).
   */
  playCountdown(isLast = false) {
    if (!this._ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = isLast ? 880 : 440;
    const duration = isLast ? 0.25 : 0.12;

    osc.type = isLast ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(isLast ? 0.45 : 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Uplifting 4-note victory fanfare chord upon puzzle completion.
   */
  playVictory() {
    if (!this._ensureContext()) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.08;
      const duration = 0.45;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });
  }

  /**
   * Radar scan / peek chime for memory and minefield modes.
   */
  playRadar() {
    if (!this._ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2); // A5

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }
}

export const Sound = new AudioEngine();
