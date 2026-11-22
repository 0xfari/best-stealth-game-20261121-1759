// Every sound is synthesised live with WebAudio — no audio files, no network.
// Footsteps are the heart of it: the player's own taps, and a guard's heavier tread,
// louder and panned by where the guard stands, so you can hear trouble coming.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let ambient = null;

  /** Build the context on the first user gesture; browsers block sound before one. */
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    startAmbient();
    return true;
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  function isMuted() {
    return muted;
  }

  /** A low room tone: two detuned sines breathing slowly, plus a soft filtered hiss. */
  function startAmbient() {
    if (ambient || !context) return;
    const gain = context.createGain();
    gain.gain.value = 0.05;
    gain.connect(master);
    const oscA = context.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 55;
    const oscB = context.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 55.7;
    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    oscA.start();
    oscB.start();
    lfo.start();
    ambient = { gain, oscA, oscB, lfo };
  }

  /** A short burst of filtered noise: a footstep, a thud, a clock tick. */
  function noiseBurst(when, duration, frequency, volume, pan) {
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = volume;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    source.start(when);
  }

  /** One sine note with a quick attack and a fall. */
  function tone(when, frequency, duration, volume, type, pan) {
    const osc = context.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    const panner = context.createStereoPanner();
    panner.pan.value = pan || 0;
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  /** The player's footstep: a soft tap, quieter while sneaking. */
  function step(sneak) {
    if (!context) return;
    noiseBurst(context.currentTime, 0.05, sneak ? 500 : 900, sneak ? 0.05 : 0.1, 0);
  }

  /**
   * A guard's tread: heavier, lower, panned by where the guard is relative to the
   * player and quieter the further away it is. This is how you hear one coming.
   */
  function guardStep(distance, pan) {
    if (!context) return;
    const volume = Math.max(0, 0.22 * (1 - distance / 340));
    if (volume <= 0.01) return;
    noiseBurst(context.currentTime, 0.07, 320, volume, Math.max(-1, Math.min(1, pan)));
  }

  /** Two-note brass-ish swell: a guard has gone fully alert. */
  function alertSting() {
    if (!context) return;
    const now = context.currentTime;
    tone(now, 233, 0.35, 0.16, 'sawtooth', 0);
    tone(now + 0.12, 311, 0.5, 0.16, 'sawtooth', 0);
    tone(now, 117, 0.5, 0.1, 'triangle', 0);
  }

  /** A soft chime when an artifact is lifted off its pedestal. */
  function pickup() {
    if (!context) return;
    const now = context.currentTime;
    tone(now, 880, 0.25, 0.12, 'sine', 0);
    tone(now + 0.07, 1318, 0.35, 0.1, 'sine', 0);
  }

  /** A low thud and a falling tone: caught. */
  function caught() {
    if (!context) return;
    const now = context.currentTime;
    noiseBurst(now, 0.18, 180, 0.3, 0);
    tone(now, 220, 0.7, 0.18, 'sawtooth', 0);
    tone(now + 0.1, 165, 0.7, 0.14, 'sawtooth', 0);
  }

  /** A bright metallic tink when a thrown coin lands and starts ringing. */
  function coin() {
    if (!context) return;
    const now = context.currentTime;
    tone(now, 1568, 0.3, 0.1, 'triangle', 0);
    tone(now + 0.05, 2093, 0.4, 0.07, 'sine', 0);
  }

  /** A short rising figure when a level is cleared. */
  function levelClear() {
    if (!context) return;
    const now = context.currentTime;
    const notes = [523, 659, 784, 1046];
    notes.forEach((frequency, index) => {
      tone(now + index * 0.09, frequency, 0.3, 0.12, 'triangle', 0);
    });
  }

  /** A longer fanfare when the last vault is emptied. */
  function win() {
    if (!context) return;
    const now = context.currentTime;
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((frequency, index) => {
      tone(now + index * 0.11, frequency, 0.4, 0.12, 'triangle', 0);
    });
  }

  return { ensure, setMuted, isMuted, step, guardStep, alertSting, pickup, caught, coin, levelClear, win };
}
