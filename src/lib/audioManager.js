const SFX_VOLUME = {
  submit: 0.15,
  open: 0.18,
  timer: 0.2,
  draw: 0.16,
};

class AudioManager {
  constructor() {
    this.unlocked = false;
    this.muted = false;
    this.context = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.ambientStarted = false;
    this.ambientNodes = [];
  }

  async begin() {
    this.unlocked = true;

    const context = this.ensureContext();
    if (!context) return;

    if (context.state === "suspended") {
      await context.resume();
    }

    this.startAmbient();
  }

  ensureContext() {
    if (this.context) return this.context;
    if (typeof window === "undefined") return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(this.context.destination);

    this.ambientGain = this.context.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.masterGain);

    return this.context;
  }

  startAmbient() {
    const context = this.ensureContext();
    if (!context || this.ambientStarted || !this.ambientGain) return;

    this.ambientStarted = true;
    const now = context.currentTime;
    this.ambientGain.gain.setTargetAtTime(0.24, now, 3.5);

    [
      { frequency: 110, detune: -8, gain: 0.045, pan: -0.45, lfo: 0.035 },
      { frequency: 164.81, detune: 5, gain: 0.035, pan: 0.28, lfo: 0.05 },
      { frequency: 220, detune: 11, gain: 0.022, pan: 0.08, lfo: 0.028 },
    ].forEach((tone, index) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      const panNode = context.createStereoPanner ? context.createStereoPanner() : null;

      oscillator.type = "sine";
      oscillator.frequency.value = tone.frequency;
      oscillator.detune.value = tone.detune;

      gainNode.gain.value = 0;
      gainNode.gain.linearRampToValueAtTime(tone.gain, now + 4 + index * 0.8);

      lfo.frequency.value = tone.lfo;
      lfoGain.gain.value = tone.gain * 0.55;
      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);

      if (panNode) {
        panNode.pan.value = tone.pan;
        oscillator.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(this.ambientGain);
        this.ambientNodes.push(oscillator, gainNode, lfo, lfoGain, panNode);
      } else {
        oscillator.connect(gainNode);
        gainNode.connect(this.ambientGain);
        this.ambientNodes.push(oscillator, gainNode, lfo, lfoGain);
      }

      oscillator.start(now);
      lfo.start(now);
    });
  }

  setMuted(nextMuted) {
    this.muted = nextMuted;

    const context = this.ensureContext();
    if (!context || !this.masterGain) return;

    this.masterGain.gain.cancelScheduledValues(context.currentTime);
    this.masterGain.gain.setTargetAtTime(nextMuted ? 0 : 1, context.currentTime, 0.08);

    if (!nextMuted && this.unlocked) {
      void context.resume();
      this.startAmbient();
    }
  }

  play(name) {
    if (!this.unlocked || this.muted) return;

    const context = this.ensureContext();
    if (!context || !this.masterGain) return;

    void context.resume();

    if (name === "submit") {
      this.playSubmit(context);
    } else if (name === "open") {
      this.playOpen(context);
    } else if (name === "timer") {
      this.playTimer(context);
    } else if (name === "draw") {
      this.playDraw(context);
    }
  }

  playSubmit(context) {
    const now = context.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.playTone(context, {
        frequency,
        start: now + index * 0.075,
        duration: 0.5,
        type: "triangle",
        volume: SFX_VOLUME.submit,
      });
    });
  }

  playOpen(context) {
    const now = context.currentTime;
    this.playNoise(context, {
      start: now,
      duration: 0.35,
      filterStart: 420,
      filterEnd: 4200,
      volume: SFX_VOLUME.open,
    });
    this.playTone(context, {
      frequency: 392,
      start: now + 0.08,
      duration: 0.42,
      type: "sine",
      volume: 0.08,
    });
  }

  playTimer(context) {
    const now = context.currentTime;
    [880, 1320, 1760].forEach((frequency, index) => {
      this.playTone(context, {
        frequency,
        start: now + index * 0.08,
        duration: 1.2 - index * 0.12,
        type: "sine",
        volume: SFX_VOLUME.timer / (index + 1),
      });
    });
  }

  playDraw(context) {
    const now = context.currentTime;
    [196, 293.66, 392, 587.33].forEach((frequency, index) => {
      this.playTone(context, {
        frequency,
        start: now + index * 0.055,
        duration: 0.72,
        type: "triangle",
        volume: SFX_VOLUME.draw / (index ? 1.25 : 1),
      });
    });
  }

  playTone(context, { frequency, start, duration, type, volume }) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  playNoise(context, { start, duration, filterStart, filterEnd, volume }) {
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < sampleCount; index += 1) {
      const envelope = 1 - index / sampleCount;
      channel[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gainNode = context.createGain();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterStart, start);
    filter.frequency.exponentialRampToValueAtTime(filterEnd, start + duration);
    filter.Q.value = 0.8;

    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(start);
    source.stop(start + duration + 0.02);
  }
}

export const audioManager = new AudioManager();
export const audioSources = {
  mode: "web-audio-synth",
};
