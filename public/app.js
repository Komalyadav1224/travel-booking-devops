const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const THEME = { Goa: ['🏖️', '#ff9a8b,#ff6a88'], Manali: ['🏔️', '#74ebd5,#4facfe'], Bali: ['🌴', '#43e97b,#38b6a8'], Dubai: ['🏜️', '#f6d365,#fda085'] };
let packages = [];

function toast(msg, bad) {
  const t = $('toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  setTimeout(() => { t.className = ''; }, 3000);
}
function updateTotal() {
  const p = packages.find((x) => x.id === Number($('pkg').value));
  $('total').textContent = p ? inr(p.price * (Number($('trav').value) || 0)) : '₹0';
}
async function load() {
  const [info, dest, pk, bk] = await Promise.all(['info', 'destinations', 'packages', 'bookings'].map((p) => fetch('/api/' + p).then((r) => r.json())));
  packages = pk;
  $('info').textContent = `v${info.version} | ${info.color} | ${info.pod}`;
  $('s1').textContent = dest.length; $('s2').textContent = pk.length; $('s3').textContent = bk.length;
  const dn = Object.fromEntries(dest.map((d) => [d.id, d.name]));

  $('packages').replaceChildren(...pk.map((p) => {
    const name = dn[p.destinationId], th = THEME[name] || ['🌍', '#a18cd1,#fbc2eb'];
    const c = el('div', 'card pk'), b = el('div', 'banner', th[0]);
    b.style.background = `linear-gradient(135deg,${th[1]})`;
    const body = el('div', 'body'), chips = el('div', 'chips');
    chips.append(el('span', 'chip', '📍 ' + name), el('span', 'chip', '🗓️ ' + p.days + ' days'));
    const row = el('div', 'row'), btn = el('button', '', 'Book this');
    btn.addEventListener('click', () => { $('pkg').value = p.id; updateTotal(); $('book-h').scrollIntoView({ behavior: 'smooth' }); $('name').focus(); });
    row.append(el('span', 'price', inr(p.price)), btn);
    body.append(el('h3', '', p.title), chips, row); c.append(b, body); return c;
  }));

  const cur = $('pkg').value;
  $('pkg').replaceChildren(...pk.map((p) => { const o = el('option', '', `${p.title} (${inr(p.price)})`); o.value = p.id; return o; }));
  if (cur) $('pkg').value = cur;
  updateTotal();

  if (!bk.length) { $('bookings').replaceChildren(el('div', 'empty', 'No bookings yet. Pick a package above! 🌴')); return; }
  $('bookings').replaceChildren(...bk.slice().reverse().map((b) => {
    const c = el('div', 'card'), body = el('div', 'body'), row = el('div', 'row');
    row.append(el('b', '', `#${b.id} ${b.packageTitle}`), el('span', 'status ' + b.status, b.status));
    const meta = el('p', 'chip', `${b.name} · ${b.travelers} traveler(s) · ${inr(b.totalPrice)}`);
    body.append(row, meta);
    if (b.status === 'CONFIRMED') {
      const x = el('button', 'ghost', 'Cancel booking');
      x.addEventListener('click', async () => { await fetch('/api/bookings/' + b.id, { method: 'DELETE' }); toast('Booking #' + b.id + ' cancelled', true); load(); });
      body.append(x);
    }
    c.append(body); return c;
  }));
}

$('pkg').addEventListener('change', updateTotal);
$('trav').addEventListener('input', updateTotal);
$('book').addEventListener('click', async () => {
  const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId: Number($('pkg').value), name: $('name').value, email: $('email').value, travelers: Number($('trav').value) }) });
  const d = await r.json();
  if (r.ok) { toast(`Booking #${d.id} confirmed! 🎉`); $('name').value = ''; $('email').value = ''; $('trav').value = 1; } else toast(d.error, true);
  load();
});
load();