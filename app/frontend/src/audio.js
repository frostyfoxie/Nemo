
Action: file_editor create /app/frontend/src/audio.js --file-text "/**
 * audio.js — procedural Web Audio engine.
 *
 * All sounds are synthesised in the browser so the piece is self-contained
 * and can react dynamically to scroll progress. Sounds:
 *
 *   - rain         : continuous filtered white noise
 *   - thunder      : one-shot low-rumble bursts (for lightning)
 *   - heartbeat    : low sine pulse pair at ~80 bpm
 *   - clockTick    : short metallic tick once per second
 *   - panicLaugh   : brief dissonant sweep used for the trigger scene
 */

let ctx = null;
let master = null;

let rainNode = null;
let rainGain = null;
let rainFilter = null;

let heartbeatHandle = null;
let heartbeatGain = null;

let clockHandle = null;
let clockGain = null;

function ensureCtx() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  return ctx;
}

/* ---------- utilities ---------- */

function createNoiseBuffer(seconds = 2) {
  const c = ensureCtx();
  const buffer = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // pink-ish noise
    data[i] = (Math.random() * 2 - 1) * 0.9;
  }
  return buffer;
}

/* ---------- RAIN ---------- */

export function startRain() {
  const c = ensureCtx();
  if (rainNode) return;

  const buffer = createNoiseBuffer(4);
  rainNode = c.createBufferSource();
  rainNode.buffer = buffer;
  rainNode.loop = true;

  rainFilter = c.createBiquadFilter();
  rainFilter.type = \"bandpass\";
  rainFilter.frequency.value = 1100;
  rainFilter.Q.value = 0.6;

  const highCut = c.createBiquadFilter();
  highCut.type = \"lowpass\";
  highCut.frequency.value = 5200;

  rainGain = c.createGain();
  rainGain.gain.value = 0.0;

  rainNode.connect(rainFilter);
  rainFilter.connect(highCut);
  highCut.connect(rainGain);
  rainGain.connect(master);
  rainNode.start();

  // gentle fade-in
  rainGain.gain.setTargetAtTime(0.22, c.currentTime, 2.2);
}

/** 0..1 normalized perceived loudness, also controls muffling */
export function setRainIntensity(level) {
  if (!rainGain || !rainFilter) return;
  const c = ctx;
  const now = c.currentTime;
  const target = Math.max(0, Math.min(1, level));
  // volume
  rainGain.gain.setTargetAtTime(0.06 + 0.28 * target, now, 0.35);
  // muffle: low-pass like — when inside we make the rain quieter & duller
  rainFilter.frequency.setTargetAtTime(400 + 1400 * target, now, 0.35);
}

/* ---------- THUNDER (one-shot rumble) ---------- */

export function thunder({ intensity = 0.8, long = false } = {}) {
  const c = ensureCtx();
  const now = c.currentTime;

  // noise-based rumble
  const src = c.createBufferSource();
  src.buffer = createNoiseBuffer(long ? 3.5 : 2.2);
  const lp = c.createBiquadFilter();
  lp.type = \"lowpass\";
  lp.frequency.value = 180;
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.55 * intensity, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + (long ? 3.4 : 2.0));
  src.connect(lp);
  lp.connect(g);
  g.connect(master);
  src.start(now);
  src.stop(now + (long ? 3.6 : 2.3));

  // subsonic thump
  const osc = c.createOscillator();
  osc.type = \"sine\";
  osc.frequency.setValueAtTime(55, now);
  osc.frequency.exponentialRampToValueAtTime(22, now + 0.6);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, now);
  og.gain.exponentialRampToValueAtTime(0.35 * intensity, now + 0.08);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
  osc.connect(og);
  og.connect(master);
  osc.start(now);
  osc.stop(now + 1.2);
}

/* ---------- HEARTBEAT ---------- */

export function startHeartbeat() {
  const c = ensureCtx();
  if (heartbeatHandle) return;
  heartbeatGain = c.createGain();
  heartbeatGain.gain.value = 0;
  heartbeatGain.connect(master);
  heartbeatGain.gain.setTargetAtTime(0.9, c.currentTime, 0.6);

  const beat = () => {
    const t = c.currentTime;
    const mkBeat = (offset, vol) => {
      const osc = c.createOscillator();
      osc.type = \"sine\";
      osc.frequency.setValueAtTime(58, t + offset);
      osc.frequency.exponentialRampToValueAtTime(38, t + offset + 0.18);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t + offset);
      g.gain.exponentialRampToValueAtTime(vol, t + offset + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.28);
      osc.connect(g);
      g.connect(heartbeatGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.35);
    };
    mkBeat(0, 0.7);
    mkBeat(0.22, 0.5);
  };
  beat();
  heartbeatHandle = setInterval(beat, 820);
}

export function stopHeartbeat() {
  if (!heartbeatHandle) return;
  clearInterval(heartbeatHandle);
  heartbeatHandle = null;
  if (heartbeatGain && ctx) {
    heartbeatGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  }
}

/* ---------- CLOCK TICK ---------- */

export function startClock() {
  const c = ensureCtx();
  if (clockHandle) return;
  clockGain = c.createGain();
  clockGain.gain.value = 0;
  clockGain.connect(master);
  clockGain.gain.setTargetAtTime(0.45, c.currentTime, 1.2);

  const tick = () => {
    const t = c.currentTime;
    const src = c.createBufferSource();
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = \"bandpass\";
    bp.frequency.value = 3800;
    bp.Q.value = 4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(bp);
    bp.connect(g);
    g.connect(clockGain);
    src.start(t);
    src.stop(t + 0.14);
  };
  tick();
  clockHandle = setInterval(tick, 1000);
}

export function setClockIntensity(level) {
  if (!clockGain || !ctx) return;
  const v = Math.max(0, Math.min(1, level));
  clockGain.gain.setTargetAtTime(0.15 + 0.8 * v, ctx.currentTime, 0.4);
}

export function stopClock() {
  if (!clockHandle) return;
  clearInterval(clockHandle);
  clockHandle = null;
  if (clockGain && ctx) {
    clockGain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
  }
}

/* ---------- PANIC LAUGH (abstract) ---------- */

export function panicLaugh() {
  const c = ensureCtx();
  const now = c.currentTime;

  // brief dissonant swelling cluster
  const osc1 = c.createOscillator();
  osc1.type = \"sawtooth\";
  osc1.frequency.setValueAtTime(380, now);
  osc1.frequency.exponentialRampToValueAtTime(140, now + 0.6);

  const osc2 = c.createOscillator();
  osc2.type = \"triangle\";
  osc2.frequency.setValueAtTime(620, now);
  osc2.frequency.exponentialRampToValueAtTime(210, now + 0.6);

  const bp = c.createBiquadFilter();
  bp.type = \"bandpass\";
  bp.frequency.setValueAtTime(1800, now);
  bp.frequency.exponentialRampToValueAtTime(320, now + 0.8);
  bp.Q.value = 3;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.26, now + 0.07);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

  osc1.connect(bp);
  osc2.connect(bp);
  bp.connect(g);
  g.connect(master);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.9);
  osc2.stop(now + 0.9);
}

/* ---------- MASTER FADE ---------- */

export function fadeMaster(to = 0, seconds = 1.2) {
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(to, ctx.currentTime, seconds / 3);
}
"
Observation: Create successful: /app/frontend/src/audio.js
