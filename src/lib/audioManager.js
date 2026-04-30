const AUDIO_SOURCES = {
  bgm: "/audio/bgm.mp3",
  submit: "/audio/chime.mp3",
  open: "/audio/card-flip.mp3",
  timer: "/audio/bell.mp3",
};

const SFX_VOLUME = {
  submit: 0.42,
  open: 0.34,
  timer: 0.52,
};

class AudioManager {
  constructor() {
    this.unlocked = false;
    this.muted = false;
    this.bgm = new Audio(AUDIO_SOURCES.bgm);
    this.bgm.loop = true;
    this.bgm.volume = 0.28;
  }

  async begin() {
    this.unlocked = true;
    await this.playBgm();
  }

  async playBgm() {
    if (!this.unlocked || this.muted) return;

    try {
      await this.bgm.play();
    } catch {
      // Placeholder audio files may not exist yet; fail quietly until assets are added.
    }
  }

  setMuted(nextMuted) {
    this.muted = nextMuted;
    this.bgm.muted = nextMuted;

    if (nextMuted) {
      this.bgm.pause();
      return;
    }

    void this.playBgm();
  }

  play(name) {
    if (!this.unlocked || this.muted || !AUDIO_SOURCES[name]) return;

    const sound = new Audio(AUDIO_SOURCES[name]);
    sound.volume = SFX_VOLUME[name] ?? 0.4;
    sound.play().catch(() => {
      // Ignore missing placeholder files and browser decoding errors.
    });
  }
}

export const audioManager = new AudioManager();
export const audioSources = AUDIO_SOURCES;
