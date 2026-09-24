// The hero sky, the rider, the story road and the off-the-clock toys come first,
// then one block per work window. Each block bails out quietly if its markup is missing.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// Run fn the first time `node` is mostly on screen; call onLeave/onEnter after that.
function watch(node, { once, enter, leave } = {}) {
  let seen = false;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { if (!seen && once) once(); seen = true; if (enter) enter(); }
    else if (seen && leave) leave();
  }, { threshold: 0.45 }).observe(node);
}

// Hero: the sky over Itanagar right now. Sun position comes from the NOAA
// solar equations, weather from Open-Meteo (no key). Everything degrades to
// a plain dusk sky if either is unavailable.
const ITANAGAR = { lat: 27.0844, lon: 93.6053 };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function sunAt(date) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = (date - start) / 864e5;
  const g = (2 * Math.PI / 365) * (doy - 1 + (date.getUTCHours() - 12) / 24);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const mins = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let ha = (mins + eq + 4 * ITANAGAR.lon) / 4 - 180;
  ha = ((ha + 540) % 360) - 180;
  const lat = ITANAGAR.lat * rad;
  const cz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha * rad);
  return { alt: 90 - Math.acos(clamp(cz, -1, 1)) / rad, ha };
}

// Sky colours by sun altitude: [altitude, top, horizon]
const SKY = [
  [-18, '#05070F', '#0D1226'], [-10, '#0A1030', '#232A55'], [-5, '#18214F', '#6A4B7E'],
  [-1, '#2E3C77', '#E0795F'], [4, '#4A71BA', '#F4AE72'], [12, '#5690D6', '#EBD7B8'], [30, '#3F86D8', '#A8D1F3'],
];
function skyFor(alt) {
  if (alt <= SKY[0][0]) return SKY[0].slice(1);
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const [a0, t0, h0] = SKY[i - 1], [a1, t1, h1] = SKY[i];
      const t = (alt - a0) / (a1 - a0);
      return [mix(t0, t1, t), mix(h0, h1, t)];
    }
  }
  return SKY[SKY.length - 1].slice(1);
}

const WX = (code) => {
  if (code === 0) return ['clear', 'clear skies'];
  if (code <= 2) return ['clear', 'a few clouds'];
  if (code === 3) return ['cloudy', 'overcast'];
  if (code === 45 || code === 48) return ['fog', 'fog'];
  if (code >= 51 && code <= 57) return ['rain', 'drizzle'];
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ['rain', 'rain'];
  if (code >= 71 && code <= 77) return ['cloudy', 'snow somewhere up high'];
  if (code >= 95) return ['storm', 'a thunderstorm'];
  return ['cloudy', 'clouds'];
};

(function sky() {
  const scene = $('#scene');
  if (!scene) return;
  const svg = $('.land', scene), top = $('.s-top', svg), hor = $('.s-hor', svg);
  const sun = $('.sun', svg), glow = $('.glow', svg), moon = $('.moon', svg), stars = $('.stars', svg), clouds = $('.clouds', svg);
  const ridges = ['.r0', '.r1', '.r2'].map((s) => $(s, svg));
  const timeEl = $('#now-time'), wxEl = $('#now-wx');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0F1013';
  let cloudCover = 0.25;

  // a fixed, seeded starfield so it doesn't reshuffle between visits
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', (rnd() * 1600).toFixed(1));
    c.setAttribute('cy', (rnd() * 250).toFixed(1));
    c.setAttribute('r', (0.6 + rnd() * 1.3).toFixed(2));
    c.setAttribute('opacity', (0.35 + rnd() * 0.65).toFixed(2));
    if (i % 3 === 0) { c.classList.add('tw'); c.style.animationDelay = `${(rnd() * -3).toFixed(2)}s`; }
    stars.append(c);
  }

  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

  function paint() {
    const now = new Date();
    const { alt, ha } = sunAt(now);
    const [t, h] = skyFor(alt);
    top.setAttribute('stop-color', t); hor.setAttribute('stop-color', h);
    scene.style.setProperty('--s-top', t); scene.style.setProperty('--s-hor', h);
    // hills fade from the horizon colour into the page, nearest darkest
    // at night the hills are moonlit blue instead of fading into black
    const base = alt < -6 ? mix(t, '#3E4A74', 0.45) : h;
    const ks = alt < -6 ? [0.18, 0.45, 0.7] : [0.5, 0.7, 0.86];
    ks.forEach((k, i) => ridges[i].setAttribute('fill', mix(base, bg, k)));
    const night = alt < -4;
    scene.classList.toggle('night', night);
    scene.classList.toggle('twilight', !night && alt < 7);
    // sun: across the sky with the hour angle, height with altitude
    const sx = 800 + clamp(ha / 100, -1.1, 1.1) * 680, sy = 300 - alt * 7;
    sun.setAttribute('cx', sx); sun.setAttribute('cy', sy); glow.setAttribute('cx', sx); glow.setAttribute('cy', Math.min(sy, 330));
    sun.style.opacity = alt > -3 ? 1 : 0;
    glow.setAttribute('opacity', (clamp(1 - Math.abs(alt) / 25, 0, 1) * 0.55 + (alt > 0 ? 0.08 : 0)).toFixed(2));
    $('#glowg stop', svg).setAttribute('stop-color', mix(h, '#FFE2B0', 0.5));
    moon.style.opacity = night ? 1 : 0;
    stars.style.opacity = clamp((-alt - 3) / 10, 0, 1) * (1 - cloudCover * 0.8);
    clouds.setAttribute('fill', night ? mix(t, '#8C98B8', 0.25) : mix(h, '#FFFFFF', 0.55));
    clouds.setAttribute('opacity', (0.15 + cloudCover * 0.75).toFixed(2));
    timeEl.textContent = time.format(now).toLowerCase();
  }

  async function weather() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${ITANAGAR.lat}&longitude=${ITANAGAR.lon}&current=temperature_2m,weather_code,cloud_cover&timezone=Asia%2FKolkata`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const { current } = await r.json();
      const [kind, words] = WX(current.weather_code);
      scene.dataset.wx = kind;
      cloudCover = clamp((current.cloud_cover ?? 30) / 100, 0, 1);
      wxEl.textContent = ` · ${Math.round(current.temperature_2m)}°, ${words}`;
      paint();
    } catch { wxEl.textContent = ''; }
  }

  paint();
  weather();
  setInterval(paint, 30000);
  setInterval(weather, 15 * 60000);
})();

// Hero: me on the Interceptor, riding the front ridge. Rides in on load;
// "Ride again" (or clicking the bike) sends it off and back.
(function rider() {
  const scene = $('#scene');
  if (!scene) return;
  const svg = $('.land', scene), road = $('#road', svg), bike = $('#rider', svg), btn = $('#ride-again');
  const L = road.getTotalLength();
  const W = 1600, H = 440;
  let s = 0, busy = false;

  function visible() {
    const r = svg.getBoundingClientRect();
    const k = Math.max(r.width / W, r.height / H);
    const vw = r.width / k;
    return [W / 2 - vw / 2, W / 2 + vw / 2];
  }
  function lengthAtX(x) {
    let lo = 0, hi = L;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (road.getPointAtLength(m).x < x) lo = m; else hi = m; }
    return lo;
  }
  function place(len) {
    s = len;
    const p = road.getPointAtLength(clamp(len, 0, L));
    const q = road.getPointAtLength(clamp(len + 8, 0, L));
    const a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
    bike.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(p.y + 1).toFixed(1)}) rotate(${a.toFixed(1)})`);
  }
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t;
  function go(from, to, ms, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / ms, 0, 1);
        place(from + (to - from) * fn(t));
        t < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  }
  const rest = () => { const [a, b] = visible(); return lengthAtX(a + (b - a) * 0.7); };

  async function arrive() {
    const [a] = visible();
    if (reduceMotion) { place(rest()); return; }
    await go(lengthAtX(a - 80), rest(), 3600, ease);
  }
  async function again() {
    if (busy) return;
    busy = true;
    const [a, b] = visible();
    if (!reduceMotion) {
      await go(s, lengthAtX(b + 90), 1100, easeIn);
      await go(lengthAtX(a - 80), rest(), 2600, ease);
    }
    busy = false;
  }
  place(lengthAtX(-200));
  arrive();
  btn.addEventListener('click', again);
  bike.addEventListener('click', again);
  let wait;
  addEventListener('resize', () => { clearTimeout(wait); wait = setTimeout(() => { if (!busy) place(rest()); }, 150); });
})();

// Story: a headlight rides down the road as you scroll; waypoints light up once passed.
(function roadLamp() {
  const list = $('#road-list');
  if (!list) return;
  const lamp = el('span', 'lamp'); lamp.setAttribute('aria-hidden', 'true');
  list.prepend(lamp);
  const stops = $$('li', list);
  let ticking = false;
  function update() {
    ticking = false;
    const r = list.getBoundingClientRect();
    const y = clamp(innerHeight * 0.55 - r.top, 0, r.height - 30);
    lamp.style.top = `${y + 6}px`;
    stops.forEach((li) => li.classList.toggle('passed', li.offsetTop + 10 <= y));
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// Engine sound for the rev counter, synthesised with Web Audio (no recordings).
// The Interceptor's parallel twin has a 270-degree crank, so each 720-degree cycle
// has two firing pulses 270 degrees apart: the uneven, V-twin-like burble.
function engineAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx, osc, lp, pipe, master, pop, noiseBuf, timer = 0, prev = 0;
  function build() {
    ctx = new AC();
    // sharp combustion pulses: slow harmonic roll-off gives the bark its edge
    const N = 160, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) {
      const a = 1 / (1 + (n / 26) ** 1.25);
      for (const p of [0, 270 / 720]) { re[n] += a * Math.cos(2 * Math.PI * n * p); im[n] -= a * Math.sin(2 * Math.PI * n * p); }
    }
    osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(re, im));
    osc.frequency.value = 8;
    // hard, slightly asymmetric clipping for grit
    const shaper = ctx.createWaveShaper(), curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; curve[i] = Math.tanh(4.2 * x + 0.35 * x * x); }
    shaper.curve = curve; shaper.oversample = '4x';
    // the exhaust pipe: a resonant low-mid boost that follows the revs
    pipe = ctx.createBiquadFilter(); pipe.type = 'peaking'; pipe.Q.value = 1.6; pipe.gain.value = 9; pipe.frequency.value = 180;
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4; lp.frequency.value = 700;
    // exhaust rasp: band-passed noise gated by the firing pulses
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.9;
    const gate = ctx.createGain(); gate.gain.value = 0;
    const depth = ctx.createGain(); depth.gain.value = 0.55;
    osc.connect(depth).connect(gate.gain);
    noise.connect(bp).connect(gate).connect(pipe);
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    osc.connect(shaper).connect(pipe).connect(lp).connect(master).connect(comp).connect(ctx.destination);
    // overrun pops: short noise cracks straight to the output
    pop = ctx.createGain(); pop.gain.value = 0;
    const popSrc = ctx.createBufferSource(); popSrc.buffer = noiseBuf; popSrc.loop = true;
    const popBp = ctx.createBiquadFilter(); popBp.type = 'bandpass'; popBp.frequency.value = 1400; popBp.Q.value = 1.2;
    popSrc.connect(popBp).connect(pop).connect(comp);
    osc.start(); noise.start(); popSrc.start();
  }
  function crack(t, strength) {
    pop.gain.cancelScheduledValues(t);
    pop.gain.setValueAtTime(strength, t);
    pop.gain.exponentialRampToValueAtTime(0.001, t + 0.035 + Math.random() * 0.03);
  }
  return {
    wake() { clearTimeout(timer); if (!ctx) build(); if (ctx.state === 'suspended') ctx.resume(); },
    set(rpm, level, load) {
      if (!ctx) return;
      const t = ctx.currentTime;
      osc.frequency.setTargetAtTime(Math.max(rpm, 60) / 120, t, 0.02);            // one 720-degree cycle
      lp.frequency.setTargetAtTime(650 + rpm * (load ? 0.75 : 0.5), t, 0.05);        // brighter under throttle
      pipe.frequency.setTargetAtTime(150 + rpm * 0.03, t, 0.08);
      master.gain.setTargetAtTime(level, t, 0.06);
      // closing the throttle from high revs: the twin crackles on the overrun
      if (!load && level > 0 && rpm > 2200 && rpm < prev && Math.random() < 0.09) crack(t, 0.25 + Math.random() * 0.35);
      prev = rpm;
    },
    sleep() { if (!ctx) return; master.gain.setTargetAtTime(0, ctx.currentTime, 0.15); clearTimeout(timer); timer = setTimeout(() => ctx.suspend(), 900); },
  };
}

// Off the clock: hold the button to rev the Interceptor. Redline at 7,000.
(function rev() {
  const panel = $('.moto');
  if (!panel) return;
  const svg = $('.gauge', panel), needle = $('.needle', svg), rpmEl = $('.rpm', svg), ticks = $('.ticks', svg);
  const btn = $('#throttle'), say = $('.say', panel);
  const MAX = 8000, SWEEP = 120, ns = 'http://www.w3.org/2000/svg';
  const pt = (deg, r) => [Math.sin(deg * Math.PI / 180) * r, -Math.cos(deg * Math.PI / 180) * r];
  const ang = (rpm) => -SWEEP + (2 * SWEEP * rpm) / MAX;
  const [sx, sy] = pt(-SWEEP, 100), [ex, ey] = pt(SWEEP, 100), [rx, ry] = pt(ang(7000), 100);
  $('.track', svg).setAttribute('d', `M${sx},${sy} A100,100 0 1 1 ${ex},${ey}`);
  $('.red', svg).setAttribute('d', `M${rx},${ry} A100,100 0 0 1 ${ex},${ey}`);
  for (let k = 0; k <= 16; k++) {
    const a = ang(k * 500), major = k % 2 === 0;
    const [x1, y1] = pt(a, 88), [x2, y2] = pt(a, major ? 76 : 82);
    const l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    if (major) {
      l.classList.add('major');
      const [tx, ty] = pt(a, 62);
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', tx); t.setAttribute('y', ty + 4.5); t.setAttribute('text-anchor', 'middle');
      t.textContent = k / 2;
      ticks.append(t);
    }
    ticks.append(l);
  }
  const audio = engineAudio(), snd = $('#snd');
  let soundOn = true;
  try { soundOn = localStorage.getItem('rev-sound') !== '0'; } catch {}
  let rpm = 0, held = false, last = 0, looping = false, peaked = false;
  // the needle rests at 0: holding revs it up, letting go lets it fall all the way back
  function frame(now) {
    const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0; last = now;
    const target = held ? MAX - 150 : 0;
    rpm += (target - rpm) * (held ? 1.15 : 1.5) * dt + (held ? (Math.random() - 0.5) * 60 : 0);
    rpm = clamp(rpm, 0, MAX);
    needle.setAttribute('transform', `rotate(${ang(rpm).toFixed(2)})`);
    rpmEl.textContent = rpm > 60 ? (rpm / 1000).toFixed(1) : 'off';
    panel.classList.toggle('shake', rpm > 5500);
    if (rpm > 7000 && !peaked) { peaked = true; say.textContent = 'Easy. No need to redline it.'; }
    if (rpm < 2500 && peaked) { peaked = false; say.textContent = 'That’s better. Nice and calm.'; }
    if (audio) audio.set(rpm, soundOn ? (0.16 + 0.26 * (rpm / MAX)) * Math.min(1, rpm / 900) : 0, held);
    if (held || rpm > 20) requestAnimationFrame(frame);
    else { looping = false; rpm = 0; rpmEl.textContent = 'off'; needle.setAttribute('transform', `rotate(${ang(0)})`); panel.classList.remove('shake'); if (audio) audio.sleep(); }
  }
  function kick() { if (!looping) { looping = true; last = 0; requestAnimationFrame(frame); } }
  function start(e) {
    e.preventDefault();
    if (audio && soundOn) audio.wake();
    held = true; btn.classList.add('on'); btn.textContent = 'Revving…'; kick();
  }
  function stop() { if (!held) return; held = false; btn.classList.remove('on'); btn.textContent = 'Hold to rev'; kick(); }
  function kill() { stop(); }
  btn.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) kill(); });
  function paintSound() {
    snd.setAttribute('aria-pressed', String(soundOn));
    $('span', snd).textContent = soundOn ? 'Sound on' : 'Sound off';
  }
  if (snd) {
    if (!audio) snd.hidden = true;
    paintSound();
    snd.addEventListener('click', () => {
      soundOn = !soundOn;
      try { localStorage.setItem('rev-sound', soundOn ? '1' : '0'); } catch {}
      if (soundOn && looping && audio) audio.wake();
      paintSound();
    });
  }
  needle.setAttribute('transform', `rotate(${ang(0)})`);
  rpmEl.textContent = 'off';
})();

// Off the clock: a 24-frame Blender turntable of the Interceptor. It only turns
// when someone drags it (or uses the arrow keys); frames load as the panel gets close.
(function turntable() {
  const box = $('#spin');
  if (!box) return;
  const img = $('img', box), N = 24;
  const src = (k) => `assets/interceptor/spin-${String(k).padStart(2, '0')}.webp`;
  let i = 0, loaded = false, drag = null;
  const cache = [];
  function load() { if (loaded) return; loaded = true; for (let k = 0; k < N; k++) { const im = new Image(); im.decoding = 'async'; im.src = src(k); cache.push(im); } }
  function show(k) { i = ((k % N) + N) % N; img.src = src(i); }
  function use() { load(); box.classList.add('used'); }
  new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); }, { rootMargin: '600px' }).observe(box);
  box.addEventListener('pointerdown', (e) => { use(); drag = { x: e.clientX, i }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => { if (drag) show(drag.i - Math.round((e.clientX - drag.x) / 16)); });
  ['pointerup', 'pointercancel'].forEach((ev) => box.addEventListener(ev, () => { drag = null; }));
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); use(); show(i + (e.key === 'ArrowRight' ? -1 : 1)); }
  });
})();

// Off the clock: keepy-uppy. Tap the ball before it hits the ground.
(function keepyUppy() {
  const pitch = $('#pitch');
  if (!pitch) return;
  const ball = $('#ball'), kc = $('#kc'), kb = $('#kb'), say = $('#kick-say');
  const R = 28, G = 2100;
  let best = 0;
  try { best = +localStorage.getItem('keepy-best') || 0; } catch {}
  kb.textContent = best;
  let x = 0, y = 0, vx = 0, vy = 0, spin = 0, count = 0, airborne = false, last = 0, raf = 0;
  const size = () => [pitch.clientWidth, pitch.clientHeight - 40];
  function rest() { const [w, h] = size(); x = w / 2 - R; y = h - 2 * R; draw(); }
  function draw() { ball.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${spin.toFixed(0)}deg)`; }
  function frame(now) {
    // rAF timestamps can predate the kick that started the loop; never step backwards
    const dt = last ? clamp((now - last) / 1000, 0, 0.033) : 0; last = now;
    const [w, h] = size();
    vy += G * dt; x += vx * dt; y += vy * dt; spin += vx * dt * 3;
    if (x < 0) { x = 0; vx = Math.abs(vx) * 0.7; }
    if (x > w - 2 * R) { x = w - 2 * R; vx = -Math.abs(vx) * 0.7; }
    if (y < 44) { y = 44; vy = Math.abs(vy) * 0.3; }
    if (y >= h - 2 * R && vy >= 0) {   // only a falling ball lands; a fresh kick is still on the grass
      y = h - 2 * R;
      if (airborne) {
        airborne = false;
        if (count > 0) say.textContent = count >= best && count > 1 ? `New best: ${count}. Not bad.` : `Dropped it at ${count}. Go again.`;
        count = 0; kc.textContent = 0; say.classList.remove('cheer');
      }
      vy = -vy * 0.35; vx *= 0.8;
      if (Math.abs(vy) < 60) { vy = 0; if (Math.abs(vx) < 8) { draw(); raf = 0; return; } }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  ball.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = ball.getBoundingClientRect();
    const off = e.clientX ? (e.clientX - (r.left + r.width / 2)) / R : (Math.random() - 0.5) * 0.6;
    kick(off);
  });
  ball.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); kick((Math.random() - 0.5) * 0.6); } });
  function kick(off) {
    vy = -(820 + Math.random() * 140);
    vx = vx * 0.4 - off * 260 + (Math.random() - 0.5) * 120;
    airborne = true; count++;
    kc.textContent = count;
    if (count > best) { best = count; kb.textContent = best; try { localStorage.setItem('keepy-best', best); } catch {} }
    if (count === 10) { say.textContent = 'Visca el Barça!'; say.classList.add('cheer'); }
    else if (count < 10) say.textContent = count === 1 ? 'Keep it up…' : '';
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  }
  rest();
  let wait;
  addEventListener('resize', () => { clearTimeout(wait); wait = setTimeout(() => { if (!raf) rest(); }, 150); });
})();

// a. Voice interview: plays a scripted conversation; "Drop" simulates a reconnect.
(function voice() {
  const root = $('#voice');
  if (!root) return;
  const wave = $('.wave', root), tr = $('.tr', root), net = $('.net', root);
  const q = $('.live', root), timer = $('.timer', root);
  const playBtn = $('[data-act="play"]', root), dropBtn = $('[data-act="drop"]', root);
  const script = [
    ['ai', 'What made you switch tools last quarter?'],
    ['p', 'Mostly the export limits. We hit them every sprint, so…'],
    ['ai', 'Walk me through the last time that happened.'],
    ['p', 'End of sprint review. The CSV cut off at 5,000 rows.'],
    ['ai', 'What did you do with the rows that got cut?'],
    ['p', 'Copied them over by hand. Took most of an afternoon.'],
    ['ai', 'Thanks, that helps. Moving on to question 4.'],
  ];
  const bars = Array.from({ length: 44 }, () => wave.appendChild(el('i')));
  const peaks = bars.map((_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45)));

  let state = 'idle', idx = 0, token = 0, speaking = false, secs = 4 * 60 + 12, userPaused = false;

  function addLine(who, text) {
    $$('.ln', tr).slice(0, -1).forEach((n) => n.classList.add('old'));
    const ln = el('div', `ln ${who}`);
    if (who === 'sys') ln.textContent = text;
    else { ln.append(el('b', '', who === 'ai' ? 'AI interviewer' : 'Participant'), el('span', '', text)); }
    tr.append(ln);
    while (tr.children.length > 4) tr.firstChild.remove();
    return ln;
  }
  script.slice(0, 3).forEach(([w, t]) => addLine(w, t));
  idx = 3;

  function setState(s) {
    state = s; root.dataset.state = s;
    playBtn.setAttribute('aria-pressed', String(s === 'playing'));
    $('span', playBtn).textContent = s === 'playing' ? 'Pause' : 'Play';
  }

  async function say(who, text, t) {
    root.dataset.speaker = who;
    const span = $('span', addLine(who, ''));
    span.classList.add('typing');
    speaking = true;
    for (let i = reduceMotion ? text.length : 1; i <= text.length; i++) {
      if (t !== token) { span.textContent = text; break; }
      span.textContent = text.slice(0, i);
      await sleep(26);
    }
    span.classList.remove('typing');
    speaking = false;
  }

  async function loop(t) {
    while (t === token && state === 'playing') {
      if (idx >= script.length) {
        idx = 0; tr.replaceChildren(); q.textContent = 'Interview · Q3 of 8';
      }
      const [who, text] = script[idx];
      await say(who, text, t);
      idx++;
      if (idx === script.length) q.textContent = 'Interview · Q4 of 8';
      if (t !== token) return;
      await sleep(900);
    }
  }

  function play() { if (state === 'playing') return; setState('playing'); loop(++token); }
  function pause() { token++; speaking = false; setState('idle'); }

  // waveform + timer tick
  setInterval(() => {
    bars.forEach((b, i) => {
      const on = state === 'playing' && speaking;
      b.style.transform = `scaleY(${on ? (0.15 + Math.random() * peaks[i]).toFixed(2) : 0.08})`;
    });
  }, reduceMotion ? 1e9 : 110);
  setInterval(() => {
    if (state !== 'playing') return;
    secs++;
    timer.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }, 1000);

  playBtn.addEventListener('click', () => {
    if (state === 'playing') { userPaused = true; pause(); } else { userPaused = false; play(); }
  });
  dropBtn.addEventListener('click', async () => {
    dropBtn.disabled = true;
    const wasPlaying = state === 'playing' || !userPaused;
    token++; speaking = false; setState('drop');
    addLine('sys', 'participant disconnected · session held open');
    net.textContent = 'reconnecting…';
    await sleep(1800);
    addLine('sys', 'participant reconnected · 0:03 gap · resuming');
    net.textContent = 'connected · 41 ms';
    setState('idle');
    dropBtn.disabled = false;
    await sleep(600);
    if (wasPlaying) { userPaused = false; play(); }
  });

  if (!reduceMotion) watch(root, { enter: () => { if (!userPaused) play(); }, leave: () => { if (state === 'playing') pause(); } });
})();

// b. Study-builder agent: replays a run; each call waits for the one it reads from.
(function agent() {
  const root = $('#agent');
  if (!root) return;
  const btn = $('[data-act="run"]', root), tot = $('.tot', root), run = $('.run', root);
  const nodes = $$('.node', root), edges = $$('.edge', root);
  const labels = nodes.map((n) => $('small', n).textContent);
  const times = [0.3, 0.4, 0.6, 0.35, 0.25];
  let busy = false;

  async function go() {
    if (busy) return;
    busy = true; btn.disabled = true; btn.textContent = 'Running…';
    run.textContent = String(+run.textContent + 1);
    nodes.forEach((n, i) => { n.className = 'node'; $('small', n).textContent = i === nodes.length - 1 ? 'waiting' : labels[i]; });
    edges.forEach((e) => e.classList.remove('on'));
    let elapsed = 0;
    tot.textContent = '0.0s';
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].classList.add('run');
      const start = elapsed;
      const steps = 6;
      for (let s = 1; s <= steps; s++) {
        await sleep((times[i] * 1000) / steps);
        tot.textContent = `${(start + (times[i] * s) / steps).toFixed(1)}s`;
      }
      elapsed += times[i];
      nodes[i].classList.replace('run', 'done');
      $('small', nodes[i]).textContent = i === nodes.length - 1 ? `ok · ${elapsed.toFixed(1)}s` : `${labels[i]} · ${times[i]}s`;
      if (edges[i]) { edges[i].classList.add('on'); await sleep(120); }
    }
    busy = false; btn.disabled = false; btn.textContent = 'Run it again';
  }
  btn.addEventListener('click', go);
  if (!reduceMotion) watch(root, { once: () => setTimeout(go, 300) });
})();

// c. Cost chart: scrub (pointer or arrow keys) to read what happened each month;
// toggle the counterfactual. The curve is illustrative, so the scrubber narrates events, not numbers.
(function cost() {
  const root = $('#cost');
  if (!root) return;
  const plot = $('.plot', root), svg = $('svg', root), line = $('.l', root);
  const scrub = $('.scrub', root), dot = $('.dot', root), what = $('.what', root), read = $('.read', root);
  const nums = line.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
  const pts = []; for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const events = [
    'baseline', 'baseline', 'baseline', 'judge evals added',
    'cache hits falling', 'spike', 'spike', 'audit: sampling + model choice',
    'fix rolling out', 'below baseline', 'below baseline', 'after the audit',
  ];
  let cur = pts.length - 1;

  function show(i) {
    cur = Math.max(0, Math.min(pts.length - 1, i));
    const [x, y] = pts[cur];
    scrub.setAttribute('x1', x); scrub.setAttribute('x2', x);
    dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    root.classList.add('scrubbing');
    what.textContent = events[cur];
    read.textContent = `month ${cur + 1} of 12`;
  }
  function reset() {
    root.classList.remove('scrubbing');
    what.textContent = 'after the audit';
    read.textContent = 'hover the line';
  }
  function fromPointer(e) {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 300;
    let best = 0;
    pts.forEach(([px], i) => { if (Math.abs(px - x) < Math.abs(pts[best][0] - x)) best = i; });
    show(best);
  }
  plot.tabIndex = 0;
  plot.setAttribute('aria-label', 'Spend chart. Use the left and right arrow keys to step through the months.');
  plot.addEventListener('pointermove', fromPointer);
  plot.addEventListener('pointerdown', fromPointer);
  plot.addEventListener('pointerleave', reset);
  plot.addEventListener('blur', reset);
  plot.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      show(root.classList.contains('scrubbing') ? cur + (e.key === 'ArrowRight' ? 1 : -1) : pts.length - 1);
    }
  });
  $('#ghost').addEventListener('change', (e) => root.classList.toggle('ghosted', e.target.checked));
})();

// d. Migration: ship the release one repository at a time.
(function migration() {
  const root = $('#mig');
  if (!root) return;
  const btn = $('[data-act="ship"]', root), st = $('.st', root), repos = $$('.repo', root);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    root.dataset.state = 'deploying';
    repos.forEach((r) => r.classList.remove('ok', 'run'));
    for (let i = 0; i < repos.length; i++) {
      st.textContent = `deploying ${i}/4`;
      repos[i].classList.add('run');
      await sleep(520);
      repos[i].classList.replace('run', 'ok');
    }
    st.textContent = 'shipped';
    root.dataset.state = 'shipped';
    btn.disabled = false;
  });
})();

// e. Public API: send the request, then watch the webhook fire.
(function api() {
  const root = $('#api');
  if (!root) return;
  const btn = $('[data-act="send"]', root), resp = $('.resp', root), ev = $('.code-ev', root), key = $('.key', root);
  const st = $('.code-st', resp), body = $('.body', resp);
  let n = 0x8c1f;
  key.addEventListener('click', () => {
    const shown = key.textContent !== 'cx_live_••••';
    key.textContent = shown ? 'cx_live_••••' : 'cx_live_nice_try';
    key.setAttribute('aria-label', shown ? 'Reveal the demo API key' : 'Hide the demo API key');
  });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    resp.classList.remove('ok'); ev.className = 'code-ev';
    st.textContent = '…'; body.textContent = 'sending';
    ev.textContent = 'idle';
    await sleep(450);
    resp.classList.add('ok');
    st.textContent = '201';
    body.textContent = `{ "id": "std_${(n++).toString(16)}", "status": "live" }`;
    ev.textContent = 'queued'; ev.classList.add('wait');
    await sleep(1100);
    ev.className = 'code-ev fired'; ev.textContent = '200';
    btn.disabled = false; btn.textContent = 'Send another';
  });
})();

// f. Billing: click a role to switch Editor ↔ Observer; observers are not billed.
(function billing() {
  const root = $('#bill');
  if (!root) return;
  const billed = $('.billed', root), tog = $('.tog', root);
  function count() {
    const n = 1 + $$('button.role', root).filter((b) => b.dataset.role === 'Editor').length;
    billed.textContent = `${n} billed`;
    billed.classList.add('bump');
    setTimeout(() => billed.classList.remove('bump'), 500);
  }
  $$('button.role', root).forEach((b) => {
    b.setAttribute('aria-label', `Role: ${b.dataset.role}. Click to change.`);
    b.addEventListener('click', () => {
      const next = b.dataset.role === 'Editor' ? 'Observer' : 'Editor';
      b.dataset.role = next;
      b.textContent = next === 'Observer' ? 'Observer · not billed' : 'Editor';
      b.classList.toggle('x', next === 'Observer');
      b.setAttribute('aria-label', `Role: ${next}. Click to change.`);
      count();
    });
  });
  tog.addEventListener('click', () => {
    const on = tog.getAttribute('aria-checked') !== 'true';
    tog.setAttribute('aria-checked', String(on));
    $('span', tog).textContent = on ? 'Autocharge on' : 'Autocharge off';
  });
})();

// g. Search: a tiny fake index with scoring, location weighting and exclusion filters.
(function search() {
  const root = $('#search');
  if (!root) return;
  const input = $('input', root), out = $('.results', root), took = $('.took', root);
  const people = [
    { t: 'Senior PM · N26 · Berlin', k: 'product fintech banking', senior: 1, near: 1, past: 0 },
    { t: 'Product lead · Trade Republic · Berlin', k: 'product fintech investing', senior: 1, near: 1, past: 1 },
    { t: 'Principal PM · Raisin · Berlin', k: 'product fintech savings', senior: 1, near: 1, past: 0 },
    { t: 'PM · Solaris · remote (DE)', k: 'product fintech banking api', senior: 0, near: 0.7, past: 0 },
    { t: 'Senior PM · Zalando · Berlin', k: 'product ecommerce retail', senior: 1, near: 1, past: 0 },
    { t: 'UX researcher · Klarna · Berlin', k: 'research design fintech payments', senior: 0, near: 1, past: 0 },
    { t: 'Head of product · Monzo · London', k: 'product fintech banking', senior: 1, near: 0, past: 0 },
    { t: 'Staff designer · Revolut · London', k: 'design fintech', senior: 1, near: 0, past: 1 },
    { t: 'Growth PM · Qonto · Paris', k: 'product fintech growth', senior: 0, near: 0, past: 0 },
    { t: 'Engineering manager · Wise · Tallinn', k: 'engineering fintech payments', senior: 1, near: 0, past: 0 },
  ];
  const f = { senior: true, berlin: true, exclude: false };

  function highlight(text, terms) {
    const frag = document.createDocumentFragment();
    const re = terms.length ? new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig') : null;
    (re ? text.split(re) : [text]).forEach((part, i) => frag.append(i % 2 ? el('mark', '', part) : part));
    return frag;
  }

  function render() {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = people
      .filter((p) => (!f.senior || p.senior) && (!f.berlin || p.near > 0.5) && (!f.exclude || !p.past))
      .map((p) => {
        const hay = `${p.t} ${p.k}`.toLowerCase();
        const matched = terms.filter((t) => hay.includes(t)).length;
        const m = terms.length ? matched / terms.length : 1;
        return { p, m, score: 0.58 * m + 0.26 * p.near + 0.12 * p.senior + (p.t.length % 7) / 150 };
      })
      .filter((h) => h.m > 0)
      .sort((a, b) => b.score - a.score);
    took.textContent = `${hits.length} hit${hits.length === 1 ? '' : 's'} · ${2 + (input.value.length % 5)} ms`;
    out.replaceChildren();
    if (!hits.length) { out.append(el('div', 'empty', 'No participants match. Remove a filter or a word.')); return; }
    hits.slice(0, 3).forEach(({ p, score }) => {
      const row = el('div', 'res');
      const name = el('span'); name.append(highlight(p.t, terms.filter((t) => t.length > 1)));
      row.append(name, el('span', 'sc', Math.min(score, 0.99).toFixed(2)));
      out.append(row);
    });
  }
  input.addEventListener('input', render);
  $$('.filt .chip', root).forEach((c) => c.addEventListener('click', () => {
    f[c.dataset.f] = !f[c.dataset.f];
    c.classList.toggle('on', f[c.dataset.f]);
    c.setAttribute('aria-pressed', String(f[c.dataset.f]));
    render();
  }));
  render();
})();

// h. Research methods: accessible tabs.
(function research() {
  const root = $('#research');
  if (!root) return;
  const tabs = $$('[role="tab"]', root);
  function select(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });
})();

// m. Invite delivery: the old job stops at 1,000; the new one drains the queue.
(function deliver() {
  const root = $('#deliver');
  if (!root) return;
  const bar = $('.bar i', root), n = $('.n', root), st = $('.hd .st', root), log = $('.log', root);
  const btns = $$('.ctl .tbtn', root), cells = $$('.cells i', root);
  const total = 1343, batch = 200;
  let busy = false;

  async function go(mode) {
    if (busy) return;
    busy = true; btns.forEach((b) => { b.disabled = true; b.classList.toggle('on', b.dataset.act === mode); });
    root.dataset.mode = mode; root.classList.remove('done', 'stuck');
    let sent = 0, k = 0;
    const cap = mode === 'old' ? 1000 : total;
    bar.style.setProperty('--w', '0%'); n.textContent = '0'; st.textContent = 'sending';
    cells.forEach((c) => { c.className = ''; });
    await sleep(250);
    while (sent < cap) {
      const size = Math.min(batch, cap - sent);
      sent += size; k++;
      bar.style.setProperty('--w', `${(sent / total) * 100}%`);
      n.textContent = sent.toLocaleString('en-US');
      log.textContent = `batch ${k} · ${size} sent`;
      cells[k - 1].className = 'sent';
      await sleep(330);
    }
    if (mode === 'old') {
      root.classList.add('stuck');
      cells.slice(k).forEach((c) => { c.className = 'lost'; });
      st.textContent = 'stopped';
      log.textContent = `hit the 1,000 cap · ${total - sent} stranded, never resumed`;
    } else {
      root.classList.add('done');
      st.textContent = 'drained';
      log.textContent = `${k} batches · 0 stranded · sweep idle`;
    }
    busy = false; btns.forEach((b) => { b.disabled = false; });
  }
  btns.forEach((b) => b.addEventListener('click', () => go(b.dataset.act)));
  if (!reduceMotion) watch(root, { once: () => setTimeout(() => go('new'), 250) });
})();

// i. Codebase Archaeology: ask a question, get a cited answer (or an honest abstain).
(function archaeology() {
  const root = $('#arch');
  if (!root) return;
  const thread = $('.thread', root), asks = $$('.asks .chip', root);
  const answers = [
    { a: 'Added after a Postmark outage caused duplicate sends. Backoff is capped at five tries because the queue re-enqueues on failure.', c: 'cited: commit 7fd44e2 · PR #212 comment' },
    { a: 'Version 0.33 broke AVIF thumbnails on the ARM Lambda runtime. It stays pinned until the upstream fix ships.', c: 'cited: commit a91c3d0 · issue #147' },
    { a: 'Not enough evidence to say. The last three commits touching it have no linked PR or issue, so I won’t guess.', c: 'abstained · 3 weak sources', abstain: true },
  ];
  asks.forEach((b) => b.addEventListener('click', async () => {
    asks.forEach((x) => { x.disabled = true; });
    const { a, c, abstain } = answers[+b.dataset.q];
    thread.append(el('div', 'bub q', b.textContent));
    const think = el('div', 'bub a thinking', 'searching history');
    thread.append(think);
    while (thread.children.length > 4) thread.firstChild.remove();
    await sleep(850);
    think.className = `bub a${abstain ? ' abstain' : ''}`;
    think.textContent = a;
    think.append(el('span', 'cite', c));
    asks.forEach((x) => { x.disabled = false; });
  }));
})();

// Live Itanagar clock in the contact block.
(function clock() {
  const t = document.getElementById('clock');
  const dl = document.getElementById('dateline');
  if (!t || !dl) return;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric' });
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const part = (h) => (h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night');
  function tick() {
    const now = new Date();
    t.textContent = time.format(now);
    dl.textContent = `${date.format(now)} · ${part(+hour.format(now))} in Itanagar`;
  }
  tick();
  setInterval(tick, 1000);
})();

// "Copy email address": copies, confirms inline, falls back to mailto.
(function copyEmail() {
  const btn = document.getElementById('copy-email');
  if (!btn) return;
  const email = btn.dataset.email;
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      btn.textContent = 'Copied';
      btn.dataset.copied = 'true';
      setTimeout(() => { btn.textContent = label; delete btn.dataset.copied; }, 1600);
    } catch {
      window.location.href = 'mailto:' + email;
    }
  });
})();

// Footer year.
(function footerYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());
})();
