// ==UserScript==
// @name         Base eksport katalogu (paczki po 10k)
// @version      2026.11.14-9
// @description  Ustawia katalog, filtry i 1000/stronę, zaznacza kolejne strony i pobiera CSV paczkami po max 10k
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

  // ===================== SELEKTORY (sprawdzone na żywo w Base) =====================
  const SEL = {
    kontener: '#table_inventory_products_container',
    btnZaznacz: '#table_inventory_products_containerDropdownCheck',
    btnPobierz: '#inventoryDropdownExports',
    wybrane: '#table_inventory_products_container_selection_info_selected',
    razem: '#table_inventory_products_container_selection_info_items_count',
    katalog: '#inventory-option-catalog',
    btnFiltry: '#table_inventory_products_container-filters-btn',
  };

  // ===================== USTAWIENIA =====================
  const KLUCZ = 'baseEksportKatalogu';
  const KLUCZ_STAN = 'baseEksportKatalogu_stan';
  const KLUCZ_LOG = 'baseEksportKatalogu_log';
  const KLUCZ_POZ = 'baseEksportKatalogu_pozycja';
  const DOMYSLNE = {
    katalog: '',              // nazwa katalogu Base (puste = zostaw bieżący)
    filtrujAuto: true,
    reguly: 'Stan|Co najmniej|1\nEAN|Wartość niepusta|\nBłędy|Różne|Błąd synchronizacji stanu',
    naStronie: 1000,          // produktów na stronie (0 = nie zmieniaj)
    stronNaPaczke: 10,        // 10 x 1000 = 10k na plik
    odStrony: 0,              // od której strony zacząć (0 = od pierwszej)
    format: 'ID-NAZWA-EAN-SKU',
    przerwa: 900,
    poPobraniu: 6000,
    settle: 700,
    limitPaczek: 0,
    ntfy: false,
  };
  let cfg = Object.assign({}, DOMYSLNE);
  try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(KLUCZ) || '{}')); } catch {}
  const zapiszCfg = () => { try { localStorage.setItem(KLUCZ, JSON.stringify(cfg)); } catch {} };

  // stan przeżywa przeładowanie strony (reload jest jedynym sposobem na wyczyszczenie zaznaczenia)
  const czytajStan = () => { try { return JSON.parse(localStorage.getItem(KLUCZ_STAN) || 'null'); } catch { return null; } };
  const zapiszStan = s => { try { s ? localStorage.setItem(KLUCZ_STAN, JSON.stringify(s)) : localStorage.removeItem(KLUCZ_STAN); } catch {} };

  // ===================== NARZĘDZIA =====================
  const $ = (s, root = document) => root.querySelector(s);
  const spij = ms => new Promise(r => setTimeout(r, ms));
  const txt = el => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  const liczba = s => parseInt(String(s || '').replace(/[^\d]/g, ''), 10) || 0;

  // Base trzyma w DOM ukryte kopie menu (wersja mobilna) – liczy się realny rozmiar
  const widoczny = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  };
  // select2 i menu Base reagują na mousedown, samo .click() ich nie otwiera
  const mysz = el => ['mousedown', 'mouseup', 'click']
    .forEach(t => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })));

  async function czekajNa(fn, limitMs = 15000, krok = 200) {
    const koniec = Date.now() + limitMs;
    for (;;) {
      let w; try { w = fn(); } catch { w = null; }
      if (w) return w;
      if (Date.now() > koniec) return null;
      await spij(krok);
    }
  }

  const licznik = () => ({ wybrane: liczba(txt($(SEL.wybrane))), razem: liczba(txt($(SEL.razem))) });
  const wiersze = () => [...document.querySelectorAll(SEL.kontener + ' table tbody tr')]
    .filter(tr => tr.querySelector('input[type=checkbox]'));
  const podpisTabeli = () => { const w = wiersze(); return w.length ? w.length + '|' + (w[0].getAttribute('data-id') || txt(w[0]).slice(0, 60)) : ''; };
  const razemWKatalogu = () => {
    const z = liczba(txt($('.table_pager_all_items_counter')));
    if (z) return z;
    const k = kontrolkaIlosci();
    return k ? liczba(txt(k).split(/\s+z\s+/i)[1]) : 0;
  };
  const ostatniaStronaPagera = () => {
    const nry = [...document.querySelectorAll('ul.pager_container a')].filter(widoczny).map(a => liczba(txt(a))).filter(n => n > 0);
    return nry.length ? Math.max(...nry) : 0;
  };
  const kontrolkaIlosci = () => [...document.querySelectorAll('a, span, label')]
    .find(el => widoczny(el) && /^\d+\s+z\s+(\d+|wielu)$/i.test(txt(el)));
  const iloscNaStronie = () => { const k = kontrolkaIlosci(); return k ? liczba(txt(k).split(/\s+z\s+/i)[0]) : 0; };
  const pierwszyWiersz = () => { const w = wiersze()[0]; return w ? (w.getAttribute('data-id') || txt(w).slice(0, 40)) : ''; };
  const aktualnaStrona = () => liczba(txt([...document.querySelectorAll('ul.pager_container li.active')].find(widoczny))) || 0;

  function ustawWartosc(el, w) {
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
    if (d && d.set) d.set.call(el, w); else el.value = w;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ===================== MENU =====================
  // pozycja menu Zaznacz/Odznacz – przycisk trzeba brać świeżo, bo tabela przebudowuje DOM
  async function pozycjaZaznaczania(nazwa) {
    const btn = $(SEL.btnZaznacz);
    if (!btn) throw new Error('nie widzę przycisku "Zaznacz"');
    mysz(btn);
    await spij(400);
    const poz = await czekajNa(() => [...document.querySelectorAll('a.fa-stack-wrapper')].filter(widoczny).find(a => txt(a) === nazwa), 5000);
    if (!poz) {
      log('🔎 w menu widzę: ' + [...document.querySelectorAll('a.fa-stack-wrapper')].filter(widoczny).map(txt).join(' | '));
      throw new Error('brak pozycji "' + nazwa + '"');
    }
    return poz;
  }

  function kandydaci(szukaj, dokladnie) {
    const czysc = s => s.toLowerCase().replace(/[^0-9a-ząćęłńóśźż \-\[\]]/gi, '').replace(/\s+/g, ' ').trim();
    const szuk = czysc(szukaj);
    const lista = [...document.querySelectorAll('a, button, li, label, span')].filter(el => {
      if (!widoczny(el)) return false;
      const t = czysc(txt(el));
      return t && (dokladnie ? t === szuk : t.includes(szuk));
    });
    return lista.filter(el => !lista.some(inny => inny !== el && el.contains(inny)));
  }

  async function klikMenu(btn, szukaj, dokladnie = false) {
    if (!btn) throw new Error('brak przycisku menu');
    const przed = new Set(kandydaci(szukaj, dokladnie));
    mysz(btn);
    const poz = await czekajNa(() => {
      const teraz = kandydaci(szukaj, dokladnie);
      return teraz.find(el => !przed.has(el)) || teraz[0] || null;
    }, 8000, 150);
    if (!poz) throw new Error('nie znalazłem w menu: "' + szukaj + '"');
    mysz(poz);
    return poz;
  }

  // ===================== STRONY =====================
  function linkNastepna() {
    for (const ul of [...document.querySelectorAll('ul.pager_container')].filter(widoczny)) {
      const a = [...ul.querySelectorAll('a')].find(x => widoczny(x)
        && (x.classList.contains('pager_item_next_page') || x.querySelector('i[class*=chevron-right]')));
      if (a) {
        const i = a.querySelector('i');
        const wyl = (i && String(i.className).includes('text-muted')) || a.classList.contains('disabled');
        return { a, wyl: !!wyl };
      }
    }
    return null;
  }

  async function czekajNaStrone(nr, ile) {
    for (let proba = 0; proba < 3; proba++) {
      const id = await czekajNa(() => {
        if (nr && aktualnaStrona() !== nr) return null;
        const w = wiersze();
        if (!w.length) return null;
        if (ile && w.length !== ile) return null;
        return pierwszyWiersz() || null;
      }, 60000, 300);
      if (!id) throw new Error('strona ' + nr + ' się nie wczytała (widzę stronę ' + aktualnaStrona() + ', wierszy ' + wiersze().length + ' z ' + ile + ')');
      await spij(Math.max(cfg.settle, 600));
      if (pierwszyWiersz() === id && (!ile || wiersze().length === ile)) return true;
    }
    throw new Error('strona ' + nr + ' ciągle się przeładowuje');
  }

  async function nastepnaStrona() {
    const n = linkNastepna();
    if (!n || n.wyl) return false;
    const podpis = podpisTabeli();
    mysz(n.a);
    if (!await czekajNa(() => wiersze().length > 0 && podpisTabeli() !== podpis, 30000, 300))
      throw new Error('strona się nie przeładowała');
    await spij(cfg.settle);
    return true;
  }

  // skok na konkretną stronę przez "..." → pole "Idź do strony"
  async function skokDoStrony(nr) {
    if (aktualnaStrona() === nr) return true;
    const kropki = [...document.querySelectorAll('ul.pager_container a')].find(a => widoczny(a) && txt(a) === '...');
    if (!kropki) return false;
    const podpis = podpisTabeli();
    mysz(kropki);
    await spij(600);
    const inp = await czekajNa(() => [...document.querySelectorAll('input[id*=PageChoice]')].find(widoczny), 5000);
    if (!inp) return false;
    ustawWartosc(inp, String(nr));
    ['keydown', 'keypress', 'keyup'].forEach(t => inp.dispatchEvent(new KeyboardEvent(t, { bubbles: true, key: 'Enter', keyCode: 13, which: 13 })));
    const ok = await czekajNa(() => wiersze().length > 0 && podpisTabeli() !== podpis, 30000, 300);
    await spij(cfg.settle);
    return !!ok && aktualnaStrona() === nr;
  }

  async function naStroneNr(nr) {
    if (aktualnaStrona() === nr) return true;
    if (await skokDoStrony(nr)) return true;
    log('skok nie wyszedł – przewijam po jednej stronie');
    let bezpiecznik = 0;
    while (aktualnaStrona() < nr && bezpiecznik++ < 200) {
      if (!await nastepnaStrona()) return false;
    }
    return aktualnaStrona() === nr;
  }

  async function przejdzNaStrone(nr, ile) {
    if (aktualnaStrona() !== nr) {
      if (aktualnaStrona() + 1 === nr) {
        if (!await nastepnaStrona()) throw new Error('nie ma linku na stronę ' + nr);
      } else if (!await naStroneNr(nr)) {
        throw new Error('nie dotarłem na stronę ' + nr);
      }
    }
    await czekajNaStrone(nr, ile || null);
    return true;
  }

  const jestOstatniaStrona = () => { const n = linkNastepna(); return !n || n.wyl; };

  // ile pozycji ma bieżąca strona: pełne strony = rozmiar strony, ostatnia = tyle ile się wczytało
  async function ileNaTejStronie(nr) {
    const rozmiar = iloscNaStronie() || cfg.naStronie || 0;
    if (!jestOstatniaStrona() && rozmiar) { await czekajNaStrone(nr, rozmiar); return rozmiar; }
    // ostatnia strona (albo nieznany rozmiar) – czekaj aż liczba wierszy przestanie się zmieniać
    await czekajNaStrone(nr, null);
    let ile = wiersze().length;
    for (;;) { await spij(800); const t = wiersze().length; if (t === ile) break; ile = t; }
    if (!ile) throw new Error('strona ' + nr + ' jest pusta');
    return ile;
  }

  // ===================== PRZYGOTOWANIE =====================
  async function ustawKatalog(nazwa) {
    if (!nazwa) return;
    const sel = $(SEL.katalog);
    if (!sel) { log('⚠️ nie widzę listy katalogów'); return; }
    if (txt(sel.selectedOptions[0]) === nazwa) { log('katalog już ustawiony: ' + nazwa); return; }
    const o = [...sel.options].find(x => txt(x) === nazwa) || [...sel.options].find(x => txt(x).toLowerCase() === nazwa.toLowerCase());
    if (!o) {
      log('🔎 brak katalogu "' + nazwa + '". Są m.in.: ' + [...sel.options].map(txt).slice(0, 15).join(' | '));
      throw new Error('nie ma katalogu "' + nazwa + '"');
    }
    const podpis = podpisTabeli();
    sel.value = o.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await czekajNa(() => wiersze().length > 0 && podpisTabeli() !== podpis, 30000, 300);
    await spij(1200);
    log('katalog: ' + nazwa);
  }

  function parsujReguly(tekst) {
    return String(tekst || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => { const c = l.split('|').map(x => x.trim()); return { pole: c[0], operacja: c[1], wartosc: c.slice(2).join('|').trim() }; })
      .filter(r => r.pole && r.operacja);
  }

  async function select2Wybierz(id, tekst) {
    const kont = document.getElementById(id);
    if (!kont) throw new Error('brak listy ' + id);
    mysz(kont.closest('.select2-selection') || kont);
    await spij(350);
    const szukajka = [...document.querySelectorAll('input.select2-search__field')].find(widoczny);
    if (szukajka) { ustawWartosc(szukajka, tekst.slice(0, 24)); await spij(500); }
    const cel = await czekajNa(() => {
      const o = [...document.querySelectorAll('li.select2-results__option')].filter(widoczny)
        .filter(li => !/trwa wyszukiwanie|ładowanie|searching/i.test(txt(li)));
      if (!o.length) return null;
      const n = tekst.toLowerCase();
      return o.find(li => txt(li).toLowerCase() === n) || o.find(li => txt(li).toLowerCase().includes(n)) || null;
    }, 8000, 150);
    if (!cel) {
      log('🔎 brak opcji "' + tekst + '". Na liście: ' + [...document.querySelectorAll('li.select2-results__option')].filter(widoczny).map(txt).slice(0, 10).join(' | '));
      throw new Error('nie ma opcji "' + tekst + '"');
    }
    mysz(cel);
    await spij(400);
    return txt(cel);
  }

  function ustawSelect(sel, tekstOpcji) {
    const opcje = [...sel.options];
    const o = opcje.find(x => txt(x).toLowerCase() === tekstOpcji.toLowerCase())
      || opcje.find(x => txt(x).toLowerCase().includes(tekstOpcji.toLowerCase()));
    if (!o) throw new Error('operacja "' + tekstOpcji + '" niedostępna · jest: ' + opcje.map(txt).join(' / '));
    sel.value = o.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return txt(o);
  }

  async function ustawFiltry() {
    const reguly = parsujReguly(cfg.reguly);
    if (!reguly.length) { log('brak reguł filtrowania – pomijam'); return; }
    // UWAGA: pola trybu zaawansowanego są w DOM także w trybie podstawowym – liczy się widoczność
    const polaWidoczne = () => { const e = document.getElementById('select2-filter_field_1-container'); return e && widoczny(e) ? e : null; };

    if (!polaWidoczne()) {
      const btn = $(SEL.btnFiltry) || kandydaci('Filtrowanie produktów', true)[0];
      if (!btn) throw new Error('nie widzę przycisku "Filtrowanie produktów"');
      mysz(btn);
      await spij(900);
    }
    if (!polaWidoczne()) {
      const zaaw = [...document.querySelectorAll('a.btn_toggle_filtering_mode')].find(widoczny)
        || kandydaci('Filtrowanie zaawansowane', true)[0];
      if (!zaaw) throw new Error('nie widzę przełącznika "Filtrowanie zaawansowane"');
      mysz(zaaw);
      await czekajNa(polaWidoczne, 8000);
      await spij(600);
    }
    if (!polaWidoczne()) throw new Error('nie otworzyło się filtrowanie zaawansowane');

    log('ustawiam filtry (' + reguly.length + ')');
    for (let i = 0; i < reguly.length; i++) {
      const nr = i + 1, r = reguly[i];
      const jestWarunek = () => { const e = document.getElementById('select2-filter_field_' + nr + '-container'); return e && widoczny(e) ? e : null; };
      if (!jestWarunek()) {
        const oraz = [...document.querySelectorAll('a.btn_filter_add')].find(widoczny) || kandydaci('oraz', true)[0];
        if (!oraz) throw new Error('brak przycisku "oraz" przy warunku ' + nr);
        mysz(oraz);
        if (!await czekajNa(jestWarunek, 6000)) throw new Error('nie pojawił się warunek ' + nr);
        await spij(350);
      }
      await select2Wybierz('select2-filter_field_' + nr + '-container', r.pole);
      const sel = await czekajNa(() => { const e = document.getElementById('filter_operation_' + nr); return e && widoczny(e) ? e : null; }, 6000);
      if (!sel) throw new Error('brak listy operacji przy warunku ' + nr);
      await spij(300);
      ustawSelect(sel, r.operacja);
      await spij(600);
      if (r.wartosc) {
        const inp = await czekajNa(() => { const e = document.getElementById('filter_value_' + nr); return e && e.tagName === 'INPUT' && widoczny(e) ? e : null; }, 4000);
        const lista = document.getElementById('select2-filter_value_' + nr + '-container');
        if (inp) { mysz(inp); ustawWartosc(inp, r.wartosc); }
        else if (lista && widoczny(lista)) await select2Wybierz('select2-filter_value_' + nr + '-container', r.wartosc);
        else log('⚠️ warunek ' + nr + ': nie widzę pola na wartość');
        await spij(400);
      }
      log('  ✓ ' + r.pole + ' · ' + r.operacja + (r.wartosc ? ' · ' + r.wartosc : ''));
    }

    const zapisz = [...document.querySelectorAll('a.btn_save_filters')].find(widoczny) || kandydaci('Ustaw filtry', true)[0];
    if (!zapisz) throw new Error('brak przycisku "Ustaw filtry"');
    const podpis = podpisTabeli();
    mysz(zapisz);
    await czekajNa(() => podpisTabeli() !== podpis, 25000, 300);
    await spij(1500);
    // zamknij panel, bo zasłania tabelę
    const zamknij = [...document.querySelectorAll('a.rds-close, .closing-trigger-filters')].find(widoczny);
    if (zamknij) { mysz(zamknij); await spij(800); }
    log('filtry ustawione');
  }

  async function ustawNaStronie(ile) {
    if (!ile || iloscNaStronie() === ile) return;
    const kontrolka = kontrolkaIlosci();
    if (!kontrolka) { log('⚠️ nie widzę kontrolki „Produktów na stronę" – ustaw ' + ile + ' ręcznie'); return; }
    const podpis = podpisTabeli();
    await klikMenu(kontrolka, String(ile), true);
    if (!await czekajNa(() => wiersze().length > 0 && iloscNaStronie() === ile && podpisTabeli() !== podpis, 60000, 400))
      throw new Error('tabela nie przeładowała się po zmianie na ' + ile + '/stronę');
    await spij(Math.max(cfg.settle, 1500));
    log(iloscNaStronie() + ' produktów na stronie');
  }

  // Base po zmianie filtrów pokazuje "z wielu" – sumę podaje dopiero przy zaznaczeniu.
  // Zaznaczamy więc jedną stronę, odczytujemy sumę i od razu odznaczamy.
  async function policzPozycje() {
    if (razemWKatalogu() > 0) return razemWKatalogu();
    await czekajNa(() => razemWKatalogu() > 0, 8000, 500);
    if (razemWKatalogu() > 0) return razemWKatalogu();
    log('liczę pozycje w katalogu…');
    const poz = await pozycjaZaznaczania('Zaznacz wszystkie');
    mysz(poz);
    await czekajNa(() => licznik().razem > 0, 20000, 300);
    const suma = licznik().razem || razemWKatalogu();
    const od = await pozycjaZaznaczania('Odznacz wszystkie');
    mysz(od);
    await czekajNa(() => licznik().wybrane === 0, 15000, 300);
    await spij(600);
    return suma;
  }

  // ===================== KROKI PĘTLI =====================
  async function zaznaczStrone(oczekiwane) {
    const przed = licznik().wybrane;
    for (let proba = 1; proba <= 3; proba++) {
      const poz = await pozycjaZaznaczania('Zaznacz wszystkie');
      mysz(poz);
      if (await czekajNa(() => licznik().wybrane >= przed + oczekiwane, 30000, 250)) break;
      log('⚠️ strona ' + aktualnaStrona() + ': zaznaczyło ' + (licznik().wybrane - przed) + '/' + oczekiwane + ' – powtarzam (' + proba + '/3)');
      await spij(2000);
    }
    // licznik Base dolicza się chwilę – poczekaj aż przestanie rosnąć
    let stabilny = licznik().wybrane;
    for (;;) { await spij(700); const t = licznik().wybrane; if (t === stabilny) break; stabilny = t; }
    const delta = stabilny - przed;
    if (delta < oczekiwane) throw new Error('strona ' + aktualnaStrona() + ': zaznaczone ' + delta + ' z ' + oczekiwane);
    return stabilny;
  }

  async function pobierzCsv() {
    await klikMenu($(SEL.btnPobierz), cfg.format, false);
    await spij(cfg.poPobraniu);
  }

  // ===================== PĘTLA (przeżywa przeładowanie) =====================
  let stan = 'stop';
  const czekajJakPauza = async () => { while (stan === 'pauza') await spij(300); return stan === 'lecimy'; };

  async function lec(wznowienie = false) {
    stan = 'lecimy';
    rysujPrzyciski();
    let s = czytajStan();
    if (!wznowienie || !s) {
      s = { paczka: 0, stronaStart: Math.max(1, cfg.odStrony || 1), pozycji: 0, start: Date.now() };
      zapiszStan(s);
    }

    try {
      if (!wznowienie) {
        await ustawKatalog((cfg.katalog || '').trim());
        if (cfg.filtrujAuto) await ustawFiltry();
        await ustawNaStronie(cfg.naStronie);
        const ile = await policzPozycje();
        const rozm = iloscNaStronie() || cfg.naStronie;
        log('📊 z tymi filtrami: ' + (ile || '?') + ' pozycji' + (ile && rozm ? ' · ' + Math.ceil(ile / rozm) + ' stron · ' + Math.ceil(ile / (rozm * cfg.stronNaPaczke)) + ' plików' : ''));
      } else {
        log('▶️ wznawiam po przeładowaniu – paczka ' + (s.paczka + 1) + ', od strony ' + s.stronaStart);
        if (cfg.naStronie && iloscNaStronie() !== cfg.naStronie) await ustawNaStronie(cfg.naStronie);
      }

      if (licznik().wybrane > 0) { log('zostało stare zaznaczenie – przeładowuję'); return przeladuj(s); }

      for (;;) {
        if (!await czekajJakPauza()) throw new Error('STOP');

        const razem = await policzPozycje();
        const stronWszystkich = razem && iloscNaStronie() ? Math.ceil(razem / iloscNaStronie()) : ostatniaStronaPagera();
        const opisStron = stronWszystkich || '?';
        const doStrony = s.stronaStart + cfg.stronNaPaczke - 1;
        log('📄 paczka ' + (s.paczka + 1) + ': strony ' + s.stronaStart + '-' + doStrony
          + ' z ' + opisStron + (razem ? ' (w katalogu ' + razem + ')' : ''));

        let oczekiwaneRazem = 0, koniecKatalogu = false, ostatniaPobrana = s.stronaStart;
        for (let nr = s.stronaStart; nr <= doStrony; nr++) {
          if (!await czekajJakPauza()) throw new Error('STOP');
          await przejdzNaStrone(nr, null);
          const ile = await ileNaTejStronie(nr);
          const odcisk = pierwszyWiersz();
          s.odciski = s.odciski || {};
          const byla = s.odciski[odcisk];
          if (byla && byla !== nr) throw new Error('strona ' + nr + ' ma tę samą zawartość co strona ' + byla + ' – przerywam, żeby nie pobrać dwa razy tego samego');
          s.odciski[odcisk] = nr;
          const wyb = await zaznaczStrone(ile);
          oczekiwaneRazem += ile;
          ostatniaPobrana = nr;
          postep('Paczka ' + (s.paczka + 1) + ' · strona ' + nr + '/' + opisStron + ' · zaznaczone ' + wyb);
          if (wyb !== oczekiwaneRazem) throw new Error('po stronie ' + nr + ' zaznaczone ' + wyb + ', powinno być ' + oczekiwaneRazem);
          if (jestOstatniaStrona()) { koniecKatalogu = true; log('ostatnia strona katalogu (' + nr + ')'); break; }
          await spij(cfg.przerwa);
        }

        const wybrane = licznik().wybrane;
        if (!wybrane) throw new Error('nic nie jest zaznaczone – nie pobieram');
        if (wybrane !== oczekiwaneRazem) throw new Error('przed pobraniem zaznaczone ' + wybrane + ' zamiast ' + oczekiwaneRazem);

        s.paczka++; s.pozycji += wybrane;
        log('⬇️ paczka ' + s.paczka + ': pobieram ' + wybrane + ' poz. (strony ' + s.stronaStart + '-' + ostatniaPobrana + ')');
        await pobierzCsv();
        log('✅ paczka ' + s.paczka + ' · razem ' + s.pozycji + (razem ? '/' + razem : ''));

        s.stronaStart = ostatniaPobrana + 1;
        if (koniecKatalogu || (cfg.limitPaczek && s.paczka >= cfg.limitPaczek)) {
          const brak = razem ? razem - s.pozycji : 0;
          postep('Gotowe · ' + s.paczka + ' plików · ' + s.pozycji + ' pozycji');
          log('🏁 koniec: ' + s.paczka + ' plików, ' + s.pozycji + (razem ? ' z ' + razem : '') + ' pozycji'
            + (koniecKatalogu && brak > 0 ? ' ⚠️ brakuje ' + brak : ''));
          powiadom('✅ Base eksport katalogu', s.paczka + ' plików, ' + s.pozycji + ' pozycji');
          zapiszStan(null);
          break;
        }
        // Base czyści całe zaznaczenie tylko przy przeładowaniu strony
        return przeladuj(s);
      }
    } catch (e) {
      if (String(e.message) === 'STOP') { log('⏹ zatrzymane ręcznie'); zapiszStan(null); }
      else {
        log('❌ błąd: ' + e.message);
        postep('Błąd – zatrzymane (stan zapisany, START wznowi)');
        powiadom('❌ Base eksport katalogu', 'Błąd: ' + e.message);
      }
    } finally {
      stan = 'stop';
      rysujPrzyciski();
    }
  }

  function przeladuj(s) {
    s.ostatni = Date.now();
    zapiszStan(s);
    log('↻ przeładowuję, żeby wyczyścić zaznaczenie…');
    postep('Przeładowanie · dalej od strony ' + s.stronaStart);
    setTimeout(() => location.reload(), 1200);
  }

  function powiadom(tytul, tresc) {
    if (!cfg.ntfy) return;
    const temat = localStorage.getItem('autoNtfyTemat');
    if (!temat) return;
    fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({ topic: temat, title: tytul, message: tresc, priority: 3, tags: ['inbox_tray'] }) }).catch(() => {});
  }

  // ===================== PANEL =====================
  let elLog, elPostep, elPrzyciski, elInfo;
  function log(t) {
    const wpis = new Date().toTimeString().slice(0, 8) + ' ' + t;
    try {
      const h = JSON.parse(localStorage.getItem(KLUCZ_LOG) || '[]');
      h.push(wpis); while (h.length > 60) h.shift();
      localStorage.setItem(KLUCZ_LOG, JSON.stringify(h));
    } catch {}
    if (elLog) { const d = document.createElement('div'); d.textContent = wpis; elLog.appendChild(d); elLog.scrollTop = elLog.scrollHeight; }
    console.log('[EksportKatalogu] ' + t);
  }
  const postep = t => { if (elPostep) elPostep.textContent = t; };

  function rysujPrzyciski() {
    if (!elPrzyciski) return;
    elPrzyciski.innerHTML = '';
    const dodaj = (tekst, kolor, fn) => {
      const b = document.createElement('button');
      b.textContent = tekst;
      b.style.cssText = 'flex:1;padding:7px 4px;border:0;border-radius:7px;font:bold 12px sans-serif;color:#fff;cursor:pointer;background:' + kolor;
      b.onclick = fn;
      elPrzyciski.appendChild(b);
    };
    if (stan === 'stop') {
      const s = czytajStan();
      dodaj(s ? '▶ WZNÓW (str. ' + s.stronaStart + ')' : '▶ START', '#2e7d32', () => lec(!!s));
      if (s) dodaj('✖ reset', '#546e7a', () => { zapiszStan(null); log('stan skasowany'); rysujPrzyciski(); });
    } else {
      dodaj(stan === 'pauza' ? '▶ WZNÓW' : '⏸ PAUZA', '#ef6c00', () => { stan = stan === 'pauza' ? 'lecimy' : 'pauza'; rysujPrzyciski(); });
      dodaj('⏹ STOP', '#c62828', () => { stan = 'stop'; });
    }
  }

  function pole(etykieta, klucz, typ) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0';
    const s = document.createElement('span'); s.textContent = etykieta;
    const i = document.createElement('input');
    if (typ === 'check') { i.type = 'checkbox'; i.checked = !!cfg[klucz]; i.onchange = () => { cfg[klucz] = i.checked; zapiszCfg(); }; }
    else if (typ === 'text') {
      i.type = 'text'; i.value = cfg[klucz];
      i.style.cssText = 'width:140px;padding:3px 5px;border:1px solid #456;border-radius:5px;background:#101822;color:#fff;font:12px sans-serif';
      i.onchange = () => { cfg[klucz] = i.value.trim(); zapiszCfg(); odswiezInfo(); };
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
    const s = document.createElement('div'); s.textContent = etykieta; s.style.cssText = 'margin-bottom:3px';
    const t = document.createElement('textarea');
    t.value = cfg[klucz] || ''; t.rows = 3; t.spellcheck = false;
    t.style.cssText = 'width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid #456;border-radius:6px;background:#101822;color:#fff;font:11px/1.4 ui-monospace,monospace;resize:vertical';
    t.onchange = () => { cfg[klucz] = t.value; zapiszCfg(); };
    wrap.append(s, t);
    return wrap;
  }

  function odswiezInfo() {
    if (!elInfo) return;
    const teraz = iloscNaStronie() || wiersze().length;
    const naStronie = cfg.naStronie || teraz;
    const l = licznik();
    const paczka = naStronie * cfg.stronNaPaczke;
    elInfo.innerHTML = '';
    const d1 = document.createElement('div');
    const wKatalogu = razemWKatalogu() || l.razem;
    d1.textContent = 'W katalogu: ' + (wKatalogu || '?') + ' · na stronie: ' + (teraz || '?')
      + ' · strona ' + (aktualnaStrona() || '?') + ' · zaznaczone: ' + l.wybrane;
    const d2 = document.createElement('div');
    d2.textContent = 'Paczka = ' + (paczka || '?') + ' pozycji';
    if (paczka > 10000) { d2.textContent += ' ⚠️ ponad limit 10k'; d2.style.color = '#ff8a80'; } else d2.style.color = '#9fd79f';
    elInfo.append(d1, d2);
  }

  function panel() {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999999;width:310px;background:#1e2a38;color:#e8eef5;'
      + 'font:12px/1.45 -apple-system,sans-serif;padding:11px 12px;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.55)';
    const tyt = document.createElement('div');
    tyt.textContent = '⠿ Eksport katalogu paczkami';
    tyt.title = 'Przeciągnij, żeby przesunąć';
    tyt.style.cssText = 'font:bold 13px sans-serif;margin:-11px -12px 7px;padding:9px 12px 7px;cursor:grab;'
      + 'border-radius:12px 12px 0 0;background:#24374b;user-select:none';
    elInfo = document.createElement('div');
    elInfo.style.cssText = 'font-size:11px;opacity:.9;margin-bottom:7px';
    const ust = document.createElement('div');
    ust.append(
      pole('Katalog (puste = bieżący)', 'katalog', 'text'),
      pole('Ustaw filtry automatycznie', 'filtrujAuto', 'check'),
      poleObszar('Filtry (Pole|Operacja|Wartość)', 'reguly'),
      pole('Produktów na stronie', 'naStronie'),
      pole('Stron na paczkę', 'stronNaPaczke'),
      pole('Zacznij od strony (0=1)', 'odStrony'),
      pole('Przerwa (ms)', 'przerwa'),
      pole('Czekaj po pobraniu (ms)', 'poPobraniu'),
      pole('Limit paczek (0=brak)', 'limitPaczek'),
      pole('Format CSV', 'format', 'text'),
      pole('Powiadomienie ntfy', 'ntfy', 'check'),
    );
    elPostep = document.createElement('div');
    elPostep.textContent = 'Gotowy.';
    elPostep.style.cssText = 'margin:8px 0 6px;padding:6px 7px;background:#101822;border-radius:7px;font-size:11px;min-height:28px';
    elPrzyciski = document.createElement('div');
    elPrzyciski.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
    elLog = document.createElement('div');
    elLog.style.cssText = 'max-height:120px;overflow:auto;font:10px/1.5 ui-monospace,monospace;opacity:.85;background:#101822;border-radius:7px;padding:5px 6px';
    try { (JSON.parse(localStorage.getItem(KLUCZ_LOG) || '[]')).slice(-20).forEach(w => { const d = document.createElement('div'); d.textContent = w; elLog.appendChild(d); }); } catch {}
    elLog.scrollTop = elLog.scrollHeight;

    p.append(tyt, elInfo, ust, elPostep, elPrzyciski, elLog);
    document.body.appendChild(p);
    przeciagaj(p, tyt);
    rysujPrzyciski();
    odswiezInfo();
    setInterval(() => { if (stan === 'stop') odswiezInfo(); }, 2000);
  }

  // panel da się przesuwać za pasek tytułu; pozycja zapamiętana między stronami
  function przeciagaj(panelEl, uchwyt) {
    const trzymajWEkranie = (x, y) => [
      Math.min(Math.max(x, 0), Math.max(0, innerWidth - panelEl.offsetWidth)),
      Math.min(Math.max(y, 0), Math.max(0, innerHeight - 40)),
    ];
    const ustaw = (x, y) => {
      const [lx, ly] = trzymajWEkranie(x, y);
      panelEl.style.left = lx + 'px';
      panelEl.style.top = ly + 'px';
      panelEl.style.right = 'auto';
      panelEl.style.bottom = 'auto';
    };
    try {
      const z = JSON.parse(localStorage.getItem(KLUCZ_POZ) || 'null');
      if (z && typeof z.x === 'number') ustaw(z.x, z.y);
    } catch {}

    let dx = 0, dy = 0, ciagne = false;
    uchwyt.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const r = panelEl.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      ciagne = true;
      uchwyt.style.cursor = 'grabbing';
      e.preventDefault();
    });
    addEventListener('mousemove', e => { if (ciagne) ustaw(e.clientX - dx, e.clientY - dy); });
    addEventListener('mouseup', () => {
      if (!ciagne) return;
      ciagne = false;
      uchwyt.style.cursor = 'grab';
      const r = panelEl.getBoundingClientRect();
      try { localStorage.setItem(KLUCZ_POZ, JSON.stringify({ x: r.left, y: r.top })); } catch {}
    });
    // dwuklik w pasek = powrót w prawy dolny róg
    uchwyt.addEventListener('dblclick', () => {
      panelEl.style.cssText = panelEl.style.cssText.replace(/left:[^;]+;?/, '').replace(/top:[^;]+;?/, '');
      panelEl.style.left = 'auto'; panelEl.style.top = 'auto';
      panelEl.style.right = '14px'; panelEl.style.bottom = '14px';
      try { localStorage.removeItem(KLUCZ_POZ); } catch {}
    });
  }

  // ===================== START =====================
  (async () => {
    if (!await czekajNa(() => $(SEL.btnZaznacz) && $(SEL.btnPobierz), 25000)) return;
    panel();
    const s = czytajStan();
    if (s && Date.now() - (s.ostatni || s.start || 0) < 10 * 60000) {
      postep('Wznawiam za 3 s · paczka ' + (s.paczka + 1) + ' od strony ' + s.stronaStart);
      log('wznawiam przerwany przebieg za 3 s (STOP przerwie)');
      await spij(3000);
      if (stan === 'stop') lec(true);
    } else if (s) {
      postep('Jest stary niedokończony przebieg (od strony ' + s.stronaStart + '). WZNÓW albo reset → START od początku.');
    }
  })();
})();
