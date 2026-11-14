// ==UserScript==
// @name         Base eksport katalogu (paczki po 10k)
// @version      2026.11.14-3
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
    filtrujAuto: true,       // ustaw filtry przed startem
    reguly: 'Stan|Co najmniej|1\nEAN|Wartość niepusta|\nBłędy|Różne|Błąd synchronizacji stanu',
    naStronie: 1000,          // ile produktów na stronie ustawić przed startem (0 = nie ruszaj)
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
  const widoczny = el => {
    if (!el || !el.getClientRects().length) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  };
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

  // klik pozycji w rozwijanym menu (preferuje to, co pojawiło się PO kliknięciu)
  function kandydaci(szukaj, dokladnie) {
    const czysc = s => s.toLowerCase().replace(/[^0-9a-ząćęłńóśźż \-\[\]]/gi, '').replace(/\s+/g, ' ').trim();
    const szuk = czysc(szukaj);
    const lista = [...document.querySelectorAll('a, button, li, label, span, div')].filter(el => {
      if (!widoczny(el)) return false;
      const t = czysc(txt(el));
      if (!t) return false;
      return dokladnie ? t === szuk : t.includes(szuk);
    });
    // tylko najgłębsze trafienia (bez kontenerów opakowujących)
    return lista.filter(el => !lista.some(inny => inny !== el && el.contains(inny)));
  }

  async function klikMenu(btn, szukaj, dokladnie = false, opis = '') {
    if (!btn) throw new Error('brak przycisku menu' + (opis ? ' (' + opis + ')' : ''));
    const przed = new Set(kandydaci(szukaj, dokladnie));
    btn.click();
    const poz = await czekajNa(() => {
      const teraz = kandydaci(szukaj, dokladnie);
      return teraz.find(el => !przed.has(el)) || teraz[0] || null;
    }, 8000, 150);
    if (!poz) {
      diagnostyka(szukaj);
      throw new Error('nie znalazłem w menu: "' + szukaj + '"');
    }
    poz.click();
    return poz;
  }

  // wypisz do loga co w ogóle widać w otwartym menu – żeby było wiadomo czego szukać
  function diagnostyka(szukaj) {
    const widok = [...document.querySelectorAll('a, button, label, li')]
      .filter(el => widoczny(el) && txt(el).length > 1 && txt(el).length < 40 && el.getClientRects()[0].width < 420)
      .map(el => txt(el));
    const unikat = [...new Set(widok)].slice(0, 25);
    log('🔎 brak "' + szukaj + '". Widoczne pozycje: ' + unikat.join(' | '));
  }

  // ===================== FILTRY =====================
  // reguły w formacie:  Pole|Operacja|Wartość   (po jednej w linii, # = komentarz)
  function parsujReguly(tekst) {
    return String(tekst || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => { const cz = l.split('|').map(x => x.trim()); return { pole: cz[0], operacja: cz[1], wartosc: cz.slice(2).join('|').trim() }; })
      .filter(r => r.pole && r.operacja);
  }

  // wpisanie wartości tak, żeby jQuery/select2 to zauważyły
  function ustawPole(el, wartosc) {
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
    if (d && d.set) d.set.call(el, wartosc); else el.value = wartosc;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ustawSelect(sel, tekstOpcji) {
    const opcje = [...sel.options];
    const o = opcje.find(x => txt(x).toLowerCase() === tekstOpcji.toLowerCase())
      || opcje.find(x => txt(x).toLowerCase().includes(tekstOpcji.toLowerCase()));
    if (!o) throw new Error('operacja "' + tekstOpcji + '" niedostępna · jest: ' + opcje.map(x => txt(x)).join(' / '));
    sel.value = o.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // wybór z listy select2 (pole, wartość słownikowa)
  async function select2Wybierz(idKontenera, tekst) {
    const kont = document.getElementById(idKontenera);
    if (!kont) throw new Error('brak listy ' + idKontenera);
    kont.click();
    await spij(250);
    const szukajka = [...document.querySelectorAll('input.select2-search__field')].find(widoczny);
    if (szukajka) { ustawPole(szukajka, tekst.slice(0, 24)); await spij(400); }
    const wynik = await czekajNa(() => {
      const opcje = [...document.querySelectorAll('li.select2-results__option')].filter(widoczny)
        .filter(li => !/trwa wyszukiwanie|ładowanie|searching|loading/i.test(txt(li)));
      if (!opcje.length) return null;
      const n = tekst.toLowerCase();
      return opcje.find(li => txt(li).toLowerCase() === n) || opcje.find(li => txt(li).toLowerCase().includes(n)) || null;
    }, 8000, 150);
    if (!wynik) {
      const widok = [...document.querySelectorAll('li.select2-results__option')].filter(widoczny).map(li => txt(li)).slice(0, 15);
      log('🔎 brak opcji "' + tekst + '". Na liście: ' + widok.join(' | '));
      throw new Error('nie ma opcji "' + tekst + '"');
    }
    wynik.click();
    await spij(300);
  }

  async function ustawFiltry() {
    const reguly = parsujReguly(cfg.reguly);
    if (!reguly.length) { log('brak reguł filtrowania – pomijam'); return; }
    const jestPole1 = () => document.getElementById('select2-filter_field_1-container');

    if (!jestPole1()) {
      const btn = $('#table_inventory_products_container-filters-btn') || kandydaci('Filtrowanie produktów', true)[0];
      if (!btn) throw new Error('nie widzę przycisku "Filtrowanie produktów"');
      btn.click();
      await spij(700);
    }
    if (!jestPole1()) {
      const zaaw = [...document.querySelectorAll('a.btn_toggle_filtering_mode')].find(widoczny)
        || kandydaci('Filtrowanie zaawansowane', true)[0];
      if (zaaw) { zaaw.click(); await spij(700); }
    }
    if (!await czekajNa(jestPole1, 8000)) throw new Error('nie otworzyło się filtrowanie zaawansowane');

    // skasuj nadmiarowe warunki z poprzedniego razu
    for (let proba = 0; proba < 8; proba++) {
      const kasuj = [...document.querySelectorAll('a[class*=filter_remove], a[class*=filter_del], a[class*=filter_minus]')].filter(widoczny);
      if (kasuj.length <= reguly.length - 1) break;
      kasuj[kasuj.length - 1].click();
      await spij(300);
    }

    log('ustawiam filtry (' + reguly.length + ' warunków)');
    for (let i = 0; i < reguly.length; i++) {
      const nr = i + 1, r = reguly[i];
      if (!document.getElementById('select2-filter_field_' + nr + '-container')) {
        const oraz = [...document.querySelectorAll('a.btn_filter_add')].find(widoczny) || kandydaci('oraz', true)[0];
        if (!oraz) throw new Error('brak przycisku "oraz" przy warunku ' + nr);
        oraz.click();
        if (!await czekajNa(() => document.getElementById('select2-filter_field_' + nr + '-container'), 6000))
          throw new Error('nie pojawił się warunek ' + nr);
        await spij(300);
      }
      await select2Wybierz('select2-filter_field_' + nr + '-container', r.pole);

      const sel = await czekajNa(() => document.getElementById('filter_operation_' + nr), 6000);
      if (!sel) throw new Error('brak listy operacji przy warunku ' + nr);
      await spij(250);
      ustawSelect(sel, r.operacja);
      await spij(400);

      if (r.wartosc) {
        const input = document.getElementById('filter_value_' + nr);
        if (input && input.tagName === 'INPUT' && widoczny(input)) {
          input.click();
          ustawPole(input, r.wartosc);
        } else if (document.getElementById('select2-filter_value_' + nr + '-container')) {
          await select2Wybierz('select2-filter_value_' + nr + '-container', r.wartosc);
        } else {
          log('⚠️ warunek ' + nr + ' (' + r.pole + '): nie widzę pola na wartość "' + r.wartosc + '"');
        }
        await spij(300);
      }
      log('  ✓ ' + r.pole + ' · ' + r.operacja + (r.wartosc ? ' · ' + r.wartosc : ''));
    }

    const zapisz = [...document.querySelectorAll('a.btn_save_filters')].find(widoczny) || kandydaci('Ustaw filtry', true)[0];
    if (!zapisz) throw new Error('brak przycisku "Ustaw filtry"');
    const podpis = podpisTabeli();
    zapisz.click();
    await czekajNa(() => podpisTabeli() !== podpis, 25000, 300);
    await spij(1500);
    log('filtry ustawione · w katalogu: ' + (licznik().razem || '?'));
  }

  // ===================== KROKI =====================
  // ustaw liczbę produktów na stronie (kontrolka "50 z wielu" w stopce tabeli)
  async function ustawNaStronie(ile) {
    if (!ile) return;
    if (wiersze().length === ile) { log('na stronie już ' + ile + ' – pomijam'); return; }
    const stopka = $(SEL.kontener + ' .table-footer') || document.body;
    const kontrolka = [...stopka.querySelectorAll('a, button, label')]
      .find(el => widoczny(el) && /^\d+\s*(z wielu|\/)?/i.test(txt(el)) && /z wielu|na stron/i.test(txt(el)))
      || [...stopka.querySelectorAll('a.item-sm.w-sm, a.item-sm.item-transparent.w-sm')].find(widoczny);
    if (!kontrolka) { log('⚠️ nie widzę kontrolki ilości na stronie – ustaw ' + ile + ' ręcznie'); return; }
    log('ustawiam ' + ile + ' produktów na stronie');
    const podpis = podpisTabeli();
    await klikMenu(kontrolka, String(ile), true, 'ilość na stronie');
    const ok = await czekajNa(() => wiersze().length > 0 && podpisTabeli() !== podpis, 60000, 400);
    if (!ok) throw new Error('tabela nie przeładowała się po zmianie na ' + ile + '/stronę');
    await spij(Math.max(cfg.settle, 1500));
    const teraz = wiersze().length;
    if (teraz !== ile) log('⚠️ na stronie jest ' + teraz + ' zamiast ' + ile);
  }

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
    try {
      if (licznik().wybrane > 0) { log('czyszczę stare zaznaczenie'); await odznaczWszystko(); }
      if (cfg.filtrujAuto) await ustawFiltry();
      await ustawNaStronie(cfg.naStronie);
    } catch (e) {
      log('❌ błąd przy przygotowaniu: ' + e.message);
      postep('Błąd – zatrzymane'); stan = 'stop'; rysujPrzyciski(); return;
    }
    const l0 = licznik();
    const naStronie = wiersze().length || cfg.naStronie || 1000;
    const stronWszystkich = l0.razem ? Math.ceil(l0.razem / naStronie) : 0;
    log('▶️ start · ' + naStronie + '/stronę · ' + cfg.stronNaPaczke + ' stron na paczkę ('
      + (naStronie * cfg.stronNaPaczke) + ' poz.) · w katalogu: ' + (l0.razem || '?'));

    try {
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

  function poleObszar(etykieta, klucz) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin:5px 0';
    const s1 = document.createElement('div');
    s1.textContent = etykieta;
    s1.style.cssText = 'margin-bottom:3px';
    const t = document.createElement('textarea');
    t.value = cfg[klucz] || '';
    t.rows = 3;
    t.spellcheck = false;
    t.style.cssText = 'width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid #456;border-radius:6px;'
      + 'background:#101822;color:#fff;font:11px/1.4 ui-monospace,monospace;resize:vertical';
    t.onchange = () => { cfg[klucz] = t.value; zapiszCfg(); };
    wrap.append(s1, t);
    return wrap;
  }

  let elInfo;
  function odswiezInfo() {
    if (!elInfo) return;
    const teraz = wiersze().length;
    const naStronie = cfg.naStronie || teraz;
    const l = licznik();
    const paczka = naStronie * cfg.stronNaPaczke;
    elInfo.innerHTML = '';
    const d1 = document.createElement('div');
    d1.textContent = 'Na stronie: ' + (teraz || '?') + (cfg.naStronie && teraz !== cfg.naStronie ? ' → ustawię ' + cfg.naStronie : '')
      + ' · w katalogu: ' + (l.razem || '?') + ' · zaznaczone: ' + l.wybrane;
    const d2 = document.createElement('div');
    d2.textContent = 'Paczka = ' + (paczka || '?') + ' pozycji';
    if (paczka > 10000) { d2.textContent += ' ⚠️ ponad limit 10k'; d2.style.color = '#ff8a80'; }
    else d2.style.color = '#9fd79f';
    elInfo.append(d1, d2);
  }

  function panel() {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999999;width:310px;background:#1e2a38;color:#e8eef5;'
      + 'font:12px/1.45 -apple-system,sans-serif;padding:11px 12px;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.55)';

    const tyt = document.createElement('div');
    tyt.textContent = '📦 Eksport katalogu paczkami';
    tyt.style.cssText = 'font:bold 13px sans-serif;margin-bottom:7px';

    elInfo = document.createElement('div');
    elInfo.style.cssText = 'font-size:11px;opacity:.9;margin-bottom:7px';

    const ust = document.createElement('div');
    ust.append(
      pole('Ustaw filtry automatycznie', 'filtrujAuto', 'check'),
      poleObszar('Filtry (Pole|Operacja|Wartość)', 'reguly'),
      pole('Produktów na stronie', 'naStronie'),
      pole('Stron na paczkę', 'stronNaPaczke'),
      pole('Przerwa (ms)', 'przerwa'),
      pole('Czekaj po pobraniu (ms)', 'poPobraniu'),
      pole('Limit paczek (0=brak)', 'limitPaczek'),
      pole('Format CSV', 'format', 'text'),
      pole('Odznaczaj po pobraniu', 'odznaczaj', 'check'),
      pole('Powiadomienie ntfy', 'ntfy', 'check'),
    );

    elPostep = document.createElement('div');
    elPostep.textContent = 'Gotowy. Ustaw filtry w katalogu, potem START.';
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
