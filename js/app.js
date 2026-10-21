(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const view = $('#view'), nav = $('#nav');
const PAGES = ['home', 'about', 'products', 'contact'];
let SITE = {}, APPS = [], open = true, cur = 'home', q = '', plat = 'all';

// ---------- data ----------
async function load() {
  try {
    const get = u => fetch(u, {cache: 'no-store'}).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    const [s, a] = await Promise.all([get('data/site.json'), get('data/apps.json')]);
    SITE = s;
    SITE._updated = a.updated || '';
    APPS = (a.apps || []).map(x => ({...x, id: String(x.id).replace(/[^a-z0-9_-]/gi, '-')}));
    boot();
  } catch (e) {
    view.innerHTML = '<h1>OFFLINE</h1><p>Could not load the site data (' + esc(e.message) + '). If you opened index.html directly, run <span class="hl">python -m http.server</span> in this folder and visit <span class="hl">http://localhost:8000</span>.</p>';
  }
}

// ---------- nav tree ----------
function items() {
  const l = [{id:'home', label:'home', pre:'├ '}, {id:'about', label:'about us', pre:'├ '}, {id:'products', label:'products', pre:'├ ', fold:1}];
  if (open) APPS.forEach((a, i) => l.push({id:'app-' + a.id, label:String(a.name).toLowerCase(), pre: i === APPS.length - 1 ? '│  └ ' : '│  ├ '}));
  l.push({id:'contact', label:'contact info', pre:'└ '});
  return l;
}
function draw() {
  nav.innerHTML = '';
  items().forEach(n => {
    const b = document.createElement('button');
    b.className = 'n' + (n.id === cur ? ' on' : ''); b.dataset.id = n.id;
    const pre = document.createElement('span'); pre.className = 'tr'; pre.textContent = n.pre; b.appendChild(pre);
    if (n.fold) {
      const f = document.createElement('span'); f.className = 'tr fold'; f.title = 'collapse / expand'; f.textContent = open ? '▾ ' : '▸ ';
      f.onclick = ev => { ev.stopPropagation(); open = !open; draw(); };
      b.appendChild(f);
    }
    const t = document.createElement('span'); t.className = 't'; t.textContent = n.label; b.appendChild(t);
    b.onclick = () => go(n.id);
    nav.appendChild(b);
  });
}

// ---------- helpers ----------
function imgEl(a, cls) {
  const w = document.createElement('div'); w.className = cls;
  const ph = () => { w.textContent = String(a.name || '?').slice(0, 2).toUpperCase(); };
  if (!a.image) { ph(); return w; }
  const im = new Image(); im.alt = a.name || ''; im.loading = 'lazy';
  im.onerror = () => { w.innerHTML = ''; ph(); };
  im.src = a.image; w.appendChild(im);
  return w;
}
function setView(html) { view.innerHTML = html; view.classList.remove('in'); void view.offsetWidth; view.classList.add('in'); }
const safeUrl = u => /^https?:\/\//.test(u);

// ---------- views ----------
const VIEWS = {
  home() {
    const a = APPS[0];
    setView('<h1>' + esc(SITE.headline || '').replace(/\n/g, '<br>') + '</h1><p>' + esc(SITE.intro) + '</p><p class="dim">Use the tree on the left, or the arrow keys.</p>' +
      (a ? '<div class="card link" data-go="app-' + a.id + '"><span class="tag">latest</span><b>' + esc(a.name) + '</b><br><small>' + esc(a.tagline) + '</small></div>' : ''));
  },
  about() {
    setView('<h1>ABOUT US</h1><p>' + esc(SITE.about) + '</p><h2>Principles</h2>' +
      (SITE.principles || []).map((p, i) => '<div class="card">0' + (i + 1) + ' · ' + esc(p) + '</div>').join(''));
  },
  products() {
    const plats = ['all', ...new Set(APPS.map(a => a.platform))];
    setView('<h1>PRODUCTS</h1><div class="tools"><input id="q" placeholder="search  ( / )" value="' + esc(q) + '" autocomplete="off"><div class="chips">' +
      plats.map(p => '<button class="chip' + (p === plat ? ' on' : '') + '" data-p="' + esc(p) + '">' + esc(p) + '</button>').join('') +
      '</div></div><div class="pgrid" id="plist"></div><p class="dim" id="pcount"></p>');
    $('#q').oninput = e => { q = e.target.value; list(); };
    document.querySelectorAll('.chip').forEach(b => b.onclick = () => { plat = b.dataset.p; VIEWS.products(); });
    list();
  },
  contact() {
    const c = SITE.contact || {}, mail = /^[^@\s]+@[^@\s]+$/.test(c.email) ? c.email : '';
    setView('<h1>CONTACT INFO</h1><p>Say hello. We read everything.</p>' +
      (mail ? '<div class="card">email: <a href="mailto:' + esc(mail) + '">' + esc(mail) + '</a> <button class="chip" id="cp">copy</button></div>' : '') +
      (safeUrl(c.github) ? '<div class="card">github: <a href="' + esc(c.github) + '" target="_blank" rel="noopener">' + esc(c.github) + '</a></div>' : '') +
      '<form id="cf"><input id="nm" placeholder="name" required><input id="em" type="email" placeholder="your email" required><textarea id="ms" rows="4" placeholder="message" required></textarea><button class="go" type="submit">OPEN IN MAIL →</button></form>');
    const cp = $('#cp'); if (cp) cp.onclick = () => navigator.clipboard.writeText(mail).then(() => { cp.textContent = 'copied'; });
    $('#cf').onsubmit = e => {
      e.preventDefault(); if (!mail) return;
      location.href = 'mailto:' + mail + '?subject=' + encodeURIComponent('Message from ' + $('#nm').value) + '&body=' + encodeURIComponent($('#ms').value + '\n\n' + $('#em').value);
    };
  }
};
function list() {
  const L = $('#plist'); L.innerHTML = '';
  const m = APPS.filter(a => (plat === 'all' || a.platform === plat) && [a.name, a.tagline, a.description].join(' ').toLowerCase().includes(q.toLowerCase()));
  m.forEach(a => {
    const c = document.createElement('div'); c.className = 'app'; c.tabIndex = 0;
    c.appendChild(imgEl(a, 'thumb'));
    const b = document.createElement('div'); b.className = 'ab';
    b.innerHTML = '<span class="tag">' + esc(a.platform) + '</span><b>' + esc(a.name) + '</b><br><small class="dim">' + esc(a.tagline) + '</small>';
    c.appendChild(b);
    c.onclick = () => go('app-' + a.id); c.onkeydown = e => { if (e.key === 'Enter') go('app-' + a.id); };
    L.appendChild(c);
  });
  $('#pcount').textContent = m.length + ' / ' + APPS.length + ' apps' + (SITE._updated ? ' · updated ' + SITE._updated : '');
}
function showApp(a) {
  setView('<button class="back" id="bk">← products</button><div id="hero"></div><h1>' + esc(String(a.name).toUpperCase()) + '</h1><p><span class="tag" style="float:none;margin-right:6px">' + esc(a.platform) + '</span> v' + esc(a.version) + '</p><p>' + esc(a.description) + '</p>' +
    (a.features || []).map(f => '<div class="card">· ' + esc(f) + '</div>').join('') +
    '<p>' + (a.links || []).filter(l => safeUrl(l.url)).map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>').join(' &nbsp; ') + '</p>');
  $('#hero').replaceWith(imgEl(a, 'hero'));
  $('#bk').onclick = () => go('products');
}

// ---------- router ----------
function go(id, focus) {
  const app = APPS.find(a => 'app-' + a.id === id);
  if (!PAGES.includes(id) && !app) id = 'home';
  cur = id;
  if (app) { open = true; showApp(app); } else VIEWS[id]();
  draw();
  const lab = app ? 'products / ' + String(app.name).toLowerCase() : id === 'about' ? 'about us' : id === 'contact' ? 'contact info' : id;
  $('#path').innerHTML = 'kiyo-kumo / <b>' + esc(lab) + '</b>';
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  if (focus) { const el = nav.querySelector('[data-id="' + id + '"]'); if (el) el.focus(); }
}
view.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if (t) go(t.dataset.go); });
addEventListener('hashchange', () => go(location.hash.slice(1)));
addEventListener('keydown', e => {
  const inField = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === '/' && !inField) { e.preventDefault(); go('products'); $('#q').focus(); return; }
  if (inField) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  const l = items(), i = Math.max(0, l.findIndex(t => t.id === cur));
  if (e.key === 'ArrowDown') { e.preventDefault(); go(l[(i + 1) % l.length].id, 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); go(l[(i - 1 + l.length) % l.length].id, 1); }
  else if (e.key === 'ArrowLeft' && cur === 'products') { open = false; draw(); nav.querySelector('[data-id="products"]').focus(); }
  else if (e.key === 'ArrowRight' && cur === 'products') { open = true; draw(); nav.querySelector('[data-id="products"]').focus(); }
  else if (e.key === 'Escape') go('home', 1);
});

// ---------- stats + activity grid ----------
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function stats() {
  const st = SITE.stats || {}; let mine = 0;
  try { mine = (+localStorage.getItem('kk_v') || 0) + 1; localStorage.setItem('kk_v', mine); } catch (_) {}
  let visits = (st.base_visits || 0) + mine, online = 3 + Math.floor(Math.random() * 6);
  const show = () => { $('#visits').textContent = visits.toLocaleString('en-US'); $('#online').textContent = online; };
  show();
  setInterval(() => { if (Math.random() < .6) visits++; online = Math.max(1, online + Math.floor(Math.random() * 3) - 1); show(); }, 3500);
  $('#demo').hidden = !st.demo;
}
function heat() {
  const days = $('#days'); days.innerHTML = '';
  [1, 0].forEach(off => {
    const d = new Date(); d.setDate(d.getDate() - off);
    const nm = d.toLocaleDateString('en-US', {weekday: 'long'}), wk = [0, 6].includes(d.getDay());
    const r = rng(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
    let act = 0, cells = '';
    for (let i = 0; i < 336; i++) {
      const hour = Math.floor(i / 7) / 2 + 9, p = wk ? .12 : .25 + .5 * Math.exp(-Math.pow(hour - 13, 2) / 18);
      let l = 0; if (r() < p) { l = Math.min(3, 1 + (r() < .6) + (r() < .3)); act++; }
      cells += '<i class="' + (l ? 'l' + l : '') + '"></i>';
    }
    const total = 336 * (wk ? 40 : 60), a = act * (wk ? 22 : 55);
    const el = document.createElement('div');
    el.innerHTML = '<div class="row"><span class="d">' + nm + '</span>Active: <b class="g">' + a.toLocaleString('en-US') + '</b> Idle: <b>' + (total - a).toLocaleString('en-US') + '</b></div><div class="heat">' + cells + '</div><div class="ticks"><span>09:00</span><span>11:00</span><span>13:00</span><span>15:00</span><span>17:00</span><span>19:00</span><span>21:00</span></div>';
    days.appendChild(el);
  });
}

function boot() {
  if (SITE.company) { $('#logo').textContent = SITE.company.toUpperCase(); document.title = SITE.company.toLowerCase(); }
  stats(); heat();
  go((location.hash || '#home').slice(1));
}
load();
})();
