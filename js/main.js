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
