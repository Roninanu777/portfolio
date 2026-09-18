// Live IST clock for the "Where I work" card.
(function clock() {
  const el = document.getElementById('clock');
  const dl = document.getElementById('dateline');
  if (!el || !dl) return;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric' });
  function tick() {
    const now = new Date();
    el.textContent = time.format(now);
    dl.textContent = date.format(now) + ' · UTC+5:30';
  }
  tick();
  setInterval(tick, 1000);
})();

// Year-progress dot grid for the wallpaper card.
(function yearDots() {
  const box = document.getElementById('ydots');
  const pctEl = document.getElementById('ypct');
  if (!box || !pctEl) return;
  const now = new Date();
  const y = now.getFullYear();
  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);
  const pct = (now - start) / (end - start);
  const total = 14 * 13;
  const done = Math.round(total * pct);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < total; i++) {
    const d = document.createElement('i');
    if (i < done) d.className = 'on';
    frag.appendChild(d);
  }
  box.appendChild(frag);
  pctEl.innerHTML = Math.round(pct * 100) + '%<small>of ' + y + '</small>';
})();

// "Copy email" button: copies the address, confirms inline, falls back to mailto.
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
