const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const THEME = { Goa: ['🏖️', '#ff9a8b,#ff6a88'], Manali: ['🏔️', '#74ebd5,#4facfe'], Bali: ['🌴', '#43e97b,#38b6a8'], Dubai: ['🏜️', '#f6d365,#fda085'] };
let packages = [];
let token = null;
let user = null;
let mode = 'login';

try { token = localStorage.getItem('token'); user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { token = null; user = null; }

function toast(msg, bad) {
  const t = $('toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  setTimeout(() => { t.className = ''; }, 3000);
}

function saveSession(t, u) {
  token = t; user = u;
  try {
    if (t) { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }
    else { localStorage.removeItem('token'); localStorage.removeItem('user'); }
  } catch (e) { /* storage blocked: session lasts until page reload */ }
  renderAuth();
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch('/api/' + path, { ...opts, headers });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { saveSession(null, null); toast('Session expired, please log in again', true); }
  return { ok: r.ok, status: r.status, data };
}

function renderAuth() {
  const box = $('auth'); box.replaceChildren();
  if (user) {
    const my = el('a', 'navlink', 'My bookings'); my.href = '#bookings-h';
    const out = el('button', 'light', 'Logout');
    out.addEventListener('click', () => { saveSession(null, null); toast('Logged out'); load(); });
    box.append(el('span', 'hi', 'Hi, ' + user.name.split(' ')[0]), my, out);
  } else {
    const li = el('button', 'light', 'Login'), su = el('button', 'solid', 'Sign up');
    li.addEventListener('click', () => openModal('login'));
    su.addEventListener('click', () => openModal('register'));
    box.append(li, su);
  }
  $('book').textContent = user ? 'Book now' : 'Login to book';
  $('book-note').textContent = user ? `Booking as ${user.name} (${user.email})` : 'Please log in to complete a booking.';
  $('mybk').style.display = user ? '' : 'none';
}

function setMode(m) {
  mode = m;
  const reg = m === 'register';
  $('m-title').textContent = reg ? 'Create your account' : 'Welcome back';
  $('f-name-wrap').style.display = reg ? '' : 'none';
  $('f-pass').autocomplete = reg ? 'new-password' : 'current-password';
  $('auth-submit').textContent = reg ? 'Sign up' : 'Login';
  $('m-switch-text').textContent = reg ? 'Already have an account?' : 'New here?';
  $('m-switch').textContent = reg ? 'Login' : 'Create an account';
  $('err').textContent = '';
}
function openModal(m) { setMode(m); $('modal').classList.add('open'); (m === 'register' ? $('f-name') : $('f-email')).focus(); }
function closeModal() { $('modal').classList.remove('open'); $('f-pass').value = ''; $('err').textContent = ''; }

function updateTotal() {
  const p = packages.find((x) => x.id === Number($('pkg').value));
  $('total').textContent = p ? inr(p.price * (Number($('trav').value) || 0)) : '₹0';
}

async function load() {
  const [info, dest, pk, stats] = await Promise.all(['info', 'destinations', 'packages', 'stats'].map((p) => api(p).then((r) => r.data)));
  packages = pk;
  $('info').textContent = `v${info.version} | ${info.color} | ${info.pod}`;
  $('s1').textContent = dest.length; $('s2').textContent = pk.length; $('s3').textContent = stats.bookings;
  const dn = Object.fromEntries(dest.map((d) => [d.id, d.name]));

  $('packages').replaceChildren(...pk.map((p) => {
    const name = dn[p.destinationId], th = THEME[name] || ['🌍', '#a18cd1,#fbc2eb'];
    const c = el('div', 'card pk'), b = el('div', 'banner', th[0]);
    b.style.background = `linear-gradient(135deg,${th[1]})`;
    const body = el('div', 'body'), chips = el('div', 'chips');
    chips.append(el('span', 'chip', '📍 ' + name), el('span', 'chip', '🗓️ ' + p.days + ' days'));
    const row = el('div', 'row'), btn = el('button', '', 'Book this');
    btn.addEventListener('click', () => { $('pkg').value = p.id; updateTotal(); $('book-h').scrollIntoView({ behavior: 'smooth' }); $('trav').focus(); });
    row.append(el('span', 'price', inr(p.price)), btn);
    body.append(el('h3', '', p.title), chips, row); c.append(b, body); return c;
  }));

  const cur = $('pkg').value;
  $('pkg').replaceChildren(...pk.map((p) => { const o = el('option', '', `${p.title} (${inr(p.price)})`); o.value = p.id; return o; }));
  if (cur) $('pkg').value = cur;
  updateTotal();

  if (!user) return;
  const res = await api('bookings');
  const bk = res.ok && Array.isArray(res.data) ? res.data : [];
  if (!bk.length) { $('bookings').replaceChildren(el('div', 'empty', 'No bookings yet. Pick a package above! 🌴')); return; }
  $('bookings').replaceChildren(...bk.slice().reverse().map((b) => {
    const c = el('div', 'card'), body = el('div', 'body'), row = el('div', 'row');
    row.append(el('b', '', `#${b.id} ${b.packageTitle}`), el('span', 'status ' + b.status, b.status));
    const meta = el('p', 'chip', `${b.travelers} traveler(s) · ${inr(b.totalPrice)}`);
    body.append(row, meta);
    if (b.status === 'CONFIRMED') {
      const x = el('button', 'ghost', 'Cancel booking');
      x.addEventListener('click', async () => {
        const r = await api('bookings/' + b.id, { method: 'DELETE' });
        if (r.ok) toast('Booking #' + b.id + ' cancelled', true);
        load();
      });
      body.append(x);
    }
    c.append(body); return c;
  }));
}

// ---- events ----
$('pkg').addEventListener('change', updateTotal);
$('trav').addEventListener('input', updateTotal);

$('book').addEventListener('click', async () => {
  if (!user) { openModal('login'); return; }
  const r = await api('bookings', { method: 'POST', body: JSON.stringify({ packageId: Number($('pkg').value), travelers: Number($('trav').value) }) });
  if (r.ok) { toast(`Booking #${r.data.id} confirmed! 🎉`); $('trav').value = 1; } else if (r.status !== 401) toast(r.data.error || 'Booking failed', true);
  load();
});

$('auth-submit').addEventListener('click', async () => {
  const body = { email: $('f-email').value, password: $('f-pass').value };
  if (mode === 'register') body.name = $('f-name').value;
  const r = await api('auth/' + mode, { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) { $('err').textContent = r.data.error || 'Something went wrong'; return; }
  saveSession(r.data.token, r.data.user);
  closeModal();
  toast(mode === 'register' ? 'Account created. Welcome, ' + r.data.user.name + '! 🎉' : 'Welcome back, ' + r.data.user.name + '!');
  load();
});
$('m-switch').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && $('modal').classList.contains('open')) $('auth-submit').click();
});

renderAuth();
load();