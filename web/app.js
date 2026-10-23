(async function () {
  // Dati: inline nella pagina unica (dist/), altrimenti caricati da data/webdata.json
  const inline = document.getElementById('data');
  let D;
  try {
    D = inline ? JSON.parse(inline.textContent) : await (await fetch('data/webdata.json')).json();
  } catch (e) {
    document.getElementById('out').innerHTML = '<div class="err"><strong>Dati non caricati.</strong> Apri la pagina tramite un server locale (vedi README), non con doppio clic sul file.</div>';
    return;
  }
  const NAT_RE = /^(\d{2}\.[0-9][0-9A-Z]?(\.[0-9A-Z]{1,2})?|G\d\.\d{1,4}(\.[A-Z])?)$/;
  const norm = s => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');
  // codice nazionale da file esterni: tollera punto finale e virgola decimale (89,50)
  const normNat = s => { const c = norm(s).replace(/\.$/, ''); return NAT_RE.test(c) ? c : (NAT_RE.test(c.replace(/,/g, '.')) ? c.replace(/,/g, '.') : c); };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isCurrent = nat => !!(D.N[nat] || D.LN[nat]);

  // ---- regioni ----
  // La Lombardia ha una logica propria (codici SISS); tutte le altre sono tabelle
  // generiche [codice regionale, descrizione, codice nazionale, branca, prescrivibile].
  const REG = new Map();
  function makeRegion(id, nome, how, rows, extra = {}) {
    const list = rows.map(r => ({ code: norm(r[0]), desc: r[1] || '', nat: normNat(r[2]), branca: r[3] || '', presc: r[4] === undefined ? true : !!r[4] }))
      .filter(x => x.code);
    const byCode = new Map(), byNat = new Map();
    list.forEach(x => {
      if (!byCode.has(x.code)) byCode.set(x.code, x);
      if (!x.nat) return;
      if (!byNat.has(x.nat)) byNat.set(x.nat, []);
      byNat.get(x.nat).push(x);
    });
    return { id, nome, how, list, prescList: list.filter(x => x.presc), byCode, byNat, ...extra };
  }

  const LT = D.LT.map(r => ({ code: r[0], nat: r[1], desc: r[2], official: true }));
  const LS = D.LS.map(r => ({ code: r[0], nat: r[1], desc: r[2], branca: r[3] }));
  const ltByCode = new Map(LT.map(x => [x.code, x]));
  const lsByCode = new Map(LS.map(x => [x.code, x]));
  const lByNat = new Map();
  [...LT, ...LS].forEach(x => {
    if (!lByNat.has(x.nat)) lByNat.set(x.nat, []);
    const arr = lByNat.get(x.nat);
    if (!arr.some(y => y.code === x.code)) arr.push(x);
  });
  // elenco per suggerimenti/descrizioni lato Lombardia: codici SISS + voci del nomenclatore 2024
  const L_LIST = [...LT, ...LS.filter(x => !ltByCode.has(x.code))]
    .concat(Object.entries(D.LN).map(([nat, v]) => ({ code: nat, nat, desc: v[0], isNat: true })));
  REG.set('LOM', { id: 'LOM', nome: 'Lombardia', list: L_LIST, prescList: L_LIST });
  REG.set('TOS', makeRegion('TOS', 'Toscana', 'Catalogo prestazioni Regione Toscana', D.T));
  // regioni aggiunte al progetto come file in data/regioni/ (vedi build_web.py)
  (D.R || []).forEach(r => REG.set(r.id, makeRegion(r.id, r.nome, 'Catalogo ' + (r.fonte || r.nome), r.voci)));
  // regioni caricate dall'utente in questo browser
  const LS_KEY = 'ponte.regioni.v1';
  let MINE = [];
  try { MINE = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (_) { MINE = []; }
  const addMine = r => REG.set(r.id, makeRegion(r.id, r.nome, 'Tabella caricata: ' + (r.fonte || r.nome), r.voci, { custom: true }));
  MINE.forEach(addMine);
  function saveMine() { try { localStorage.setItem(LS_KEY, JSON.stringify(MINE)); return true; } catch (_) { return false; } }
  const name = id => (REG.get(id) || { nome: id }).nome;

  function sissRule(code) {
    const core = code.split('.')[0].slice(2);
    if (core.length < 3) return null;
    const a = core.slice(0, 2), rest = core.slice(2);
    for (const k of [2, 1]) {
      if (rest.length < k) continue;
      const c = a + '.' + rest.slice(0, k) + (rest.slice(k) ? '.' + rest.slice(k) : '');
      if (isCurrent(c)) return c;
    }
    return null;
  }

  // ---- partenza: codice regionale -> codice nazionale ----
  function resolve(region, raw) {
    const code = norm(raw);
    if (!code) return { error: 'Inserisci un codice.' };
    if (region === 'LOM') {
      if (ltByCode.has(code)) { const x = ltByCode.get(code); return { code, desc: x.desc, nat: x.nat, how: 'Codice di prescrizione ufficiale (DGR XII/3630)' }; }
      if (lsByCode.has(code)) {
        const x = lsByCode.get(code);
        return { code, desc: x.desc, nat: x.nat, how: 'Codice SISS (open data Lombardia)', stale: !isCurrent(x.nat) };
      }
      if (NAT_RE.test(code) && (D.LN[code] || D.N[code])) return { code, desc: (D.LN[code] || D.N[code])[0], nat: code, how: 'Codice del nomenclatore nazionale' };
      const r = sissRule(code);
      if (r) return { code, desc: (D.LN[r] || D.N[r])[0], nat: r, how: 'Ricavato dalla struttura del codice SISS (da verificare)', guessed: true };
      return { error: `Il codice <b>${esc(code)}</b> non è presente nei cataloghi della Lombardia che conosco. Controlla di averlo copiato per intero, punto e cifre dopo il punto compresi, oppure prova a cercare per descrizione.` };
    }
    const R = REG.get(region);
    if (R.byCode.has(code)) { const x = R.byCode.get(code); return { code, desc: x.desc, nat: x.nat, how: R.how, stale: !!x.nat && !isCurrent(x.nat) }; }
    if (NAT_RE.test(code) && (D.N[code] || R.byNat.has(code))) return { code, desc: D.N[code] ? D.N[code][0] : R.byNat.get(code)[0].desc, nat: code, how: 'Codice del nomenclatore nazionale' };
    return { error: `Il codice <b>${esc(code)}</b> non è presente nel catalogo della regione ${esc(R.nome)}. Controlla di averlo copiato per intero oppure prova a cercare per descrizione.` };
  }

  // ---- arrivo: codice nazionale -> voci della regione di destinazione ----
  function targets(region, nat) {
    if (region !== 'LOM') {
      const arr = (REG.get(region).byNat.get(nat) || []).slice().sort((a, b) => b.presc - a.presc);
      return arr.map(x => ({ code: x.code, desc: x.desc, meta: [x.branca && 'Branca ' + x.branca, !x.presc && 'non prescrivibile'].filter(Boolean).join(' · '), tag: null }));
    }
    const arr = (lByNat.get(nat) || []).map(x => ({ code: x.code, desc: x.desc, meta: x.branca || '', tag: x.official ? 'ufficiale DGR 3630' : 'SISS' }));
    if (!arr.length && D.LN[nat]) {
      arr.push({ code: nat, desc: D.LN[nat][0], meta: 'Codice SISS non presente nei dati pubblici: il medico lo trova cercando questo codice nazionale nel suo programma.', tag: 'nazionale' });
    }
    return arr;
  }

  // ---- suggerimenti per descrizione ----
  const STOP = new Set('DI DA DEL DELLA DELLE DEI DEGLI E ED CON SENZA PER IN SU AL ALLO ALLA ALLE AI A IL LO LA LE GLI UN UNA O OD NON INCLUSO ESCLUSO EVENTUALE'.split(' '));
  const SYN = { RMN: 'RM', TAC: 'TC', ECOCOLORDOPPLER: 'ECODOPPLER', ECOCOLORDOPPLERGRAFIA: 'ECODOPPLER', ECG: 'ELETTROCARDIOGRAMMA', MDC: 'CONTRASTO', DX: 'DESTRO', SX: 'SINISTRO' };
  const toks = s => new Set((s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Z0-9]+/).map(w => SYN[w] || w).filter(w => w.length > 1 && !STOP.has(w)).map(w => w.length > 3 ? w.replace(/(I|E|A|O)$/, '') : w));
  function similar(region, desc, max = 5) {
    const q = toks(desc); if (!q.size) return [];
    const list = REG.get(region).prescList;
    const scored = [];
    for (const x of list) {
      const t = toks(x.desc); let inter = 0; q.forEach(w => { if (t.has(w)) inter++; });
      if (!inter) continue;
      const s = inter / Math.sqrt(q.size * t.size);
      if (s >= 0.34) scored.push([s, x]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const seen = new Set(), out = [];
    for (const [, x] of scored) { if (seen.has(x.code)) continue; seen.add(x.code); out.push(x); if (out.length >= max) break; }
    return out;
  }

  // ---- render ----
  const $ = id => document.getElementById(id);
  const out = $('out');
  function resItem(r) {
    return `<li class="res"><span class="code">${esc(r.code)}</span>
      <span class="desc">${r.tag ? `<span class="tag">${esc(r.tag)}</span>` : ''}${esc(r.desc)}</span>
      ${r.meta ? `<span class="meta">${esc(r.meta)}</span>` : ''}
      <button type="button" class="copy" data-copy="${esc(r.code)}">Copia</button></li>`;
  }
  function run() {
    const da = $('da').value, a = $('a').value, raw = $('codice').value;
    const src = resolve(da, raw);
    if (src.error) { out.innerHTML = `<div class="err"><strong>Codice non trovato.</strong> ${src.error}</div>`; return; }
    const res = src.nat ? targets(a, src.nat) : [];
    const natInfo = D.N[src.nat] || D.LN[src.nat];
    let html = `<div class="trail">
      <div class="node"><span class="k">${esc(name(da))}</span><span class="v">${esc(src.code)}</span><span class="t">${esc(src.desc)}</span></div>
      <span class="arrow" aria-hidden="true">→</span>
      <div class="node bridge"><span class="k">Codice nazionale</span><span class="v">${esc(src.nat || '—')}</span><span class="t">${esc(src.how)}</span></div>
    </div>`;
    if (src.stale) html += `<div class="note"><strong>Codifica superata.</strong> Il codice nazionale ${esc(src.nat)} appartiene al vecchio nomenclatore e non è più in vigore dal 30/12/2024. Per questo il collegamento diretto può non funzionare: sotto trovi le voci più simili per descrizione.</div>`;
    if (src.guessed) html += `<div class="note"><strong>Da verificare.</strong> Questo codice SISS non è negli elenchi pubblici; il codice nazionale è stato ricavato dalla sua struttura (prefisso di branca + codice nazionale).</div>`;
    if (res.length === 1) html += `<div class="status"><span class="pill ok">Corrispondenza unica</span><p>In ${esc(name(a))} questa prestazione ha un solo codice.</p></div>`;
    else if (res.length > 1) html += `<div class="status"><span class="pill warn">${res.length} alternative</span><p>In ${esc(name(a))} la stessa prestazione è divisa in più voci: scegli quella che corrisponde alla richiesta del medico.</p></div>`;
    else {
      const why = !src.nat ? 'Nella tabella di partenza questa voce non ha un codice del nomenclatore nazionale.'
        : (a === 'LOM' && D.N[src.nat] && !D.LN[src.nat]) ? `La prestazione ${esc(src.nat)} non è stata recepita nel nomenclatore della Lombardia.`
        : `Nel catalogo della regione ${esc(name(a))} non c'è una voce collegata al codice nazionale ${esc(src.nat)}.`;
      html += `<div class="status"><span class="pill bad">Nessuna corrispondenza</span><p>${why}</p></div>`;
    }
    if (res.length) html += `<h2>Codici in ${esc(name(a))}</h2><ul class="results">${res.map(resItem).join('')}</ul>`;
    if (!res.length || src.stale) {
      const sim = similar(a, src.desc + ' ' + (natInfo ? natInfo[0] : ''));
      html += sim.length
        ? `<h2>Voci simili per descrizione · da verificare</h2><ul class="results">${sim.map(x => resItem({ code: x.code, desc: x.desc, meta: x.nat ? 'Codice nazionale ' + x.nat : '', tag: 'simile' })).join('')}</ul>`
        : `<p class="status"><span class="pill bad">Nessuna voce simile</span></p>`;
    }
    out.innerHTML = html;
  }

  // ---- autocompletamento ----
  const inp = $('codice'), sugg = $('sugg');
  let items = [], sel = -1;
  function suggest() {
    const q = inp.value.trim(); const nq = norm(q);
    if (q.length < 2) return closeSugg();
    const list = REG.get($('da').value).list;
    const up = q.toUpperCase();
    const byCode = [], byDesc = [];
    for (const x of list) {
      if (x.code.startsWith(nq)) byCode.push(x);
      else if (q.length >= 3 && (x.desc || '').toUpperCase().includes(up)) byDesc.push(x);
      if (byCode.length >= 8) break;
    }
    items = byCode.concat(byDesc).slice(0, 8);
    if (!items.length) return closeSugg();
    sel = -1;
    sugg.innerHTML = items.map((x, i) => `<li role="option" id="s${i}" data-i="${i}"><span class="c">${esc(x.code)}</span><span class="d">${esc(x.desc)}</span></li>`).join('');
    sugg.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  function closeSugg() { sugg.hidden = true; items = []; sel = -1; inp.setAttribute('aria-expanded', 'false'); }
  function pick(i) { inp.value = items[i].code; closeSugg(); run(); }
  inp.addEventListener('input', suggest);
  inp.addEventListener('keydown', e => {
    if (sugg.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      [...sugg.children].forEach((li, i) => li.setAttribute('aria-selected', i === sel));
      inp.setAttribute('aria-activedescendant', 's' + sel);
    } else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') closeSugg();
  });
  sugg.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  inp.addEventListener('blur', () => setTimeout(closeSugg, 120));

  // ---- controlli ----
  function fillSelects() {
    const opts = [...REG.values()].map(r => `<option value="${esc(r.id)}">${esc(r.nome)}${r.custom ? ' (caricata)' : ''}</option>`).join('');
    ['da', 'a'].forEach(id => { const s = $(id), v = s.value; s.innerHTML = opts; if (REG.has(v)) s.value = v; });
    if ($('a').value === $('da').value) $('a').value = other($('da').value);
  }
  function other(v) { return [...REG.keys()].find(k => k !== v); }
  $('da').addEventListener('change', () => { if ($('a').value === $('da').value) $('a').value = other($('da').value); });
  $('a').addEventListener('change', () => { if ($('a').value === $('da').value) $('da').value = other($('a').value); });
  $('swap').addEventListener('click', () => { const d = $('da').value; $('da').value = $('a').value; $('a').value = d; });
  $('f').addEventListener('submit', e => { e.preventDefault(); closeSugg(); run(); });
  document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    $('da').value = b.dataset.da; $('a').value = b.dataset.da === 'LOM' ? 'TOS' : 'LOM'; inp.value = b.dataset.c; run();
  }));
  out.addEventListener('click', e => {
    const b = e.target.closest('.copy'); if (!b) return;
    const txt = b.dataset.copy;
    const done = () => { b.textContent = 'Copiato'; setTimeout(() => b.textContent = 'Copia', 1400); };
    try { navigator.clipboard.writeText(txt).then(done, () => { inp.value = txt; inp.select(); }); } catch (_) { inp.value = txt; inp.select(); }
  });

  // ---- caricamento di nuove tabelle regionali (Excel, CSV, JSON) ----
  // Tutto avviene nel browser: il file non viene inviato a nessun server.
  const SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  let imp = null;  // { file, sheets: [{name, rows}], sheet, header, cols, nome, id, fonte }

  function loadScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('script')); document.head.appendChild(s); });
  }
  function decodeText(buf) {
    let t;
    try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (_) { t = new TextDecoder('windows-1252').decode(buf); }
    return t.replace(/^﻿/, '');
  }
  function parseCSV(text) {
    const head = text.split(/\r?\n/).slice(0, 5).join('\n');
    const delim = [';', ',', '\t', '|'].map(d => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && cell === '') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  // JSON: formato del progetto ({meta, voci}), array di oggetti o array di righe
  function jsonToSheet(obj) {
    let arr = Array.isArray(obj) ? obj : Array.isArray(obj.voci) ? obj.voci : Object.values(obj).find(v => Array.isArray(v) && v.length && typeof v[0] === 'object');
    if (!arr || !arr.length) throw new Error('Nel JSON non trovo un elenco di voci.');
    if (Array.isArray(arr[0])) return arr.map(r => r.map(c => c ?? ''));
    const keys = [...new Set(arr.slice(0, 200).flatMap(o => Object.keys(o || {})))];
    return [keys, ...arr.map(o => keys.map(k => o && o[k] != null ? o[k] : ''))];
  }
  async function readFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    if (ext === 'json') {
      const obj = JSON.parse(decodeText(buf));
      const meta = obj && obj.meta || {};
      return { sheets: [{ name: 'JSON', rows: jsonToSheet(obj) }], nome: meta.regione, id: meta.sigla, fonte: meta.fonte };
    }
    if (ext === 'csv' || ext === 'txt') return { sheets: [{ name: 'CSV', rows: parseCSV(decodeText(buf)) }] };
    if (!window.XLSX) {
      try { await loadScript(SHEETJS); } catch (_) { throw new Error('Non riesco a caricare il lettore Excel (serve la connessione a internet). In alternativa salva il foglio come CSV e caricalo.'); }
    }
    const wb = XLSX.read(buf, { type: 'array' });
    return { sheets: wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }) })) };
  }

  const cellStr = v => { const s = String(v ?? '').trim(); return s === 'NULL' ? '' : s; };
  // riga di intestazione: la prima, tra le prime 20, con il maggior numero di celle piene
  function guessHeader(rows) {
    let best = 0, bn = -1;
    rows.slice(0, 20).forEach((r, i) => { const n = r.filter(c => cellStr(c)).length; if (n > bn) { bn = n; best = i; } });
    return best;
  }
  function guessCols(rows, h) {
    const head = (rows[h] || []).map(c => cellStr(c).toLowerCase());
    const sample = rows.slice(h + 1, h + 400);
    const st = head.map((t, j) => {
      const v = sample.map(r => cellStr(r[j])).filter(Boolean), n = v.length || 1;
      return { t, nat: v.filter(x => NAT_RE.test(normNat(x))).length / n, len: v.reduce((s, x) => s + x.length, 0) / n, uniq: new Set(v).size / n };
    });
    const pickBest = (score, skip) => { let b = -1, bs = 0; st.forEach((s, j) => { if (skip.includes(j)) return; const sc = score(s); if (sc > bs) { bs = sc; b = j; } }); return b; };
    const nat = pickBest(s => (s.nat >= 0.2 ? s.nat : 0) + (/nomencl|nazional|naz\b|dpcm|ministe/.test(s.t) ? 0.5 : 0), []);
    const desc = pickBest(s => (/descr|denomin/.test(s.t) ? 100 : 0) + (s.len > 12 ? s.len : 0), [nat]);
    const code = pickBest(s => (/cod/.test(s.t) ? 1 : 0) + (/regio|catal|siss|cup|prest/.test(s.t) ? 0.5 : 0) + s.uniq - (s.len > 20 ? 1 : 0), [nat, desc]);
    const branca = pickBest(s => (/branca/.test(s.t) ? 2 : /disciplin/.test(s.t) ? 1 : 0) - (/_id\b|\bid\b/.test(s.t) ? 0.5 : 0), [nat, desc, code]);
    return { code, nat, desc, branca };
  }
  function mapped() {
    const { rows } = imp.sheets[imp.sheet], c = imp.cols;
    const get = (r, j) => j >= 0 ? cellStr(r[j]) : '';
    return rows.slice(imp.header + 1)
      .map(r => [norm(get(r, c.code)), get(r, c.desc), normNat(get(r, c.nat)), get(r, c.branca)])
      .filter(r => r[0] && r[0] !== norm(get(rows[imp.header], c.code)));
  }
  const today = () => new Date().toLocaleDateString('sv');
  const slugId = s => (s || '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'REG';

  const box = $('imp'), mine = $('mine'), fileInp = $('file'), drop = $('drop');
  function showError(msg) { box.hidden = false; box.innerHTML = `<div class="err"><strong>File non leggibile.</strong> ${esc(msg)}</div>`; }
  async function importFile(file) {
    if (!file) return;
    box.hidden = false; box.innerHTML = `<p class="hint">Lettura di <b>${esc(file.name)}</b>…</p>`;
    try {
      const r = await readFile(file);
      const sheets = r.sheets.filter(s => s.rows.length > 1);
      if (!sheets.length) throw new Error('Il file è vuoto o ha una sola riga.');
      // foglio: quello con più righe
      const sheet = sheets.reduce((b, s, i) => s.rows.length > sheets[b].rows.length ? i : b, 0);
      const base = file.name.replace(/\.[^.]+$/, '');
      imp = { file: file.name, sheets, sheet, nome: r.nome || '', id: r.id || '', fonte: r.fonte || file.name };
      setSheet(sheet);
      if (!imp.nome) imp.nome = /tosc|lomb/i.test(base) ? '' : base.replace(/[_-]+/g, ' ').slice(0, 40);
      renderImp();
    } catch (e) { showError(e.message || String(e)); }
  }
  function setSheet(i) { imp.sheet = i; imp.header = guessHeader(imp.sheets[i].rows); imp.cols = guessCols(imp.sheets[i].rows, imp.header); }

  function renderImp() {
    const { rows } = imp.sheets[imp.sheet];
    const head = rows[imp.header] || [];
    const colOpts = (sel, optional) => (optional ? `<option value="-1"${sel < 0 ? ' selected' : ''}>— nessuna —</option>` : '')
      + head.map((h, j) => `<option value="${j}"${j === sel ? ' selected' : ''}>${esc(cellStr(h) || 'Colonna ' + (j + 1))}</option>`).join('');
    const m = imp.cols.code >= 0 && imp.cols.nat >= 0 ? mapped() : [];
    const withNat = m.filter(r => NAT_RE.test(r[2])).length, known = m.filter(r => isCurrent(r[2])).length;
    const pct = n => m.length ? Math.round(n / m.length * 100) + '%' : '0%';
    box.hidden = false;
    box.innerHTML = `
      <div class="imp-grid">
        <label>Nome regione<input type="text" data-k="nome" value="${esc(imp.nome)}" placeholder="es. Veneto"></label>
        <label>Sigla<input type="text" data-k="id" value="${esc(imp.id)}" maxlength="4" placeholder="es. VEN"></label>
        <label class="wide">Fonte del dato<input type="text" data-k="fonte" value="${esc(imp.fonte)}" placeholder="es. Open data Regione Veneto, aggiornamento 2026"></label>
        ${imp.sheets.length > 1 ? `<label>Foglio<select data-k="sheet">${imp.sheets.map((s, i) => `<option value="${i}"${i === imp.sheet ? ' selected' : ''}>${esc(s.name)} (${s.rows.length} righe)</option>`).join('')}</select></label>` : ''}
        <label>Riga intestazione<input type="number" data-k="header" min="1" max="${rows.length}" value="${imp.header + 1}"></label>
      </div>
      <div class="imp-grid">
        <label>Colonna codice regionale *<select data-c="code">${colOpts(imp.cols.code, true)}</select></label>
        <label>Colonna codice nazionale *<select data-c="nat">${colOpts(imp.cols.nat, true)}</select></label>
        <label>Colonna descrizione<select data-c="desc">${colOpts(imp.cols.desc, true)}</select></label>
        <label>Colonna branca<select data-c="branca">${colOpts(imp.cols.branca, true)}</select></label>
      </div>
      ${m.length ? `<div class="status">
          <span class="pill ${known / m.length > 0.5 ? 'ok' : 'warn'}">${m.length} voci</span>
          <p>${withNat} (${pct(withNat)}) con un codice nazionale valido, di cui ${known} (${pct(known)}) presenti nel nomenclatore in vigore.</p>
        </div>
        <div class="table-wrap"><table class="prev"><thead><tr><th>Codice regionale</th><th>Nazionale</th><th>Descrizione</th><th>Branca</th></tr></thead>
          <tbody>${m.slice(0, 6).map(r => `<tr><td class="mono">${esc(r[0])}</td><td class="mono${NAT_RE.test(r[2]) ? '' : ' bad'}">${esc(r[2] || '—')}</td><td>${esc(r[1])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="note"><strong>Scegli le colonne.</strong> Servono almeno il codice regionale e il codice del nomenclatore nazionale.</div>`}
      <div class="imp-actions">
        <button type="button" class="primary" data-act="save"${m.length && withNat ? '' : ' disabled'}>Aggiungi regione</button>
        <button type="button" class="ghost" data-act="cancel">Annulla</button>
      </div>`;
  }
  box.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.c) imp.cols[t.dataset.c] = +t.value;
    else if (t.dataset.k === 'sheet') setSheet(+t.value);
    else if (t.dataset.k === 'header') { imp.header = Math.max(0, Math.min(+t.value - 1, imp.sheets[imp.sheet].rows.length - 2)); imp.cols = guessCols(imp.sheets[imp.sheet].rows, imp.header); }
    else return;
    renderImp();
  });
  box.addEventListener('input', e => { const k = e.target.dataset.k; if (k === 'nome' || k === 'id' || k === 'fonte') imp[k] = e.target.value; });
  box.addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act === 'cancel') { imp = null; box.hidden = true; box.innerHTML = ''; fileInp.value = ''; }
    if (act !== 'save') return;
    const nome = imp.nome.trim();
    if (!nome) { box.querySelector('[data-k="nome"]').focus(); return; }
    let id = norm(imp.id).replace(/[^A-Z0-9]/g, '') || slugId(nome);
    const prev = REG.get(id);
    if (prev && !prev.custom) id = id + '2';
    else if (prev && !confirm(`Esiste già una tabella caricata con sigla ${id} (${prev.nome}). Sostituirla?`)) return;
    const r = { id, nome, fonte: imp.fonte.trim(), file: imp.file, caricato_il: today(), voci: mapped().map(x => [x[0], x[1], x[2], x[3]]) };
    MINE = MINE.filter(x => x.id !== id).concat(r);
    addMine(r);
    const saved = saveMine();
    imp = null; fileInp.value = '';
    box.innerHTML = `<div class="note ok-note"><strong>${esc(nome)} aggiunta.</strong> ${r.voci.length} voci. ${saved ? 'Resta salvata in questo browser.' : 'Il browser non permette di salvarla: resterà disponibile solo finché non chiudi la pagina. Scarica il JSON per conservarla.'}</div>`;
    fillSelects(); $('a').value = id; if ($('da').value === id) $('da').value = other(id);
    renderMine(); run();
  });

  function download(r) {
    const voci = r.voci.map(v => ({ codice_regionale: v[0], descrizione: v[1], codice_nazionale: v[2], branca: v[3] || null, prescrivibile: v[4] === undefined ? true : !!v[4] }));
    const obj = { meta: { regione: r.nome, sigla: r.id, nome: 'Catalogo prestazioni ' + r.nome, fonte: r.fonte || '', generato_il: today(), n_voci: voci.length }, voci };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
    a.download = 'regione_' + r.id.toLowerCase() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function renderMine() {
    if (!MINE.length) { mine.innerHTML = ''; return; }
    mine.innerHTML = `<h2>Tabelle caricate in questo browser</h2><ul class="results">${MINE.map(r => {
      const R = REG.get(r.id), known = R.list.filter(x => isCurrent(x.nat)).length;
      return `<li class="res mine-item"><span class="code">${esc(r.id)}</span>
        <span class="desc">${esc(r.nome)}</span>
        <span class="meta">${R.list.length} voci · ${known} collegate al nomenclatore · ${esc(r.fonte || r.file || '')}${r.caricato_il ? ' · ' + esc(r.caricato_il) : ''}</span>
        <span class="mine-act"><button type="button" class="copy" data-dl="${esc(r.id)}">Scarica JSON</button><button type="button" class="copy" data-rm="${esc(r.id)}">Rimuovi</button></span></li>`;
    }).join('')}</ul>`;
  }
  mine.addEventListener('click', e => {
    const dl = e.target.dataset.dl, rm = e.target.dataset.rm;
    if (dl) download(MINE.find(x => x.id === dl));
    if (rm && confirm(`Rimuovere la tabella ${name(rm)} da questo browser?`)) {
      MINE = MINE.filter(x => x.id !== rm); REG.delete(rm); saveMine(); fillSelects(); renderMine(); run();
    }
  });
  fileInp.addEventListener('change', () => importFile(fileInp.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => importFile(e.dataTransfer.files[0]));

  // stato iniziale: esempio già risolto
  fillSelects(); renderMine();
  inp.value = '088950'; run();
  window.__ponte = { resolve, targets, similar, importFile, REG };
})();
