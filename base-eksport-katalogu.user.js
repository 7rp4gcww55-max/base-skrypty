// ==UserScript==
// @name         Base eksport katalogu (paczki po 10k)
// @version      2026.11.14-1
// @description  Zaznacza kolejne strony katalogu i pobiera CSV paczkami po max 10k pozycji
// @match        https://*.baselinker.com/*
// @match        http://*.baselinker.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-eksport-katalogu.user.js
// @downloadURL  https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-eksport-katalogu.user.js
// ==/UserScript==

(() => {
  'use strict';

  // Base czasem przekierowuje na http:// – Safari wtedy blokuje stronę. Zawsze wracaj na https.
  if (location.protocol === 'http:') { location.replace(location.href.replace(/^http:/, 'https:')); return; }
  if (window.__baseEksportKatalogu) return;
  window.__baseEksportKatalogu = true;

  // ===================== SELEKTORY (z rejestratora kliknięć) =====================
  const SEL = {
    kontener: '#table_inventory_products_container',
    btnZaznacz: '#table_inventory_products_containerDropdownCheck',
    btnPobierz: '#inventoryDropdownExports',
    nastepna: 'a.pager_item_next_page',
  };

  // ===================== USTAWIENIA =====================
  const KLUCZ = 'baseEksportKatalogu';
  const DOMYSLNE = {
    stronNaPaczke: 10,       // ile stron zaznaczyć przed pobraniem (10 x 1000 = 10k)
    format: 'ID-NAZWA-EAN-SKU', // fragment nazwy pozycji w menu Pobierz
    przerwa: 900,            // pauza między klikami (ms)
    poPobraniu: 5000,        // czekanie na wygenerowanie/zapis pliku (ms)
    settle: 600,             // dodatkowe czekanie po przeładowaniu tabeli (ms)
    limitPaczek: 0,          // 0 = bez limitu
    odznaczaj: true,         // odznacz wszystko po każdym pobraniu
    ntfy: false,             // powiadomienie na telefon po zakończeniu/błędzie
  };
  let cfg = Object.assign({}, DOMYSLNE);
  try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(KLUCZ) || '{}')); } catch {}
  const zapiszCfg = () => { try { localStorage.setItem(KLUCZ, JSON.stringify(cfg)); } catch {} };

  // ===================== NARZĘDZIA =====================
  const $ = (s, root = document) => root.querySelector(s);
  const spij = ms => new Promise(r => setTimeout(r, ms));
  const widoczny = el => !!(el && el.offsetParent !== null);
  const txt = el => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  const liczba = s => parseInt(String(s || '').replace(/[^\d]/g, ''), 10) || 0;

  async function czekajNa(fn, limitMs = 15000, krok = 200) {
    const koniec = Date.now() + limitMs;
    for (;;) {
      let w; try { w = fn(); } catch { w = null; }
      if (w) return w;
      if (Date.now() > koniec) return null;
      await spij(krok);
    }
  }

  // licznik z przycisku "Zaznacz 3000/45562"
  function licznik() {
    const t = txt($(SEL.btnZaznacz));
    const m = t.match(/([\d\s ]*)\s*\/\s*([\d\s ]+)/);
    if (!m) return { wybrane: 0, razem: 0, ok: false };
    return { wybrane: liczba(m[1]), razem: liczba(m[2]), ok: true };
  }

  const wiersze = () => [...document.querySelectorAll(SEL.kontener + ' table tbody tr')]
    .filter(tr => tr.querySelector('input[type=checkbox]'));

  // podpis tabeli – do wykrycia, że strona faktycznie się przeładowała
  const podpisTabeli = () => {
    const w = wiersze();
    if (!w.length) return '';
    return w.length + '|' + (w[0].getAttribute('data-id') || txt(w[0]).slice(0, 80));
  };

  // klik pozycji w rozwijanym menu
  async function klikMenu(btn, szukaj, dokladnie = false) {
    if (!btn) throw new Error('brak przycisku menu');
    const czysc = s => s.toLowerCase().replace(/[^0-9a-ząćęłńóśźż \-\[\]]/gi, '').replace(/\s+/g, ' ').trim();
    const szuk = czysc(szukaj);
    const pasuje = el => {
      const t = czysc(txt(el));
      if (!t) return false;
      return dokladnie ? t === szuk : t.includes(szuk);
    };
    const znajdz = () => {
      const kand = [...document.querySelectorAll('a, button, li, label')].filter(el => widoczny(el) && pasuje(el));
      // najgłębszy pasujący element (żeby nie kliknąć całego kontenera menu)
      return kand.find(el => !kand.some(inny => inny !== el && el.contains(inny))) || null;
    };
    if (!znajdz()) { btn.click(); await spij(250); }
    const poz = await czekajNa(znajdz, 8000);
    if (!poz) throw new Error('nie znalazłem w menu: "' + szukaj + '"');
    poz.click();
    return poz;
  }

  // ===================== KROKI =====================
  async function zaznaczStrone() {
    const przed = licznik().wybrane;
    const spodziewane = wiersze().length;
    await klikMenu($(SEL.btnZaznacz), 'Zaznacz wszystkie', true);
    const ok = await czekajNa(() => licznik().wybrane > przed, 12000);
    if (!ok) throw new Error('zaznaczenie strony nie zwiększyło licznika (' + przed + ')');
    const teraz = licznik().wybrane;
    if (spodziewane && teraz - przed < spodziewane) {
      log('⚠️ zaznaczyło ' + (teraz - przed) + ' z ' + spodziewane + ' wierszy na stronie');
    }
    return teraz;
  }

  async function odznaczWszystko() {
    if (licznik().wybrane === 0) return;
    await klikMenu($(SEL.btnZaznacz), 'Odznacz wszystkie', true);
    const ok = await czekajNa(() => licznik().wybrane === 0, 12000);
    if (!ok) throw new Error('nie udało się odznaczyć (zostało ' + licznik().wybrane + ')');
  }

  async function nastepnaStrona() {
    const btn = $(SEL.nastepna);
    if (!btn || !widoczny(btn)) return false;
    const wyl = btn.classList.contains('disabled') || btn.getAttribute('aria-disabled') === 'true'
      || btn.closest('.disabled');
    if (wyl) return false;
    const podpis = podpisTabeli();
    btn.click();
    const ok = await czekajNa(() => wiersze().length > 0 && podpisTabeli() !== podpis, 25000);
    if (!ok) throw new Error('strona się nie przeładowała po kliknięciu "następna"');
    await spij(cfg.settle);
    return true;
  }

  async function pobierzCsv() {
    await klikMenu($(SEL.btnPobierz), cfg.format, false);
    await spij(cfg.poPobraniu);
  }

  // ===================== PĘTLA =====================
  let stan = 'stop';   // stop | lecimy | pauza
  const stopKlik = () => { stan = 'stop'; };

  async function czekajJakPauza() {
    while (stan === 'pauza') await spij(300);
    return stan === 'lecimy';
  }

  async function lec() {
    stan = 'lecimy';
    rysujPrzyciski();
    let paczka = 0, stronRazem = 0, pozycjiRazem = 0;
    const l0 = licznik();
    const naStronie = wiersze().length || 1000;
    const stronWszystkich = l0.razem ? Math.ceil(l0.razem / naStronie) : 0;
    log('▶️ start · ' + naStronie + '/stronę · ' + cfg.stronNaPaczke + ' stron na paczkę ('
      + (naStronie * cfg.stronNaPaczke) + ' poz.) · w katalogu: ' + (l0.razem || '?'));

    try {
      if (licznik().wybrane > 0) { log('czyszczę stare zaznaczenie'); await odznaczWszystko(); }

      for (;;) {
        paczka++;
        let wPaczce = 0;
        for (let i = 0; i < cfg.stronNaPaczke; i++) {
          if (!await czekajJakPauza()) throw new Error('STOP');
          const wybrane = await zaznaczStrone();
          stronRazem++; wPaczce++;
          postep('Paczka ' + paczka + ' · strona ' + stronRazem + (stronWszystkich ? '/' + stronWszystkich : '')
            + ' · zaznaczone ' + wybrane);
          await spij(cfg.przerwa);
          if (i < cfg.stronNaPaczke - 1) {
            if (!await nastepnaStrona()) { log('koniec katalogu – ostatnia strona'); break; }
            await spij(cfg.przerwa);
          }
        }

        const wybrane = licznik().wybrane;
        pozycjiRazem += wybrane;
        log('⬇️ paczka ' + paczka + ': pobieram ' + wybrane + ' pozycji (' + wPaczce + ' stron)');
        await pobierzCsv();
        log('✅ paczka ' + paczka + ' pobrana · razem ' + pozycjiRazem + ' pozycji');

        if (cfg.odznaczaj) await odznaczWszystko();
        if (cfg.limitPaczek && paczka >= cfg.limitPaczek) { log('🏁 limit paczek (' + cfg.limitPaczek + ')'); break; }
        if (!await czekajJakPauza()) throw new Error('STOP');
        if (!await nastepnaStrona()) { log('🏁 koniec katalogu'); break; }
        await spij(cfg.przerwa);
      }

      postep('Gotowe · ' + paczka + ' plików · ' + pozycjiRazem + ' pozycji');
      log('🏁 koniec: ' + paczka + ' plików, ' + pozycjiRazem + ' pozycji');
      powiadom('✅ Base eksport katalogu', paczka + ' plików, ' + pozycjiRazem + ' pozycji');
    } catch (e) {
      if (String(e.message) === 'STOP') { log('⏹ zatrzymane ręcznie'); }
      else {
        log('❌ błąd: ' + e.message);
        postep('Błąd – zatrzymane');
        powiadom('❌ Base eksport katalogu', 'Błąd: ' + e.message + ' (strona ' + stronRazem + ')');
      }
    } finally {
      stan = 'stop';
      rysujPrzyciski();
    }
  }

  function powiadom(tytul, tresc) {
    if (!cfg.ntfy) return;
    const temat = localStorage.getItem('autoNtfyTemat');
    if (!temat) return;
    fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({
      topic: temat, title: tytul, message: tresc, priority: 3, tags: ['inbox_tray'] }) }).catch(() => {});
  }

  // ===================== PANEL =====================
  let elLog, elPostep, elPrzyciski;
  function log(t) {
    const czas = new Date().toTimeString().slice(0, 8);
    if (elLog) {
      const d = document.createElement('div');
      d.textContent = czas + ' ' + t;
      elLog.appendChild(d);
      elLog.scrollTop = elLog.scrollHeight;
    }
    console.log('[EksportKatalogu] ' + t);
  }
  const postep = t => { if (elPostep) elPostep.textContent = t; };

  function rysujPrzyciski() {
    if (!elPrzyciski) return;
    elPrzyciski.innerHTML = '';
    const przycisk = (tekst, kolor, fn) => {
      const b = document.createElement('button');
      b.textContent = tekst;
      b.style.cssText = 'flex:1;padding:7px 4px;border:0;border-radius:7px;font:bold 12px sans-serif;color:#fff;cursor:pointer;background:' + kolor;
      b.onclick = fn;
      elPrzyciski.appendChild(b);
    };
    if (stan === 'stop') przycisk('▶ START', '#2e7d32', () => lec());
    else {
      przycisk(stan === 'pauza' ? '▶ WZNÓW' : '⏸ PAUZA', '#ef6c00', () => { stan = stan === 'pauza' ? 'lecimy' : 'pauza'; rysujPrzyciski(); });
      przycisk('⏹ STOP', '#c62828', stopKlik);
    }
  }

  function pole(etykieta, klucz, typ) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0';
    const s = document.createElement('span'); s.textContent = etykieta;
    const i = document.createElement('input');
    if (typ === 'check') {
      i.type = 'checkbox'; i.checked = !!cfg[klucz];
      i.onchange = () => { cfg[klucz] = i.checked; zapiszCfg(); };
    } else if (typ === 'text') {
      i.type = 'text'; i.value = cfg[klucz];
      i.style.cssText = 'width:120px;padding:3px 5px;border:1px solid #456;border-radius:5px;background:#101822;color:#fff;font:12px sans-serif';
      i.onchange = () => { cfg[klucz] = i.value.trim(); zapiszCfg(); };
    } else {
      i.type = 'number'; i.value = cfg[klucz]; i.min = '0';
      i.style.cssText = 'width:70px;padding:3px 5px;border:1px solid #456;border-radius:5px;background:#101822;color:#fff;font:12px sans-serif';
      i.onchange = () => { cfg[klucz] = liczba(i.value); zapiszCfg(); odswiezInfo(); };
    }
    wrap.append(s, i);
    return wrap;
  }

  let elInfo;
  function odswiezInfo() {
    if (!elInfo) return;
    const naStronie = wiersze().length;
    const l = licznik();
    const paczka = naStronie * cfg.stronNaPaczke;
    elInfo.innerHTML = '';
    const d1 = document.createElement('div');
    d1.textContent = 'Na stronie: ' + (naStronie || '?') + ' · w katalogu: ' + (l.razem || '?') + ' · zaznaczone: ' + l.wybrane;
    const d2 = document.createElement('div');
    d2.textContent = 'Paczka = ' + (paczka || '?') + ' pozycji';
    if (paczka > 10000) { d2.textContent += ' ⚠️ ponad limit 10k'; d2.style.color = '#ff8a80'; }
    else d2.style.color = '#9fd79f';
    elInfo.append(d1, d2);
  }

  function panel() {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999999;width:290px;background:#1e2a38;color:#e8eef5;'
      + 'font:12px/1.45 -apple-system,sans-serif;padding:11px 12px;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.55)';

    const tyt = document.createElement('div');
    tyt.textContent = '📦 Eksport katalogu paczkami';
    tyt.style.cssText = 'font:bold 13px sans-serif;margin-bottom:7px';

    elInfo = document.createElement('div');
    elInfo.style.cssText = 'font-size:11px;opacity:.9;margin-bottom:7px';

    const ust = document.createElement('div');
    ust.append(
      pole('Stron na paczkę', 'stronNaPaczke'),
      pole('Przerwa (ms)', 'przerwa'),
      pole('Czekaj po pobraniu (ms)', 'poPobraniu'),
      pole('Limit paczek (0=brak)', 'limitPaczek'),
      pole('Format CSV', 'format', 'text'),
      pole('Odznaczaj po pobraniu', 'odznaczaj', 'check'),
      pole('Powiadomienie ntfy', 'ntfy', 'check'),
    );

    elPostep = document.createElement('div');
    elPostep.textContent = 'Gotowy. Ustaw filtry i liczbę na stronie, potem START.';
    elPostep.style.cssText = 'margin:8px 0 6px;padding:6px 7px;background:#101822;border-radius:7px;font-size:11px;min-height:28px';

    elPrzyciski = document.createElement('div');
    elPrzyciski.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';

    elLog = document.createElement('div');
    elLog.style.cssText = 'max-height:120px;overflow:auto;font:10px/1.5 ui-monospace,monospace;opacity:.85;'
      + 'background:#101822;border-radius:7px;padding:5px 6px';

    p.append(tyt, elInfo, ust, elPostep, elPrzyciski, elLog);
    document.body.appendChild(p);
    rysujPrzyciski();
    odswiezInfo();
    setInterval(() => { if (stan === 'stop') odswiezInfo(); }, 2000);
  }

  // panel tylko na liście produktów katalogu
  (async () => {
    const ok = await czekajNa(() => $(SEL.btnZaznacz) && $(SEL.btnPobierz), 20000);
    if (ok) panel();
  })();
})();
