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
  const NAME = { LOM: 'Lombardia', TOS: 'Toscana' };
  const NAT_RE = /^(\d{2}\.[0-9][0-9A-Z]?(\.[0-9A-Z]{1,2})?|G\d\.\d{1,4}(\.[A-Z])?)$/;
  const norm = s => (s || '').trim().toUpperCase().replace(/\s+/g, '');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isCurrent = nat => !!(D.N[nat] || D.LN[nat]);

  // ---- indici ----
  const T = D.T.map(r => ({ code: r[0], desc: r[1], nat: r[2], branca: r[3], presc: !!r[4] }));
  const tByCode = new Map(T.map(x => [x.code, x]));
  const tByNat = new Map();
  T.forEach(x => { if (!tByNat.has(x.nat)) tByNat.set(x.nat, []); tByNat.get(x.nat).push(x); });

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
  const T_LIST = T;

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
    if (tByCode.has(code)) { const x = tByCode.get(code); return { code, desc: x.desc, nat: x.nat, how: 'Catalogo prestazioni Regione Toscana', stale: !isCurrent(x.nat) && !D.N[x.nat] }; }
    if (NAT_RE.test(code) && (D.N[code] || tByNat.has(code))) return { code, desc: D.N[code] ? D.N[code][0] : tByNat.get(code)[0].desc, nat: code, how: 'Codice del nomenclatore nazionale' };
    return { error: `Il codice <b>${esc(code)}</b> non è presente nel catalogo della Toscana. Controlla di averlo copiato per intero oppure prova a cercare per descrizione.` };
  }

  // ---- arrivo: codice nazionale -> voci della regione di destinazione ----
  function targets(region, nat) {
    if (region === 'TOS') {
      const arr = (tByNat.get(nat) || []).slice().sort((a, b) => b.presc - a.presc);
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
    const list = region === 'TOS' ? T_LIST.filter(x => x.presc) : L_LIST;
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
    const res = targets(a, src.nat);
    const natInfo = D.N[src.nat] || D.LN[src.nat];
    let html = `<div class="trail">
      <div class="node"><span class="k">${NAME[da]}</span><span class="v">${esc(src.code)}</span><span class="t">${esc(src.desc)}</span></div>
      <span class="arrow" aria-hidden="true">→</span>
      <div class="node bridge"><span class="k">Codice nazionale</span><span class="v">${esc(src.nat)}</span><span class="t">${esc(src.how)}</span></div>
    </div>`;
    if (src.stale) html += `<div class="note"><strong>Codifica superata.</strong> Il codice nazionale ${esc(src.nat)} appartiene al vecchio nomenclatore e non è più in vigore dal 30/12/2024. Per questo il collegamento diretto può non funzionare: sotto trovi le voci più simili per descrizione.</div>`;
    if (src.guessed) html += `<div class="note"><strong>Da verificare.</strong> Questo codice SISS non è negli elenchi pubblici; il codice nazionale è stato ricavato dalla sua struttura (prefisso di branca + codice nazionale).</div>`;
    if (res.length === 1) html += `<div class="status"><span class="pill ok">Corrispondenza unica</span><p>In ${NAME[a]} questa prestazione ha un solo codice.</p></div>`;
    else if (res.length > 1) html += `<div class="status"><span class="pill warn">${res.length} alternative</span><p>In ${NAME[a]} la stessa prestazione è divisa in più voci: scegli quella che corrisponde alla richiesta del medico.</p></div>`;
    else {
      const why = (a === 'LOM' && D.N[src.nat] && !D.LN[src.nat]) ? `La prestazione ${esc(src.nat)} non è stata recepita nel nomenclatore della Lombardia.`
        : `Nel catalogo della ${NAME[a]} non c'è una voce collegata al codice nazionale ${esc(src.nat)}.`;
      html += `<div class="status"><span class="pill bad">Nessuna corrispondenza</span><p>${why}</p></div>`;
    }
    if (res.length) html += `<h2>Codici in ${NAME[a]}</h2><ul class="results">${res.map(resItem).join('')}</ul>`;
    if (!res.length || src.stale) {
      const sim = similar(a, src.desc + ' ' + (natInfo ? natInfo[0] : ''));
      html += sim.length
        ? `<h2>Voci simili per descrizione · da verificare</h2><ul class="results">${sim.map(x => resItem({ code: x.code, desc: x.desc, meta: 'Codice nazionale ' + x.nat, tag: 'simile' })).join('')}</ul>`
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
    const list = $('da').value === 'TOS' ? T_LIST : L_LIST;
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
  function other(v) { return v === 'LOM' ? 'TOS' : 'LOM'; }
  $('da').addEventListener('change', () => { if ($('a').value === $('da').value) $('a').value = other($('da').value); });
  $('a').addEventListener('change', () => { if ($('a').value === $('da').value) $('da').value = other($('a').value); });
  $('swap').addEventListener('click', () => { const d = $('da').value; $('da').value = $('a').value; $('a').value = d; });
  $('f').addEventListener('submit', e => { e.preventDefault(); closeSugg(); run(); });
  document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    $('da').value = b.dataset.da; $('a').value = other(b.dataset.da); inp.value = b.dataset.c; run();
  }));
  out.addEventListener('click', e => {
    const b = e.target.closest('.copy'); if (!b) return;
    const txt = b.dataset.copy;
    const done = () => { b.textContent = 'Copiato'; setTimeout(() => b.textContent = 'Copia', 1400); };
    try { navigator.clipboard.writeText(txt).then(done, () => { inp.value = txt; inp.select(); }); } catch (_) { inp.value = txt; inp.select(); }
  });

  // stato iniziale: esempio già risolto
  inp.value = '088950'; run();
  window.__ponte = { resolve, targets, similar };
})();
