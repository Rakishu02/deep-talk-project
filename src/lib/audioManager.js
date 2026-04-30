const AUDIO_SOURCES = {
  ambient: "/audio/ambient-night-loop.mp3",
  click: "/audio/ui-button-click.mp3",
  submit: "/audio/question-submit-chime.mp3",
  open: "/audio/question-card-open.mp3",
  draw: "/audio/question-draw-random.mp3",
  locked: "/audio/question-box-locked.mp3",
  timerWarning: "/audio/timer-final-five-tick.mp3",
  timerComplete: "/audio/timer-complete-bell.mp3",
};

const AUDIO_VOLUME = {
  ambient: 0.22,
  click: 0.36,
  submit: 0.46,
  open: 0.42,
  draw: 0.44,
  locked: 0.34,
  timerWarning: 0.5,
  timerComplete: 0.58,
};

class AudioManager {
  constructor() {
    this.unlocked = false;
    this.muted = false;
    this.ambient = null;
    this.sounds = new Map();
  }

  async begin() {
    this.unlocked = true;
    this.prepareAudio();
    await this.playAmbient();
  }

  prepareAudio() {
    if (typeof Audio === "undefined") return;

    Object.entries(AUDIO_SOURCES).forEach(([name, source]) => {
      if (this.sounds.has(name)) return;

      const audio = new Audio(source);
      audio.preload = "auto";
      audio.volume = AUDIO_VOLUME[name] ?? 0.4;

      if (name === "ambient") {
        audio.loop = true;
        this.ambient = audio;
      }

      this.sounds.set(name, audio);
    });
  }

  async playAmbient() {
    if (!this.unlocked || this.muted || !this.ambient) return;

    try {
      this.ambient.currentTime = this.ambient.currentTime || 0;
      await this.ambient.play();
    } catch {
      // The bundled mp3 files are intentionally dummy placeholders.
    }
  }

  setMuted(nextMuted) {
    this.muted = nextMuted;
    this.prepareAudio();

    if (this.ambient) {
      this.ambient.muted = nextMuted;

      if (nextMuted) {
        this.ambient.pause();
      } else {
        void this.playAmbient();
      }
    }
  }

  play(name) {
    if (!this.unlocked || this.muted) return;

    this.prepareAudio();

    const template = this.sounds.get(name);
    if (!template) return;

    const sound = template.cloneNode(true);
    sound.volume = AUDIO_VOLUME[name] ?? template.volume;
    sound.muted = this.muted;

    sound.play().catch(() => {
      // Ignore missing or empty dummy mp3 files until the real assets are dropped in.
    });
  }
}

export const audioManager = new AudioManager();
export const audioSources = AUDIO_SOURCES;
