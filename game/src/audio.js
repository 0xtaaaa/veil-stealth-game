// VEIL — procedural sound only, no audio files. Everything is built from
// oscillators and short envelopes on a WebAudio context that starts on the
// first user gesture, so the page stays silent until play begins.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.muted = false;
  }

  // The browser only lets audio start after a gesture; call this from any
  // key or click handler and it becomes a no-op once running.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // A guard's step: a low thud, quieter the further away the guard is. This
  // is how the player hears a patrol coming before seeing the cone.
  guardStep(distance) {
    const gain = Math.max(0.02, 0.22 * (1 - distance / 420));
    this.tone(68, 0.09, 'sine', gain);
  }

  playerStep(crouched) {
    this.tone(crouched ? 150 : 110, 0.05, 'sine', crouched ? 0.03 : 0.06);
  }

  coinThrow() {
    this.tone(1400, 0.08, 'sine', 0.05, 0, 900);
  }

  coinClink() {
    this.tone(2400, 0.1, 'triangle', 0.12);
    this.tone(3100, 0.14, 'triangle', 0.08, 0.05);
  }

  pickup() {
    this.tone(660, 0.12, 'sine', 0.14);
    this.tone(990, 0.18, 'sine', 0.12, 0.08);
  }

  hack() {
    this.tone(520, 0.07, 'square', 0.06);
    this.tone(780, 0.07, 'square', 0.06, 0.08);
    this.tone(1040, 0.12, 'square', 0.07, 0.16);
  }

  // Two-tone sting when a guard goes fully alert.
  alertSting() {
    this.tone(220, 0.22, 'sawtooth', 0.16, 0, 311);
    this.tone(311, 0.3, 'sawtooth', 0.14, 0.16, 233);
  }

  busted() {
    this.tone(180, 0.5, 'sawtooth', 0.18, 0, 60);
  }

  levelDone() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.12, i * 0.09));
  }

  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, i * 0.11));
  }

  // A low museum-at-night hum under everything, started once per game.
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    g.gain.value = 0.035;
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    lfo.start();
    this.ambient = { osc, lfo };
  }
}
