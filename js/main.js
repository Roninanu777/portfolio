// Every window in the bento is a small working sketch. Each block below
// wires up one card and bails out quietly if its markup is missing.

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

// Card glow follows the pointer.
(function spotlight() {
  if (!matchMedia('(pointer: fine)').matches) return;
  $$('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
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
