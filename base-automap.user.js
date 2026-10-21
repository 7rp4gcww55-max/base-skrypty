// ==UserScript==
// @name         Base auto-mapowanie (tryb RĘCZNY / AUTO)
// @version      2026.10.21-7
// @match        https://*.baselinker.com/*
// @match        http://*.baselinker.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-automap.user.js
// @downloadURL  https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-automap.user.js
// ==/UserScript==

(() => {
  // Base czasem przekierowuje na http:// – Safari wtedy blokuje stronę. Zawsze wracaj na https.
  if (location.protocol === 'http:') { location.replace(location.href.replace(/^http:/, 'https:')); return; }
  // nie uruchamiaj dwóch skryptów naraz na jednej stronie
  if (window.__baseAutoMap) { console.log('[AutoMap] pomijam – działa już: ' + window.__baseAutoMap); return; }
  window.__baseAutoMap = 'CYKL';

  // ===== PRZERWA SERWISOWA BASE: czekaj, odświeżaj co 2 min, po powrocie Base skrypt rusza dalej sam =====
  {
    const tekst = (document.body && document.body.innerText) || '';
    if (/Przerwa serwisowa|planned service break|Trwa planowana przerwa/i.test(tekst)) {
      const ODSWIEZ_MIN = 2;
      let wpis = {};
      try { wpis = JSON.parse(localStorage.getItem('autoPrzerwaSerwisowa') || '{}'); } catch {}
      const czasStart = wpis.od && Date.now() - wpis.od < 24 * 3600000 ? wpis.od : Date.now();
      // powiadomienie na telefon – tylko raz na przerwę
      if (!wpis.wyslano && localStorage.getItem('autoNtfyOn') === '1' && localStorage.getItem('autoNtfyTemat')) {
        const koniec = (tekst.match(/zakończenia prac:[^\d]*([\d-]+\s+[\d:]+)/i) || [])[1] || '?';
        fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({
          topic: localStorage.getItem('autoNtfyTemat'), title: '🛠 Base – przerwa serwisowa',
          message: 'Base ma przerwę (koniec ok. ' + koniec + ').\nCzekam i odświeżam co ' + ODSWIEZ_MIN + ' min – po powrocie lecę dalej sam.',
          priority: 4, tags: ['construction'] }) }).catch(() => {});
        wpis.wyslano = true;
      }
      try { localStorage.setItem('autoPrzerwaSerwisowa', JSON.stringify({ od: czasStart, wyslano: wpis.wyslano })); } catch {}
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999999;background:#1e2a38;color:#fff;font:bold 13px sans-serif;padding:10px 14px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.5)';
      document.body.appendChild(b);
      let sek = ODSWIEZ_MIN * 60;
      const tik = () => { b.textContent = '🛠 AutoMap: przerwa serwisowa Base – odświeżam za ' + sek + ' s, potem lecę dalej sam'; };
      tik();
      setInterval(() => { sek--; tik(); if (sek <= 0) location.reload(); }, 1000);
      window.__baseAutoMap = 'PRZERWA';
      return;                                   // na stronie przerwy nic więcej nie robimy
    }
    // Base wrócił po przerwie – daj znać na telefon (raz)
    let wpis = null;
    try { wpis = JSON.parse(localStorage.getItem('autoPrzerwaSerwisowa') || 'null'); } catch {}
    if (wpis && wpis.od) {
      localStorage.removeItem('autoPrzerwaSerwisowa');
      if (localStorage.getItem('autoNtfyOn') === '1' && localStorage.getItem('autoNtfyTemat')) {
        fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({
          topic: localStorage.getItem('autoNtfyTemat'), title: '✅ Base wrócił po przerwie',
          message: 'Przerwa trwała ok. ' + Math.round((Date.now() - wpis.od) / 60000) + ' min. Skrypt rusza dalej.',
          priority: 3, tags: ['white_check_mark'] }) }).catch(() => {});
      }
    }
  }
  // ======================= USTAWIENIA =======================
  const PACZKA_DOMYSLNA = 500;                // ile produktów w paczce (zmienisz przyciskiem 📦 w panelu)
  const TRYB_PRODUKTYZACJI = 'check_and_fill_first'; // "wyszukaj i dopasuj pierwszą znalezioną"
  const SKOK_EKRANOW = 4;       // o ile ekranów skakać w dół przy szukaniu pola (więcej = szybciej)
  const SKOK_CZEKAJ_MS = 600;   // ile czekać po skoku, aż Base dociągnie produkty
  // KONTO: zawsze ostatni wyraz nazwy katalogu, np. "ERO PRZE 8 SekretnaAlkowa" -> SekretnaAlkowa

  // KROKI NA STRONIE WYSTAWIANIA (po kolei)
  // 'akcja' – akcja masowa z dolnego paska | 'mapuj' – łańcuch + Zastosuj do wszystkich
  // 'wybor' – wartość z listy + Kopiuj do wszystkich | 'wyczysc' – wyczyść + Kopiuj + mapuj
  // 'idprod' – usuń -1 z ID produktyzacji + Kopiuj do wszystkich
  // ===== PROCES 1: PRZERÓBKI (nowe EAN, mapowania na SKU) =====
  const KROKI_PRZEROBKI = [
    { typ: 'akcja', nazwa: 'Usuń niedopasowane', wartosc: 'remove_mismatched' },
    { typ: 'mapuj', nazwa: 'EAN', regula: 5, odswiez: true },
    { typ: 'mapuj', nazwa: 'Kod producenta', regula: 5, odswiez: true },
    { typ: 'mapuj', nazwa: 'Waga produktu z opakowaniem jednostkowym', regula: null, odswiez: true },
    { typ: 'mapuj', nazwa: 'Model', regula: 5, odswiez: true },
    { typ: 'mapuj', nazwa: 'Nazwa', regula: 5, odswiez: true },
    { typ: 'mapuj', nazwa: 'Seria', regula: 5, odswiez: true },
    { typ: 'mapuj', nazwa: 'Nazwa koloru producenta', regula: 5, odswiez: true },
    // --- od tego miejsca bez odświeżania strony ---
    { typ: 'wybor', nazwa: 'Stan', wartosc: 'Nowy' },
    { typ: 'wybor', nazwa: 'Wyrób medyczny', wartosc: 'nie' },
    { typ: 'wyczysc', nazwa: 'Zawartość kompletu', regula: 5 },
    { typ: 'wyczysc', nazwa: 'Skład materiałowy', regula: 5 },
    { typ: 'akcja', nazwa: 'Nowy produkt w katalogu', wartosc: 'change_productization_create_new' },
    { typ: 'idprod', nazwa: 'ID produktyzacji' }
  ];

  // ===== PROCES 2: FINALNE (wystawianie dobrych produktów) =====
  const KROKI_FINALNE = [
    { typ: 'akcja', nazwa: 'Usuń niedopasowane', wartosc: 'remove_mismatched' },
    { typ: 'cennik', nazwa: 'Cennik wysyłki' },     // DUZE / KURIER / PACZKOMATY – zależnie od grupy tagów paczki
    { typ: 'wybor', nazwa: 'Szablon oferty', wartosc: 'UNIWERSALNY-PO-PRZEROBIENIU-TYT',
      sciezka: 'siteItems.pl.marketplaceParams.theme.value', zrodlo: 'sites.pl.marketplaceParams.theme.options' },
    { typ: 'wybor', nazwa: 'Wyrób medyczny', wartosc: 'nie' },
    { typ: 'wybor', nazwa: 'Stan', wartosc: 'Nowy' }
  ];

  // FILTRY w katalogu ustawiane przed każdą paczką (pola: stock = Stan, link_marketplace = Marketplace (oferta), star = Gwiazdka, filter_tags = Tagi)
  const FILTRY_PRZEROBKI = [[{ field: 'stock', op: '>=', val: '1' }]];
  const FILTRY_FINALNE = [[{ field: 'stock', op: '>=', val: '1' }, { field: 'link_marketplace', op: 'LIKE', val: 'any_marketplace_account' }]];

  // FINALNE wystawiane grupami tagów – każda grupa ma swój cennik wysyłki (szukany po ostatnim słowie nazwy cennika).
  // Kolejność: najpierw cała grupa DUŻE, potem KURIER, potem PACZKOMAT. Inne tagi (np. MULTIPACZKA) nie są brane.
  const GRUPY_FINALNE = [
    { nazwa: 'DUŻE',      tagi: ['LOG:GABARYT', 'LOG:PALETA'],                          cennik: 'DUZE' },
    { nazwa: 'KURIER',    tagi: ['LOG:KURIER-NST', 'LOG:KURIER-STD'],                   cennik: 'KURIER' },
    { nazwa: 'PACZKOMAT', tagi: ['LOG:PACZKOMAT-A', 'LOG:PACZKOMAT-B', 'LOG:PACZKOMAT-C'], cennik: 'PACZKOMAT' }
  ];

  // OBOWIĄZKOWE PARAMETRY – sprawdzane w danych Base po wszystkich krokach, przed wystawieniem.
  // Gdy któryś nie przejdzie: poprawka + powtórka kroków (do PROBY_OBOWIAZKOWYCH razy). Dalej źle = NIE wystawia sam (alarm).
  //  sku   – wartość = SKU produktu (nowy EAN z przerabiacza)
  //  opcja – wartość z listy (np. Stan = Nowy)
  //  mapowanie – wystarczy, że krok mapowania się udał (kliknięte „Zastosuj do wszystkich”);
  //             wartości nie sprawdzamy, bo Base czasem nie pokazuje jej w oknie po zmapowaniu (np. waga z mnożnikiem)
  const OBOWIAZKOWE = {
    przerobki: [
      { nazwa: 'EAN', regula: 'sku', krok: 'EAN' },
      { nazwa: 'Stan', regula: 'opcja', wartosc: 'Nowy', krok: 'Stan' },
      { nazwa: 'Waga produktu z opakowaniem jednostkowym', regula: 'mapowanie', krok: 'Waga produktu z opakowaniem jednostkowym' },
      { nazwa: 'Kod producenta', regula: 'sku', krok: 'Kod producenta' }
    ],
    finalne: [
      { nazwa: 'Stan', regula: 'opcja', wartosc: 'Nowy', krok: 'Stan' }
    ]
  };
  const PROBY_OBOWIAZKOWYCH = 3;
  const jestObowiazkowy = nazwa => (OBOWIAZKOWE[localStorage.getItem('autoProces')] || OBOWIAZKOWE.przerobki).some(r => r.krok === nazwa);

  const PROCESY = {
    przerobki: { nazwa: 'PRZERÓBKI', kroki: KROKI_PRZEROBKI, poWystawieniu: 'mapowania', spis: 'autoSpisWyslanych', filtry: FILTRY_PRZEROBKI },
    finalne:   { nazwa: 'FINALNE',   kroki: KROKI_FINALNE,   poWystawieniu: 'katalog',   spis: 'autoSpisWyslanychFinalne', filtry: FILTRY_FINALNE }
  };
  const L_PROCES = 'autoProces';
  const L_FULL = 'autoFull';            // '1' = FULL AUTO (wystawia bez potwierdzania)
  const SEKUNDY_DO_AUTO_WYSTAWIENIA = 15; // ile sekund masz na Anuluj w trybie FULL AUTO
  const L_OCZEKUJACA = 'autoPaczkaWToku';
  const L_RAPORT = 'autoRaport';
  const L_SESJA = 'autoSesja';
  const procesKlucz = () => (PROCESY[localStorage.getItem(L_PROCES)] ? localStorage.getItem(L_PROCES) : 'przerobki');
  const PROCES = PROCESY[procesKlucz()];
  // bieżąca grupa tagów FINALNYCH ('wyl' = bez podziału na grupy)
  const L_GRUPA = 'autoGrupaFinalne';
  const grupaFinalne = () => {
    if (procesKlucz() !== 'finalne') return null;
    const v = localStorage.getItem(L_GRUPA);
    if (v === 'wyl') return null;
    return GRUPY_FINALNE[parseInt(v) || 0] || GRUPY_FINALNE[0];
  };
  // grupa startowa zapamiętana PER KATALOG (np. ERO = bez grup, czyli bez cennika) – przy przejściu kolejki na następny katalog bierze jego ustawienie
  const L_GRUPA_KAT = 'autoGrupaKatalogu', L_GRUPA_START = 'autoGrupaStart';
  const grupyKat = () => { try { return JSON.parse(localStorage.getItem(L_GRUPA_KAT) || '{}') || {}; } catch { return {}; } };
  const nazwaGrupy = v => v === 'wyl' ? 'bez grup (bez cennika)' : 'od ' + (GRUPY_FINALNE[parseInt(v) || 0] || GRUPY_FINALNE[0]).nazwa;
  function startGrupy(id, nazwa) {
    const m = grupyKat(); if (id && m[id] != null) return m[id];
    if (/^\s*ERO/i.test(nazwa || '')) return 'wyl';                    // hurtownie erotyczne – wszystko paczkomat, bez cennika
    return localStorage.getItem(L_GRUPA_START) || '0';
  }
  function zapiszGrupeKat(id, v) { if (!id) return; const m = grupyKat(); m[id] = v; try { localStorage.setItem(L_GRUPA_KAT, JSON.stringify(m)); } catch {} }

  // ===== PROFILE KROKÓW (menu ⚙️ Kroki) =====
  // profil = nazwany zestaw kroków dla obu procesów, np. "ERO", "PRZEMYSŁOWA"
  const L_PROFILE = 'autoProfileKrokow';
  const L_PROFIL_AKT = 'autoProfilAktywny';
  const kopiaKrokow = l => JSON.parse(JSON.stringify(l)).map(k => Object.assign({ wl: true }, k));
  function wczytajProfile() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(L_PROFILE) || 'null'); } catch {}
    if (!p || typeof p !== 'object' || !Object.keys(p).length) {
      p = { 'Domyślny': { przerobki: kopiaKrokow(KROKI_PRZEROBKI), finalne: kopiaKrokow(KROKI_FINALNE) } };
    }
    return p;
  }
  const zapiszProfile = p => localStorage.setItem(L_PROFILE, JSON.stringify(p));
  const profilAktywny = () => {
    const p = wczytajProfile();
    const n = localStorage.getItem(L_PROFIL_AKT);
    return p[n] ? n : Object.keys(p)[0];
  };
  function krokiZProfilu() {
    const p = wczytajProfile()[profilAktywny()];
    const lista = ((p && p[procesKlucz()]) || kopiaKrokow(PROCES.kroki)).filter(k => k.wl !== false);
    // starsze profile FINALNE nie mają kroku cennika – dołóż go po "Usuń niedopasowane"
    if (procesKlucz() === 'finalne' && !lista.some(k => k.typ === 'cennik') && !(p && p.finalne && p.finalne.some(k => k.typ === 'cennik'))) {
      const i = lista.findIndex(k => k.wartosc === 'remove_mismatched');
      lista.splice(i + 1, 0, { typ: 'cennik', nazwa: 'Cennik wysyłki' });
    }
    // mapowania przez Base odświeżają stronę tylko dopóki nie było kroków "bez odświeżania"
    let mozna = true;
    return lista.map(k => {
      const c = Object.assign({}, k);
      if (c.typ === 'mapuj') c.odswiez = mozna; else if (c.typ !== 'akcja') mozna = false;
      return c;
    });
  }
  const KROKI = krokiZProfilu();
  // ==========================================================

  const STRONA = location.pathname;
  const NA_WYSTAWIANIU = STRONA.includes('marketplace_list_form.php');
  const NA_KATALOGU = STRONA.startsWith('/inventory_products');
  const NA_MAPOWANIACH = STRONA.includes('allegro_link_parameters.php');

  // ---------- PAMIĘĆ ----------
  // localStorage: cykl + spis wysłanych (wspólne dla wszystkich kart)
  const L_CYKL = 'autoCykl';           // '1' = cykl włączony
  const L_ETAP = 'autoCyklEtap';       // lista | wystawianie | mapowania | mapowania2 | katalog
  const L_KATALOG = 'autoCyklKatalog'; // id katalogu (do strony mapowań)
  const L_SPIS = PROCES.spis;           // ID produktów już wysłanych (osobny spis dla każdego procesu)
  const L_AUTO = 'autoMapAuto';        // '1' = sam startuje na nowym wystawianiu
  const L_WIDZIANE = 'autoMapWidziane';// listing_id, na których już startował
  const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch {} };
  const lsJson = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const spis = () => new Set(lsJson(L_SPIS).map(String));
  const dodajDoSpisu = ids => { const s = spis(); ids.forEach(i => s.add(String(i))); lsSet(L_SPIS, JSON.stringify([...s])); };
  // tryb „🔁 bez oferty”: każdy produkt bierzemy w danym katalogu najwyżej RAZ (potem pomijamy – koniec pętli z błędnymi/niedopasowanymi)
  const kluczBezOferty = kat => 'autoSpisBezOferty_' + kat;
  const spisBezOferty = kat => new Set(lsJson(kluczBezOferty(kat)).map(String));
  // licznik POPRAWNIE wystawionych ofert na konto (osobno przeróbki / finalne) – stop przy limicie (Allegro ma 20k, problemy od ~15k)
  const L_DOBRE_KONTO = 'autoDobreKonto', L_LIMIT_DOBRYCH = 'autoLimitDobrych';
  const limitDobrych = () => parseInt(lsGet(L_LIMIT_DOBRYCH, '15000')) || 15000;
  const dobreKonto = () => { try { return JSON.parse(localStorage.getItem(L_DOBRE_KONTO) || '{}') || {}; } catch { return {}; } };
  const kluczKonta = (konto, proces) => (proces || procesKlucz()) + '|' + String(konto || '').trim();
  const ileDobrych = (konto, proces) => Number(dobreKonto()[kluczKonta(konto, proces)]) || 0;
  const dodajDobre = (konto, n) => { const d = dobreKonto(), k = kluczKonta(konto); d[k] = (Number(d[k]) || 0) + (Number(n) || 0); lsSet(L_DOBRE_KONTO, JSON.stringify(d)); return d[k]; };
  const dodajDoSpisuBezOferty = (kat, ids) => { const s = spisBezOferty(kat); ids.forEach(i => s.add(String(i))); lsSet(kluczBezOferty(kat), JSON.stringify([...s].slice(-80000))); };
  const wyczyscSpisyBezOferty = () => { try { Object.keys(localStorage).filter(k => k.startsWith('autoSpisBezOferty_')).forEach(k => localStorage.removeItem(k)); localStorage.removeItem('autoOstatniaPaczka'); } catch {} };
  const cyklWlaczony = () => lsGet(L_CYKL) === '1';
  if (lsGet(L_AUTO) === null) lsSet(L_AUTO, '0');   // start w trybie RĘCZNYM

  // paczka + pomiary czasu
  const L_PACZKA = 'autoPaczka';
  const L_POMIAR = 'autoPomiarBiezacy';  // {n, start, gotowe, wystaw, koniec}
  const L_STATY = 'autoPomiary';         // historia pomiarów
  const paczka = () => Math.max(1, parseInt(lsGet(L_PACZKA, PACZKA_DOMYSLNA)) || PACZKA_DOMYSLNA);
  const pomiar = () => { try { return JSON.parse(localStorage.getItem(L_POMIAR)) || null; } catch { return null; } };
  const zapiszPomiar = (zmiany) => { const p = Object.assign(pomiar() || {}, zmiany); lsSet(L_POMIAR, JSON.stringify(p)); return p; };
  function zamknijPomiar() {
    const p = pomiar();
    if (!p || !p.start) return;
    p.koniec = Date.now();
    const h = lsJson(L_STATY); h.push(p);
    lsSet(L_STATY, JSON.stringify(h.slice(-100)));
    lsDel(L_POMIAR);
  }
  const min = ms => (ms / 60000).toFixed(1);

  // sessionStorage: stan konkretnego wystawiania (osobno dla każdego listing_id)
  const LID = new URLSearchParams(location.search).get('listing_id') || 'x';
  const K_RUN = 'am_' + LID + '_run';
  const K_DONE = 'am_' + LID + '_done';
  const K_SKIP = 'am_' + LID + '_skip';
  const K_ODHACZ = 'am_' + LID + '_odhacz';
  const lista = k => { try { return JSON.parse(sessionStorage.getItem(k)) || []; } catch { return []; } };
  const dodaj = (k, v) => { const l = lista(k); if (!l.includes(v)) { l.push(v); sessionStorage.setItem(k, JSON.stringify(l)); } };
  const dziala = () => sessionStorage.getItem(K_RUN) === '1';

  const czekaj = ms => new Promise(r => setTimeout(r, ms));
  const norm = t => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const czekajNa = async (fn, t = 8000) => {
    for (let i = 0; i < t / 200; i++) { const x = fn(); if (x) return x; await czekaj(200); }
    return null;
  };
  const myszka = (el, zd) => zd.forEach(e => el.dispatchEvent(new MouseEvent(e, { bubbles: true })));
  const ustawSelect = (sel, val) => {
    sel.value = String(val);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) window.jQuery(sel).trigger('change');
  };
  let pracuje = false;

  // ---------- DŹWIĘK ----------
  let audioCtx = null;
  function odblokujDzwiek() {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch {}
  }
  document.addEventListener('pointerdown', odblokujDzwiek, { once: true, capture: true });
  async function pikaj(ile = 3) {
    try {
      odblokujDzwiek();
      for (let i = 0; i < ile; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = i % 2 ? 1100 : 880; g.gain.value = 0.25;
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); await czekaj(300); o.stop(); await czekaj(150);
      }
    } catch {}
  }

  // ---------- PANEL ----------
  let bTryb = null;
  let bTel = null;
  let przerwanoKatalog = false;
  const panelUI = document.createElement('div');
  panelUI.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:999999;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;background:#1e2a38;color:#fff;font:bold 12px sans-serif;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.5);max-width:calc(100vw - 24px)';
  const info = document.createElement('span');
  info.style.cssText = 'padding:0 6px;max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  const btn = (txt, kolor, fn, title = '') => {
    const b = document.createElement('button');
    b.textContent = txt; b.title = title;
    b.style.cssText = `background:${kolor};color:#fff;border:0;border-radius:6px;padding:5px 9px;font:bold 12px sans-serif;cursor:pointer`;
    b.onclick = fn;
    return b;
  };
  function status(t) {
    info.textContent = 'AutoMap: ' + t;
    odswiezPrzyciski();
    console.log('[AutoMap]', t);
    try { liveZapisz(t); } catch (e) {}
  }

  // =========================================================
  // ===== 📺 PODGLĄD NA ŻYWO (wspólny dla wszystkich kart) =====
  // każda karta zapisuje swój stan i log do localStorage – panel 📺 czyta je co sekundę
  // =========================================================
  const L_LIVE = 'autoLive', L_LIVE_LOG = 'autoLiveLog', L_LIVE_OTW = 'autoLiveOtwarty';
  const L_LIVE_TEL = 'autoLiveTelMin', L_LIVE_TEL_OST = 'autoLiveTelOstatni';
  const kontekstStrony = () => NA_WYSTAWIANIU ? 'wystawianie' : NA_KATALOGU ? 'katalog' : NA_MAPOWANIACH ? 'mapowania' : 'inna';
  function liveKroki() {
    if (!NA_WYSTAWIANIU) return null;
    const done = lista(K_DONE), skip = lista(K_SKIP);
    let biezacy = false;
    return KROKI.map(k => {
      let stan = skip.includes(k.nazwa) ? 'pominiety' : done.includes(k.nazwa) ? 'zrobiony' : 'czeka';
      if (stan === 'czeka' && !biezacy) { biezacy = true; stan = 'teraz'; }
      return { n: k.nazwa, s: stan };
    });
  }
  let liveOstTekst = '', liveOstPrefiks = '';
  function liveZapisz(t) {
    const teraz = Date.now();
    const ctx = kontekstStrony();
    // stan bieżący
    const stan = { t: teraz, strona: ctx, lid: NA_WYSTAWIANIU ? LID : '', proces: PROCES.nazwa, tekst: t };
    const kr = liveKroki();
    if (kr) stan.kroki = kr;
    let poprz = {};
    try { poprz = JSON.parse(localStorage.getItem(L_LIVE) || '{}'); } catch {}
    // inne karty (katalog, mapowania) zachowują listę kroków zapisaną przez kartę wystawiania
    if (kr) stan.lidKroki = LID;
    else if (poprz.kroki) { stan.kroki = poprz.kroki; stan.lidKroki = poprz.lidKroki; }
    // kiedy zaczął się bieżący krok (do "od X min")
    const teraz_krok = kr ? (kr.find(k => k.s === 'teraz') || {}).n : null;
    stan.krok = teraz_krok !== null && teraz_krok !== undefined ? teraz_krok : (poprz.krok || '');
    stan.krokOd = (stan.krok && stan.krok === poprz.krok && poprz.krokOd) ? poprz.krokOd : teraz;
    lsSet(L_LIVE, JSON.stringify(stan));
    // log: postęp typu "wystawiam… 120/500" nadpisuje poprzednią linię zamiast dopisywać nową
    if (t === liveOstTekst) return;
    const prefiks = (t.match(/^[^:…\d]{3,40}/) || [''])[0].trim();
    let log = [];
    try { log = JSON.parse(localStorage.getItem(L_LIVE_LOG) || '[]'); } catch {}
    const ost = log[log.length - 1];
    const ctxKr = ctx[0].toUpperCase() + (NA_WYSTAWIANIU ? ' ' + LID : '');
    if (ost && prefiks && prefiks === liveOstPrefiks && ost.c === ctxKr && /\d/.test(t)) { ost.m = t; ost.d = teraz; }
    else log.push({ t: teraz, c: ctxKr, m: t });
    liveOstTekst = t; liveOstPrefiks = prefiks;
    lsSet(L_LIVE_LOG, JSON.stringify(log.slice(-3000)));   // ok. 20 paczek – do analizy czasów w ⏱
  }

  // krótkie podsumowanie na telefon co X min (ciche powiadomienie)
  function liveTelefon() {
    const co = parseInt(lsGet(L_LIVE_TEL, '10')) || 0;
    if (!co || !ntfyWlaczone()) return;
    let s = {};
    try { s = JSON.parse(localStorage.getItem(L_LIVE) || '{}'); } catch {}
    if (!s.t || Date.now() - s.t > 15 * 60000) return;         // nic się nie dzieje – nie spamuj
    const ost = parseInt(lsGet(L_LIVE_TEL_OST, '0')) || 0;
    if (Date.now() - ost < co * 60000) return;
    lsSet(L_LIVE_TEL_OST, String(Date.now()));                   // blokada – wysyła tylko jedna karta
    powiadom('📺 AutoMap na żywo', liveOpisTekstowy(), { priorytet: 2, tagi: ['tv'], akcje: [['📊 Status', 'status'], ['⏹ Stop', 'stop']] });
  }
  const minSek = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + ' s' : s < 3600 ? Math.floor(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min'; };
  const godz = ms => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  function liveDane() {
    let s = {}, ses = null;
    try { s = JSON.parse(localStorage.getItem(L_LIVE) || '{}'); } catch {}
    try { ses = JSON.parse(localStorage.getItem(L_SESJA) || 'null'); } catch {}
    const p = pomiar();
    const r = lsJson(L_RAPORT);
    const sesR = ses ? r.filter(w => (w.nr || 0) > (ses.odNr || 0)) : [];
    const kroki = s.kroki || [];
    const nrKroku = kroki.findIndex(k => k.s === 'teraz');
    let faza = 'bez paczki';
    if (p && p.start) faza = p.koniec ? 'paczka zakończona' : p.wystaw ? 'wystawianie ofert' : p.gotowe ? 'gotowe do wystawienia' : 'przygotowanie paczki';
    return { s, ses, p, sesR, kroki, nrKroku, faza };
  }
  function liveOpisTekstowy() {
    const { s, ses, p, sesR, kroki, nrKroku, faza } = liveDane();
    const linie = [];
    linie.push((s.tekst || '—') + ' (' + minSek(Date.now() - (s.t || Date.now())) + ' temu)');
    if (nrKroku >= 0) linie.push('Krok ' + (nrKroku + 1) + '/' + kroki.length + ': ' + kroki[nrKroku].n + ' – od ' + minSek(Date.now() - (s.krokOd || Date.now())));
    if (p && p.start) linie.push('Paczka ' + (p.n || '?') + ' · ' + (p.konto || '') + ' · ' + faza + ' · od ' + godz(p.start) + ' (' + minSek(Date.now() - p.start) + ')');
    if (ses) linie.push('Sesja od ' + godz(ses.start) + ': ' + sesR.length + ' paczek, ' + sesR.reduce((a, w) => a + (Number(w.dobre) || 0), 0) + ' dobrych, ' + sesR.reduce((a, w) => a + (Number(w.bledne) || 0), 0) + ' błędnych');
    return linie.join('\n');
  }

  function pokazLive() {
    let o = document.getElementById('am-live');
    if (o) { o.remove(); lsDel(L_LIVE_OTW); return; }
    lsSet(L_LIVE_OTW, '1');
    o = document.createElement('div');
    o.id = 'am-live';
    o.style.cssText = 'position:fixed;top:12px;right:12px;bottom:12px;width:min(400px,calc(100vw - 24px));z-index:9999990;background:#16202b;color:#e8eef4;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.55);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column;overflow:hidden';
    o.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #263445">
        <span id="am-live-kropka" style="width:10px;height:10px;border-radius:50%;background:#66bb6a;flex:none"></span>
        <b style="font-size:15px;flex:1">AutoMap na żywo · ${PRZEGLADARKA.ikona} ${PRZEGLADARKA.nazwa}</b>
        <select id="am-live-tel" title="Krótkie podsumowanie na telefon (ntfy)" style="background:#263445;color:#e8eef4;border:0;border-radius:6px;padding:3px 4px;font-size:12px">
          <option value="0">📱 wył.</option><option value="5">📱 co 5 min</option><option value="10">📱 co 10 min</option><option value="15">📱 co 15 min</option><option value="30">📱 co 30 min</option><option value="60">📱 co 1 h</option>
        </select>
        <button id="am-live-x" title="Zamknij" style="background:#263445;color:#e8eef4;border:0;border-radius:6px;padding:3px 9px;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div style="padding:12px 14px;border-bottom:1px solid #263445">
        <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.6">Teraz</div>
        <div id="am-live-teraz" style="font-size:16px;font-weight:600;margin:2px 0 4px;word-break:break-word"></div>
        <div id="am-live-teraz2" style="font-size:12px;opacity:.75"></div>
      </div>
      <div id="am-live-paczka" style="padding:10px 14px;border-bottom:1px solid #263445;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:12.5px;font-variant-numeric:tabular-nums"></div>
      <div style="padding:10px 14px 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.6">Kroki <span id="am-live-lid" style="text-transform:none;letter-spacing:0"></span></div>
      <div id="am-live-kroki" style="padding:0 14px 10px;border-bottom:1px solid #263445;max-height:34%;overflow:auto"></div>
      <div style="padding:10px 14px 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.6">Co robił (najnowsze na górze)</div>
      <div id="am-live-log" style="padding:0 14px 12px;overflow:auto;flex:1;min-height:0;font:12px/1.5 ui-monospace,Menlo,monospace"></div>`;
    document.body.appendChild(o);
    const sel = o.querySelector('#am-live-tel');
    sel.value = String(parseInt(lsGet(L_LIVE_TEL, '10')) || 0);
    sel.onchange = () => { lsSet(L_LIVE_TEL, sel.value); lsDel(L_LIVE_TEL_OST); };
    o.querySelector('#am-live-x').onclick = () => { o.remove(); lsDel(L_LIVE_OTW); };
    const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const ikona = { zrobiony: ['✓', '#66bb6a'], pominiety: ['⚠', '#ffb74d'], teraz: ['▶', '#4fc3f7'], czeka: ['·', '#607080'] };
    const rysuj = () => {
      if (!document.body.contains(o)) return clearInterval(tim);
      const { s, ses, p, sesR, kroki, nrKroku, faza } = liveDane();
      const wiek = Date.now() - (s.t || 0);
      const kolor = !s.t ? '#607080' : wiek < 3 * 60000 ? '#66bb6a' : wiek < 10 * 60000 ? '#ffb74d' : '#ef5350';
      o.querySelector('#am-live-kropka').style.background = kolor;
      o.querySelector('#am-live-kropka').title = s.t ? 'ostatnia zmiana ' + minSek(wiek) + ' temu' : 'brak danych';
      o.querySelector('#am-live-teraz').textContent = s.tekst || 'brak danych – skrypt jeszcze nic nie robił';
      o.querySelector('#am-live-teraz2').textContent = s.t
        ? 'karta: ' + s.strona + (s.lid ? ' ' + s.lid : '') + ' · ' + minSek(wiek) + ' temu' + (nrKroku >= 0 ? ' · krok trwa ' + minSek(Date.now() - (s.krokOd || Date.now())) : '')
        : '';
      const wiersz = (a, b) => '<span style="opacity:.6">' + a + '</span><span>' + b + '</span>';
      let pacz = wiersz('Proces', esc((s.proces || PROCES.nazwa) + (grupaFinalne() ? ' · grupa ' + grupaFinalne().nazwa : ''))) + wiersz('Tryb', esc(!trybAuto() ? 'Ręczny' : (lsGet(L_FULL) === '1' ? '☠️ Full auto' : 'Auto')));
      if (p && p.start) {
        pacz += wiersz('Paczka', esc((p.n || '?') + ' prod. · ' + (p.konto || '')));
        pacz += wiersz('Etap', esc(faza));
        pacz += wiersz('Start', esc(godz(p.start) + ' · trwa ' + minSek((p.koniec || Date.now()) - p.start)));
        if (p.gotowe) pacz += wiersz('Przygotowanie', esc(minSek(p.gotowe - p.start)));
        if (p.wystaw) pacz += wiersz('Wystawianie', esc(minSek((p.koniec || Date.now()) - p.wystaw)));
      }
      if (ses) pacz += wiersz('Sesja', esc('od ' + godz(ses.start) + ' · ' + sesR.length + ' paczek · ' + sesR.reduce((a, w) => a + (Number(w.dobre) || 0), 0) + ' dobrych · ' + sesR.reduce((a, w) => a + (Number(w.bledne) || 0), 0) + ' błędnych'));
      pacz += wiersz('Spis', esc(spis().size + ' zrobionych ID'));
      o.querySelector('#am-live-paczka').innerHTML = pacz;
      o.querySelector('#am-live-lid').textContent = s.lidKroki ? '· wystawianie ' + s.lidKroki + (nrKroku >= 0 ? ' · ' + (nrKroku + 1) + '/' + kroki.length : '') : '';
      o.querySelector('#am-live-kroki').innerHTML = kroki.length
        ? kroki.map(k => { const [i, c] = ikona[k.s] || ikona.czeka; return '<div style="display:flex;gap:8px;padding:2px 0;' + (k.s === 'teraz' ? 'font-weight:600;color:#4fc3f7' : k.s === 'czeka' ? 'opacity:.55' : '') + '"><span style="color:' + c + ';width:12px;text-align:center;flex:none">' + i + '</span><span>' + esc(k.n) + (k.s === 'pominiety' ? ' <span style="color:#ffb74d;font-weight:400">(pominięty)</span>' : '') + '</span></div>'; }).join('')
        : '<div style="opacity:.6">Lista kroków pojawi się, gdy ruszy karta wystawiania.</div>';
      let log = [];
      try { log = JSON.parse(localStorage.getItem(L_LIVE_LOG) || '[]'); } catch {}
      o.querySelector('#am-live-log').innerHTML = log.slice(-150).reverse().map(w =>
        '<div style="display:flex;gap:8px;padding:1px 0"><span style="opacity:.55;flex:none">' + new Date(w.t).toLocaleTimeString('pl-PL') + '</span><span style="opacity:.5;flex:none;width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(w.c) + '</span><span style="min-width:0;word-break:break-word">' + esc(w.m) + (w.d ? ' <span style="opacity:.5">(do ' + new Date(w.d).toLocaleTimeString('pl-PL') + ')</span>' : '') + '</span></div>').join('') || '<div style="opacity:.6">Pusto.</div>';
    };
    rysuj();
    const tim = setInterval(rysuj, 1000);
  }
  setInterval(() => { try { liveTelefon(); } catch (e) {} }, 30000);
  if (lsGet(L_LIVE_OTW) === '1') setTimeout(() => { if (!document.getElementById('am-live')) { lsDel(L_LIVE_OTW); pokazLive(); } }, 1500);

  const bCykl = btn('', '#6a1b9a', () => {
    if (cyklWlaczony()) { lsDel(L_CYKL); lsDel(L_ETAP); status('cykl wyłączony'); }
    else { lsSet(L_CYKL, '1'); status('cykl włączony'); }
  }, 'Po wystawieniu sam bierze kolejną paczkę');
  const bAuto = btn('', '#37474f', () => {
    lsSet(L_AUTO, lsGet(L_AUTO) === '1' ? '0' : '1'); odswiezPrzyciski();
  }, 'Sam startuje po załadowaniu nowego wystawiania');
  const bSpis = btn('', '#455a64', pokazSpis, 'Spis wysłanych produktów');
  const bRozmiar = btn('', '#00695c', () => {
    const v = prompt('Ile produktów w jednej paczce?', paczka());
    if (v === null) return;
    const n = parseInt(v);
    if (!n || n < 1) { alert('Podaj liczbę większą od 0'); return; }
    lsSet(L_PACZKA, String(n)); odswiezPrzyciski();
  }, 'Wielkość paczki');
  const bStaty = btn('⏱', '#4e342e', pokazStaty, 'Pomiary czasu paczek');
  const bRaport = btn('📊 Raport', '#2e7d32', pokazRaport, 'Raport: ile dobrych ofert z ilu wystawianych, z datą i godziną');
  // uchwyt do przesuwania panelu
  const uchwyt = document.createElement('span');
  uchwyt.textContent = '⠿';
  uchwyt.title = 'Przeciągnij, żeby przesunąć panel (dwuklik = wróć w lewy dolny róg)';
  uchwyt.style.cssText = 'cursor:grab;padding:2px 6px;font-size:16px;opacity:.7;user-select:none;touch-action:none';
  panelUI.append(uchwyt, info);

  let bStart, bPauza, bReset, bPaczka;
  if (NA_WYSTAWIANIU) {
    bStart = btn('▶ Start', '#2e7d32', () => {
      odblokujDzwiek();
      sessionStorage.setItem(K_RUN, '1');
      status('start…');
      if (!pracuje) krok();
    });
    bPauza = btn('⏸ Pauza', '#ef6c00', () => {
      sessionStorage.removeItem(K_RUN);
      status(pracuje ? 'pauza po bieżącym…' : 'pauza');
    });
    bReset = btn('↺', '#555', () => {
      if (!confirm('Wyczyścić pamięć skryptu dla tego wystawiania?')) return;
      [K_RUN, K_DONE, K_SKIP, K_ODHACZ].forEach(k => sessionStorage.removeItem(k));
      status('zresetowano – stoi');
    }, 'Reset pamięci tego wystawiania');
    panelUI.append(bStart, bPauza, bReset);
  }
  if (NA_KATALOGU) {
    bPaczka = btn('▶ Weź paczkę', '#2e7d32', () => { odblokujDzwiek(); wezPaczke(); }, 'Ustaw filtry, zaznacz niewysłane i utwórz wystawianie');
    const bStopKat = btn('⏹ Stop', '#c62828', () => {
      przerwanoKatalog = true;
      lsDel(L_ETAP);                                   // nie wracaj automatycznie do brania paczki
      lsDel(L_KATALOG_CZEKA);
      status('zatrzymano – nic nie wystawiam');
    }, 'Zatrzymaj branie paczki');
    const bEan = btn('🎯 EAN', '#6a1b9a', () => zapamietajFiltrEan(), 'Ustaw filtr „EAN – wartość nie pusta” ręcznie w Base i kliknij tu – skrypt zapamięta kod pola i operatora');
    panelUI.append(bPaczka, bStopKat, bEan);
    if (procesKlucz() === 'finalne') {
      // 🏷 grupa tagów: klik = następna (DUŻE → KURIER → PACZKOMAT → bez podziału → DUŻE)
      const bGrupa = btn('', '#5d4037', () => {
        const v = localStorage.getItem(L_GRUPA);
        const i = v === 'wyl' ? -1 : (parseInt(v) || 0);
        const nast = i + 1 >= GRUPY_FINALNE.length ? 'wyl' : String(i + 1);
        lsSet(L_GRUPA, nast);
        lsSet(L_GRUPA_START, nast);
        { const kq = kolejka(); const id = (kq && kq.lista[kq.idx] && kq.lista[kq.idx].id) || document.getElementById('inventory-option-catalog')?.value; zapiszGrupeKat(id, nast); }
        odswiezGrupe();
        status('grupa tagów: ' + (grupaFinalne() ? grupaFinalne().nazwa : 'bez podziału'));
      }, 'Grupa tagów, od której startuje wystawianie (klik = następna). Po skończeniu grupy skrypt sam przechodzi do następnej.');
      const odswiezGrupe = () => { const g = grupaFinalne(); bGrupa.textContent = '🏷 ' + (g ? g.nazwa : 'bez grup'); };
      odswiezGrupe();
      setInterval(odswiezGrupe, 3000);
      panelUI.append(bGrupa);
    }
  }
  // jeden przełącznik trybu: RĘCZNY (sam klikasz Start) / AUTO (cały proces sam)
  const trybAuto = () => cyklWlaczony() && lsGet(L_AUTO) === '1';
  // trzy osobne przyciski trybu
  const aktualnyTryb = () => !trybAuto() ? 'reczny' : (lsGet(L_FULL) === '1' ? 'full' : 'auto');
  function ustawTryb(t) {
    if (t === aktualnyTryb()) return;
    if (t === 'reczny') {
      lsDel(L_FULL); lsDel(L_CYKL); lsDel(L_ETAP); lsSet(L_AUTO, '0');
      status('tryb RĘCZNY – klikasz ▶ Start');
    } else if (t === 'auto') {
      lsSet(L_CYKL, '1'); lsSet(L_AUTO, '1'); lsDel(L_FULL);
      status('tryb AUTO – cały proces sam, WYSTAW potwierdzasz Ty');
    } else {
      if (!confirm('☠️ FULL AUTO\n\nSkrypt będzie WYSTAWIAŁ OFERTY SAM, bez Twojego potwierdzenia, paczka po paczce, aż skończy się katalog.\n\nZatrzyma się sam, jeśli jakiś krok zostanie pominięty.\nPrzed każdym wystawieniem masz ' + SEKUNDY_DO_AUTO_WYSTAWIENIA + ' s na „Anuluj”.\n\nWłączyć?')) return;
      lsSet(L_CYKL, '1'); lsSet(L_AUTO, '1'); lsSet(L_FULL, '1');
      status('☠️ FULL AUTO – wystawia sam');
    }
    odswiezPrzyciski();
  }
  bTryb = document.createElement('span');
  bTryb.style.cssText = 'display:inline-flex;border-radius:7px;overflow:hidden;border:1px solid rgba(255,255,255,.25)';
  const TRYBY = [
    ['reczny', '✋ Ręczny', '#37474f', 'Tylko mapowanie po kliknięciu ▶ Start'],
    ['auto', '🤖 Auto', '#6a1b9a', 'Cały proces sam, WYSTAW potwierdzasz Ty'],
    ['full', '☠️ Full auto', '#b71c1c', 'Wystawia sam cały katalog, bez potwierdzania']
  ];
  const bTryby = {};
  TRYBY.forEach(([klucz, napis, kolor, opis]) => {
    const b = document.createElement('button');
    b.textContent = napis; b.title = opis;
    b.dataset.kolor = kolor;
    b.style.cssText = 'border:0;padding:5px 9px;font:bold 12px sans-serif;cursor:pointer;color:#fff';
    b.onclick = () => ustawTryb(klucz);
    bTryby[klucz] = b;
    bTryb.append(b);
  });
  const bProces = btn('📂 ' + PROCES.nazwa, procesKlucz() === 'finalne' ? '#1565c0' : '#00838f', () => {
    if (pracuje) { alert('Najpierw zatrzymaj skrypt (⏸), potem zmień proces.'); return; }
    const nowy = procesKlucz() === 'finalne' ? 'przerobki' : 'finalne';
    if (!confirm('Zmienić proces na ' + PROCESY[nowy].nazwa + '?\n\nPRZERÓBKI: niedopasowane → mapowania SKU → … → usunięcie mapowania EAN\nFINALNE: niedopasowane → szablon UNIWERSALNY → Wyrób medyczny nie → Stan Nowy → wystaw')) return;
    localStorage.setItem(L_PROCES, nowy);
    lsDel(L_ETAP);
    location.reload();
  }, 'Który proces: PRZERÓBKI czy FINALNE (każdy ma swoje kroki i swój spis wysłanych)');
  bTel = btn('📱', '#455a64', () => pokazTelefon(), 'Powiadomienia i sterowanie z telefonu');
  const bKroki = btn('⚙️ Kroki' + (procesKlucz() === 'przerobki' && lsGet('autoBezOferty') === '1' ? ' · 🔁 bez oferty' : '') + (lsGet('autoTylkoZEan') === '1' ? ' · 🏷 z EAN' : '') + (lsGet('autoIgnorujBledy') === '1' ? ' · 🙈 mimo błędów' : ''), '#5d4037', () => pokazKroki(), 'Wybierz, które parametry ma robić (profile: ERO, PRZEMYSŁOWA…)');
  const bLive = btn('📺', '#0277bd', pokazLive, 'Podgląd na żywo: co skrypt robi teraz, kroki, czasy i log (ze wszystkich kart)');
  const bKolejka = btn('🗂', '#00695c', () => pokazKolejke(), 'Kolejka katalogów: bot sam przechodzi z katalogu na katalog');
  panelUI.append(bProces, bKroki, bTryb, bRozmiar, bSpis, bRaport, bStaty, bLive, bTel, bKolejka);
  try { const k = JSON.parse(localStorage.getItem('autoKolejkaKatalogow') || 'null'); if (k && k.lista && k.lista.length) bKolejka.textContent = '🗂 ' + (k.idx + 1) + '/' + k.lista.length; } catch {}
  document.body.appendChild(panelUI);


  // =========================================================
  // ===== OKNO ⚙️ KROKI =====
  const TYPY_KROKOW = {
    sku:     'Wstaw SKU (od razu, bez mapowania)',
    mapuj:   'Mapowanie Base → Zastosuj do wszystkich',
    wybor:   'Wybierz wartość z listy',
    wyczysc: 'Wyczyść pole + SKU',
    akcja:   'Akcja masowa (dolny pasek)',
    idprod:  'Usuń -1 z ID produktyzacji'
  };
  function opisKroku(k) {
    if (k.typ === 'mapuj') return TYPY_KROKOW.mapuj + (k.regula === 5 ? ' (reguła: Wstaw SKU, jeśli brak)' : k.regula == null ? ' (tylko istniejąca reguła)' : '');
    if (k.typ === 'wybor') return 'Wybierz: „' + k.wartosc + '”';
    return TYPY_KROKOW[k.typ] || k.typ;
  }
  // gotowe parametry do szybkiego dodania (typ domyślny)
  const PODPOWIEDZI = [
    { nazwa: 'EAN', typ: 'mapuj', regula: 5 },
    { nazwa: 'Kod producenta', typ: 'sku' },
    { nazwa: 'Model', typ: 'sku' },
    { nazwa: 'Seria', typ: 'sku' },
    { nazwa: 'Seria (własna wartość)', typ: 'sku' },
    { nazwa: 'Linia', typ: 'sku' },
    { nazwa: 'Nazwa', typ: 'sku' },
    { nazwa: 'Nazwa handlowa', typ: 'sku' },
    { nazwa: 'Nazwa koloru producenta', typ: 'sku' },
    { nazwa: 'Tytuł', typ: 'sku' },
    { nazwa: 'Smak', typ: 'sku' },
    { nazwa: 'Zapach', typ: 'sku' },
    { nazwa: 'Projektant', typ: 'sku' },
    { nazwa: 'Zawartość kompletu', typ: 'wyczysc', regula: 5 },
    { nazwa: 'Skład materiałowy', typ: 'wyczysc', regula: 5 },
    { nazwa: 'Waga produktu z opakowaniem jednostkowym', typ: 'mapuj', regula: null },
    { nazwa: 'Stan', typ: 'wybor', wartosc: 'Nowy' },
    { nazwa: 'Wyrób medyczny', typ: 'wybor', wartosc: 'nie' },
    { nazwa: 'Szablon oferty', typ: 'wybor', wartosc: 'UNIWERSALNY-PO-PRZEROBIENIU-TYT', sciezka: 'siteItems.pl.marketplaceParams.theme.value', zrodlo: 'sites.pl.marketplaceParams.theme.options' },
    { nazwa: 'Usuń niedopasowane', typ: 'akcja', wartosc: 'remove_mismatched' },
    { nazwa: 'Nowy produkt w katalogu', typ: 'akcja', wartosc: 'change_productization_create_new' },
    { nazwa: 'ID produktyzacji', typ: 'idprod' }
  ];

  function pokazKroki() {
    document.getElementById('am-kroki')?.remove();
    let profile = wczytajProfile();
    let nazwaProfilu = profilAktywny();
    let proces = procesKlucz();
    let lista = kopiaKrokow((profile[nazwaProfilu] && profile[nazwaProfilu][proces]) || PROCESY[proces].kroki);

    const o = document.createElement('div');
    o.id = 'am-kroki';
    o.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    const pole = 'background:#0f1720;color:#fff;border:1px solid #37474f;border-radius:6px;padding:6px 8px;font:13px sans-serif';
    const przycisk = (kol) => `background:${kol};color:#fff;border:0;border-radius:6px;padding:7px 11px;font:bold 12.5px sans-serif;cursor:pointer`;
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:20px;border-radius:12px;width:min(760px,96vw);font-family:sans-serif;max-height:92vh;overflow:auto">
      <div style="font-size:18px;font-weight:bold;margin-bottom:10px">⚙️ Kroki – które parametry ma robić</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">
        <span>Profil:</span><select id="kr-profil" style="${pole}"></select>
        <button id="kr-nowy" style="${przycisk('#455a64')}">+ Nowy profil</button>
        <button id="kr-usun-profil" style="${przycisk('#6d4c41')}">Usuń profil</button>
        <span style="margin-left:12px">Proces:</span>
        <select id="kr-proces" style="${pole}"><option value="przerobki">PRZERÓBKI</option><option value="finalne">FINALNE</option></select>
      </div>
      <div id="kr-lista"></div>
      <div style="background:#263445;border-radius:8px;padding:10px;margin-top:12px">
        <div style="font-weight:bold;margin-bottom:6px">🔎 Filtry katalogu (przy braniu paczki)</div>
        <div style="font-size:12.5px;opacity:.8;margin-bottom:6px">Zawsze: Stan ≥ 1${procesKlucz() === 'finalne' ? ' i Marketplace (oferta) zawiera dowolne konto' : ''}.</div>
        <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="kr-bezoferty" ${lsGet('autoBezOferty') === '1' ? 'checked' : ''} style="margin-top:3px">
          <span><b>PRZERÓBKI: Marketplace (oferta) NIE zawiera dowolnego konta</b> – bierze tylko produkty bez oferty, także te ze spisu (np. paczka, która się nie wystawiła). Każdy produkt najwyżej raz na katalog – błędne i niedopasowane nie wracają w kółko. Po naprawie odznacz.</span></label>
        <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;margin-top:8px"><input type="checkbox" id="kr-zean" ${lsGet('autoTylkoZEan') === '1' ? 'checked' : ''} style="margin-top:3px">
          <span><b>Tylko produkty z EAN</b> (obie: przeróbki i finalne) – filtr zaawansowany: EAN · wartość nie pusta. Dla hurtowni, gdzie nie wszystkie produkty mają EAN.</span></label>
        <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;margin-top:8px"><input type="checkbox" id="kr-ignorbledy" ${lsGet('autoIgnorujBledy') === '1' ? 'checked' : ''} style="margin-top:3px">
          <span><b>🙈 Lecę mimo błędów</b> – nie zatrzymuj cyklu, choćby całe paczki były błędne (dokańczanie sklepu). Błędne lądują w spisie 📋, żeby nie wracały. Limit ofert na konto i blokada pętli dalej działają.</span></label>
        <div style="margin-top:10px;border-top:1px solid #37474f;padding-top:8px"><b>📊 Limit poprawnych ofert na konto</b> (${PROCES.nazwa}): <input id="kr-limit" type="number" min="1000" step="500" value="${limitDobrych()}" style="width:80px;background:#0f1720;color:#fff;border:1px solid #37474f;border-radius:5px;padding:2px 5px"> – po tylu bot staje i daje znać.
          <div style="font-size:12px;opacity:.8;margin:4px 0">Liczone tylko poprawnie wystawione (nie spis). Liczniki możesz poprawić (np. wpisać, ile konto już ma) albo wyzerować:</div>
          <div id="kr-liczniki" style="max-height:140px;overflow:auto;font-size:12.5px">${Object.entries(dobreKonto()).filter(([k]) => k.startsWith(procesKlucz() + '|')).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="display:flex;gap:6px;align-items:center;margin:2px 0"><span style="flex:1">${k.split('|')[1].replace(/[<>&]/g, '')}</span><input class="kr-licz" data-k="${k.replace(/"/g, '')}" type="number" min="0" value="${v}" style="width:80px;background:#0f1720;color:#fff;border:1px solid #37474f;border-radius:5px;padding:1px 4px"></div>`).join('') || '<span style="opacity:.6">brak – liczy się od teraz</span>'}</div>
          <div style="margin-top:4px;font-size:12px">Dodaj/ustaw konto: <input id="kr-licz-konto" placeholder="nazwa konta" style="width:120px;background:#0f1720;color:#fff;border:1px solid #37474f;border-radius:5px;padding:1px 4px"> <input id="kr-licz-ile" type="number" min="0" placeholder="ile ma" style="width:80px;background:#0f1720;color:#fff;border:1px solid #37474f;border-radius:5px;padding:1px 4px"></div></div>
        <button id="kr-dokoncz" style="margin-top:8px;background:#6a1b9a;color:#fff;border:0;border-radius:6px;padding:6px 10px;font:bold 12px sans-serif;cursor:pointer">♻️ Dokończ katalogi – weź jeszcze raz wszystko, co nadal nie ma oferty</button>
      </div>
      <div style="background:#263445;border-radius:8px;padding:10px;margin-top:12px">
        <div style="font-weight:bold;margin-bottom:6px">⚡ Szybko dodaj (kliknij parametr)</div>
        <div id="kr-podpowiedzi" style="display:flex;flex-wrap:wrap;gap:6px"></div>
        ${NA_WYSTAWIANIU ? '<button id="kr-z-paczki" style="margin-top:8px;' + przycisk('#1565c0') + '">📥 Pokaż parametry z tej paczki</button><div id="kr-paczka" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>' : '<div style="font-size:12px;opacity:.7;margin-top:6px">Na stronie wystawiania pojawi się też przycisk „Pokaż parametry z tej paczki” – lista wszystkich parametrów, które mają produkty.</div>'}
      </div>
      <div style="background:#263445;border-radius:8px;padding:10px;margin-top:12px">
        <div style="font-weight:bold;margin-bottom:6px">+ Dodaj krok ręcznie</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <input id="kr-nazwa" placeholder="Nazwa parametru, np. Linia" style="${pole};min-width:200px">
          <select id="kr-typ" style="${pole}">${Object.entries(TYPY_KROKOW).filter(([k]) => k !== 'akcja' && k !== 'idprod').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <input id="kr-wartosc" placeholder="wartość (dla listy), np. Nowy" style="${pole};min-width:150px;display:none">
          <button id="kr-dodaj" style="${przycisk('#2e7d32')}">Dodaj</button>
        </div>
        <div style="font-size:12px;opacity:.7;margin-top:6px">Nazwa musi być taka jak w Base (np. „Nazwa handlowa”, „Linia”). „Wstaw SKU (od razu)” jest najszybsze – działa bez okna mapowania i bez odświeżania.</div>
      </div>
      <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px;flex-wrap:wrap">
        <button id="kr-domyslne" style="${przycisk('#6d4c41')}">Przywróć domyślne kroki procesu</button>
        <div style="display:flex;gap:8px">
          <button id="kr-anuluj" style="${przycisk('#555')}">Anuluj</button>
          <button id="kr-zapisz" style="${przycisk('#2e7d32')}">Zapisz i użyj</button>
        </div>
      </div></div>`;
    document.body.appendChild(o);
    const $ = sel => o.querySelector(sel);

    function rysujProfile() {
      $('#kr-profil').innerHTML = Object.keys(profile).map(n => `<option ${n === nazwaProfilu ? 'selected' : ''}>${n}</option>`).join('');
      $('#kr-proces').value = proces;
    }
    function rysujListe() {
      $('#kr-lista').innerHTML = lista.length ? lista.map((k, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #333;${k.wl === false ? 'opacity:.45' : ''}">
          <input type="checkbox" data-i="${i}" class="kr-wl" ${k.wl !== false ? 'checked' : ''} style="width:16px;height:16px">
          <div style="flex:1"><b>${k.nazwa}</b><div style="font-size:12px;opacity:.7">${opisKroku(k)}</div></div>
          <button data-i="${i}" class="kr-gora" title="Wyżej" style="${przycisk('#37474f')};padding:4px 8px">↑</button>
          <button data-i="${i}" class="kr-dol" title="Niżej" style="${przycisk('#37474f')};padding:4px 8px">↓</button>
          <button data-i="${i}" class="kr-usun" title="Usuń krok" style="${przycisk('#8e2424')};padding:4px 8px">✕</button>
        </div>`).join('') : '<div style="opacity:.7;padding:8px">Brak kroków.</div>';
      o.querySelectorAll('.kr-wl').forEach(c => c.onchange = () => { lista[+c.dataset.i].wl = c.checked; rysujListe(); });
      o.querySelectorAll('.kr-gora').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (i > 0) [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; rysujListe(); });
      o.querySelectorAll('.kr-dol').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (i < lista.length - 1) [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]]; rysujListe(); });
      o.querySelectorAll('.kr-usun').forEach(b => b.onclick = () => { if (confirm('Usunąć krok „' + lista[+b.dataset.i].nazwa + '”?')) { lista.splice(+b.dataset.i, 1); rysujListe(); } });
      rysujPodpowiedzi();
    }
    const chip = (tekst, tytul, kol = '#37474f') => `<button class="kr-chip" title="${tytul}" style="background:${kol};color:#fff;border:0;border-radius:14px;padding:5px 10px;font:12.5px sans-serif;cursor:pointer">+ ${tekst}</button>`;
    function dodajKrok(k) {
      const nowy = Object.assign({ wl: true }, JSON.parse(JSON.stringify(k)));
      const poz = lista.findIndex(x => x.typ === 'wybor' || x.typ === 'idprod' || (x.typ === 'akcja' && x.wartosc !== 'remove_mismatched'));
      if ((nowy.typ === 'mapuj' || nowy.typ === 'sku' || nowy.typ === 'wyczysc') && poz >= 0) lista.splice(poz, 0, nowy);
      else if (nowy.typ === 'akcja' && nowy.wartosc === 'remove_mismatched') lista.unshift(nowy);
      else lista.push(nowy);
      rysujListe();
    }
    function rysujPodpowiedzi() {
      const jest = new Set(lista.map(k => k.nazwa.toLowerCase()));
      const box = $('#kr-podpowiedzi');
      const wolne = PODPOWIEDZI.filter(k => !jest.has(k.nazwa.toLowerCase()));
      box.innerHTML = wolne.length ? wolne.map((k, i) => chip(k.nazwa, opisKroku(k)).replace('class="kr-chip"', 'class="kr-chip" data-p="' + PODPOWIEDZI.indexOf(k) + '"')).join('') : '<span style="opacity:.7">Wszystkie podpowiedzi są już na liście.</span>';
      box.querySelectorAll('.kr-chip').forEach(b => b.onclick = () => dodajKrok(PODPOWIEDZI[+b.dataset.p]));
      const pb = $('#kr-paczka');
      if (pb && pb.dataset.nazwy) {
        const nazwy = JSON.parse(pb.dataset.nazwy).filter(([n]) => !jest.has(n.toLowerCase()));
        pb.innerHTML = nazwy.map(([n, c]) => chip(n + ' (' + c + ')', 'Dodaj jako Wstaw SKU (typ zmienisz usuwając i dodając ręcznie)', '#0d47a1').replace('class="kr-chip"', 'class="kr-chip" data-n="' + n.replace(/"/g, '&quot;') + '"')).join('') || '<span style="opacity:.7">Wszystkie parametry z paczki są już na liście.</span>';
        pb.querySelectorAll('.kr-chip').forEach(b => b.onclick = () => {
          const znany = PODPOWIEDZI.find(k => k.nazwa.toLowerCase() === b.dataset.n.toLowerCase());
          dodajKrok(znany || { typ: 'sku', nazwa: b.dataset.n });
        });
      }
    }
    const zachowajBiezace = () => {
      profile[nazwaProfilu] = profile[nazwaProfilu] || {};
      profile[nazwaProfilu][proces] = lista;
    };
    const wczytajBiezace = () => {
      const p = profile[nazwaProfilu] || {};
      lista = kopiaKrokow(p[proces] || PROCESY[proces].kroki);
    };

    if ($('#kr-z-paczki')) $('#kr-z-paczki').onclick = async () => {
      $('#kr-z-paczki').textContent = '⏳ wczytuję…';
      const r = await bazaBase('nazwyParametrow', {}, 30000);
      if (r.blad || !r.wynik) { $('#kr-z-paczki').textContent = 'Nie udało się wczytać'; return; }
      $('#kr-paczka').dataset.nazwy = JSON.stringify(r.wynik.nazwy);
      $('#kr-z-paczki').textContent = '📥 Parametry z tej paczki (' + r.wynik.nazwy.length + ') – kliknij, żeby dodać:';
      rysujPodpowiedzi();
    };
    $('#kr-typ').onchange = () => { $('#kr-wartosc').style.display = $('#kr-typ').value === 'wybor' ? '' : 'none'; };
    $('#kr-dodaj').onclick = () => {
      const nazwa = $('#kr-nazwa').value.trim();
      const typ = $('#kr-typ').value;
      if (!nazwa) { alert('Wpisz nazwę parametru (taką jak w Base).'); return; }
      const k = { typ, nazwa, wl: true };
      if (typ === 'mapuj' || typ === 'wyczysc') k.regula = 5;
      if (typ === 'wybor') { k.wartosc = $('#kr-wartosc').value.trim(); if (!k.wartosc) { alert('Wpisz wartość do wybrania z listy.'); return; } }
      // nowe kroki SKU / mapowania wstaw przed pierwszym krokiem "wybor", żeby kolejność była sensowna
      const poz = lista.findIndex(x => x.typ === 'wybor' || x.typ === 'idprod');
      if ((typ === 'mapuj' || typ === 'sku') && poz >= 0) lista.splice(poz, 0, k); else lista.push(k);
      $('#kr-nazwa').value = ''; $('#kr-wartosc').value = '';
      rysujListe();
    };
    $('#kr-profil').onchange = () => { zachowajBiezace(); nazwaProfilu = $('#kr-profil').value; wczytajBiezace(); rysujListe(); };
    $('#kr-proces').onchange = () => { zachowajBiezace(); proces = $('#kr-proces').value; wczytajBiezace(); rysujListe(); };
    $('#kr-nowy').onclick = () => {
      const n = (prompt('Nazwa nowego profilu (np. PRZEMYSŁOWA):') || '').trim();
      if (!n) return;
      if (profile[n]) { alert('Taki profil już jest.'); return; }
      zachowajBiezace();
      profile[n] = JSON.parse(JSON.stringify(profile[nazwaProfilu]));   // start od kopii bieżącego
      nazwaProfilu = n; wczytajBiezace(); rysujProfile(); rysujListe();
    };
    $('#kr-usun-profil').onclick = () => {
      if (Object.keys(profile).length <= 1) { alert('Musi zostać przynajmniej jeden profil.'); return; }
      if (!confirm('Usunąć profil „' + nazwaProfilu + '”?')) return;
      delete profile[nazwaProfilu];
      nazwaProfilu = Object.keys(profile)[0]; wczytajBiezace(); rysujProfile(); rysujListe();
    };
    $('#kr-domyslne').onclick = () => {
      if (!confirm('Przywrócić domyślne kroki procesu ' + PROCESY[proces].nazwa + ' w profilu „' + nazwaProfilu + '”?')) return;
      lista = kopiaKrokow(PROCESY[proces].kroki); rysujListe();
    };
    $('#kr-anuluj').onclick = () => o.remove();
    $('#kr-dokoncz').onclick = () => {
      wyczyscSpisyBezOferty();
      $('#kr-bezoferty').checked = true;
      lsSet('autoBezOferty', '1');
      try { odswiezPrzyciski(); } catch {}
      alert('Gotowe ✔\nTryb „bez oferty” włączony, lista prób wyczyszczona.\nKliknij „Zapisz i użyj”, potem „Weź paczkę” – bot weźmie wszystko, co nadal nie ma oferty (każdy produkt raz).');
    };
    $('#kr-zapisz').onclick = () => {
      if (pracuje) { alert('Najpierw zatrzymaj skrypt (⏸), potem zapisz kroki.'); return; }
      zachowajBiezace();
      if ($('#kr-bezoferty').checked && lsGet('autoBezOferty') !== '1') wyczyscSpisyBezOferty();   // nowa runda naprawy
      lsSet('autoBezOferty', $('#kr-bezoferty').checked ? '1' : '0');
      lsSet('autoTylkoZEan', $('#kr-zean').checked ? '1' : '0');
      lsSet('autoIgnorujBledy', $('#kr-ignorbledy').checked ? '1' : '0');
      { const lim = parseInt($('#kr-limit').value); if (lim > 0) lsSet(L_LIMIT_DOBRYCH, String(lim));
        const d = dobreKonto(); o.querySelectorAll('.kr-licz').forEach(i => { const v = parseInt(i.value); if (isNaN(v) || v <= 0) delete d[i.dataset.k]; else d[i.dataset.k] = v; });
        const nk = $('#kr-licz-konto').value.trim(), ni = parseInt($('#kr-licz-ile').value); if (nk && !isNaN(ni)) d[kluczKonta(nk)] = ni;
        lsSet(L_DOBRE_KONTO, JSON.stringify(d)); }
      zapiszProfile(profile);
      localStorage.setItem(L_PROFIL_AKT, nazwaProfilu);
      o.remove();
      status('zapisano kroki – profil ' + nazwaProfilu);
      setTimeout(() => location.reload(), 600);              // przeładuj, żeby skrypt użył nowych kroków
    };
    rysujProfile(); rysujListe();
  }

  // =========================================================
  // ===== POWIADOMIENIA NA TELEFON + STEROWANIE (ntfy.sh) =====
  // Darmowa apka "ntfy" (iPhone / Android). Skrypt wysyła powiadomienia na Twój temat,
  // a przyciski w powiadomieniu wysyłają komendy z powrotem na temat-cmd, którego skrypt słucha.
  // =========================================================
  const L_NTFY = 'autoNtfyTemat';
  const L_NTFY_ON = 'autoNtfyOn';
  const L_NTFY_KOMENDA = 'autoNtfyOstatniaKomenda';
  if (!lsGet(L_NTFY)) {
    const losowe = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => (b % 36).toString(36)).join('');
    lsSet(L_NTFY, 'base-automap-' + losowe);
  }
  const ntfyTemat = () => lsGet(L_NTFY);
  const ntfyWlaczone = () => lsGet(L_NTFY_ON) === '1';
  // która przeglądarka wysyła – widać w każdym powiadomieniu, a przyciski sterują tylko nią
  const PRZEGLADARKA = (() => {
    // własna nazwa (np. drugi profil Chrome: "Chrome 2") – ustawiana w oknie 📱, osobno w każdym profilu
    const wlasna = (localStorage.getItem('autoNazwaPrzegl') || '').trim();
    if (wlasna) return { id: wlasna.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ''), nazwa: wlasna, ikona: /safari/i.test(wlasna) ? '🧭' : '🟡' };
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return { id: 'edge', nazwa: 'Edge', ikona: '🟦' };
    if (/Firefox\//.test(ua)) return { id: 'firefox', nazwa: 'Firefox', ikona: '🦊' };
    if (/Chrome|Chromium|CriOS/.test(ua)) return { id: 'chrome', nazwa: 'Chrome', ikona: '🟡' };
    if (/Safari/.test(ua)) return { id: 'safari', nazwa: 'Safari', ikona: '🧭' };
    return { id: 'inna', nazwa: 'Przeglądarka', ikona: '🖥' };
  })();
  // temat ntfy zawsze z nazwą profilu, np. automap-safari-profil-3-k7x2p9q4 (końcówka losowa = hasło, zostaje)
  const slugTematu = () => PRZEGLADARKA.nazwa.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  {
    const koncowka = (ntfyTemat().split('-').pop() || '').slice(0, 8);
    const chciany = 'automap-' + slugTematu() + '-' + koncowka;
    if (koncowka.length === 8 && ntfyTemat() !== chciany) lsSet(L_NTFY, chciany);
  }
  async function kopiujTekst(tekst) {               // Safari: clipboard API bywa blokowane – zapasowo execCommand
    try { await navigator.clipboard.writeText(tekst); return true; } catch {}
    try { const ta = document.createElement('textarea'); ta.value = tekst; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, tekst.length); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
  }
  function opisZrodla() {                            // np. "🧭 Safari · FINALNE DUŻE · StalMarketPL"
    try {
      let oczek = null;
      try { oczek = JSON.parse(localStorage.getItem('autoPaczkaWToku') || 'null'); } catch {}
      const g = grupaFinalne();
      return PRZEGLADARKA.ikona + ' ' + PRZEGLADARKA.nazwa + ' · ' + PROCES.nazwa + (g ? ' ' + g.nazwa : '') + (oczek && oczek.konto ? ' · ' + oczek.konto : '');
    } catch { return PRZEGLADARKA.nazwa; }
  }
  async function powiadom(tytul, tresc, opcje = {}) {
    if (!ntfyWlaczone() && !opcje.wymus) return;
    try {
      const body = {
        topic: ntfyTemat(),
        title: PRZEGLADARKA.ikona + ' ' + PRZEGLADARKA.nazwa + ' | ' + tytul,
        message: tresc + '\n— ' + opisZrodla(),
        priority: opcje.priorytet || 3,
        tags: opcje.tagi || [],
        actions: (opcje.akcje || []).map(([etykieta, komenda]) => ({
          action: 'http', label: etykieta, url: 'https://ntfy.sh/' + ntfyTemat() + '-cmd',
          method: 'POST', body: komenda + '@' + PRZEGLADARKA.id, clear: true   // komenda tylko dla tej przeglądarki
        }))
      };
      await fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify(body) });
    } catch (e) { console.log('[AutoMap] ntfy błąd', e); }
  }

  // nasłuch komend z telefonu
  const obslugiKomend = [];
  function naKomende(fn) { obslugiKomend.push(fn); }
  function sluchajKomend() {
    if (!ntfyWlaczone()) return;
    let es;
    try {
      es = new EventSource('https://ntfy.sh/' + ntfyTemat() + '-cmd/sse');
    } catch { return; }
    es.onmessage = e => {
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (!d || d.event !== 'message' || !d.message) return;
      const [kom, cel] = String(d.message).trim().toLowerCase().split('@').map(x => x.trim());
      if (cel && cel !== PRZEGLADARKA.id) return;      // komenda dla innej przeglądarki (np. przycisk z powiadomienia Safari)
      // ta sama komenda może przyjść do kilku kart – "zajmij" ją, żeby odpowiedziała jedna
      const zajeta = lsGet(L_NTFY_KOMENDA);
      const pierwsza = zajeta !== d.id;
      if (pierwsza) lsSet(L_NTFY_KOMENDA, d.id);
      obslugiKomend.forEach(fn => { try { fn(kom, pierwsza); } catch (err) { console.log(err); } });
    };
    es.onerror = () => { /* przeglądarka sama wznowi połączenie */ };
  }

  // „cała paczka niedopasowana 3×” → dopisz te produkty do spisu (nie wrócą) i włącz cykl dalej
  async function dopiszNiedopIJedz(zEkranu) {
    let st = null; try { st = JSON.parse(lsGet('autoNiedopFin') || 'null'); } catch {}
    if (!st || !st.ids || !st.ids.length) { status('nie ma czekającej paczki do dopisania'); return; }
    dodajDoSpisu(st.ids);
    if (procesKlucz() === 'przerobki' && st.kat) dodajDoSpisuBezOferty(st.kat, st.ids);
    lsDel('autoNiedopFin');
    schowajAlarm();
    lsSet(L_CYKL, '1'); lsSet(L_AUTO, '1'); if (st.full) lsSet(L_FULL, '1');
    status('📋 dopisano ' + st.ids.length + ' niedopasowanych do spisu – biorę następną paczkę');
    powiadom('📋 Dopisane, jadę dalej', st.ids.length + ' niedopasowanych produktów w spisie – nie wrócą.' + (zEkranu ? '' : ' (z telefonu)'), { tagi: ['clipboard'] });
    odswiezPrzyciski();
    await czekaj(1500);
    await wrocDoKatalogu();
  }

  // komendy wspólne dla każdej strony
  naKomende((kom, pierwsza) => {
    if (kom === 'dopisz' && pierwsza) { dopiszNiedopIJedz(false); return; }
    if (kom === 'stop' || kom === 'reczny') {
      lsDel(L_FULL); lsDel(L_CYKL); lsDel(L_ETAP); lsSet(L_AUTO, '0');
      sessionStorage.removeItem(K_RUN);
      przerwanoKatalog = true;
      status('📱 zatrzymano z telefonu – tryb RĘCZNY');
      odswiezPrzyciski();
      if (pierwsza) powiadom('⏹ Zatrzymano', 'Skrypt przeszedł w tryb RĘCZNY.', { tagi: ['stop_sign'] });
    } else if (kom === 'auto' || kom === 'full') {
      lsSet(L_CYKL, '1'); lsSet(L_AUTO, '1');
      if (kom === 'full') lsSet(L_FULL, '1'); else lsDel(L_FULL);
      status('📱 tryb ' + (kom === 'full' ? '☠️ FULL AUTO' : 'AUTO') + ' z telefonu');
      odswiezPrzyciski();
      if (pierwsza) powiadom('Tryb ' + (kom === 'full' ? '☠️ FULL AUTO' : 'AUTO'), 'Ustawione z telefonu.', { tagi: ['robot'] });
    } else if (kom === 'koniecprzer' && pierwsza) {
      status('📱 z telefonu: kończę oferty z przeróbek…');
      koniecPrzerobek();
    } else if (kom === 'status' && pierwsza) {
      const r = lsJson(L_RAPORT);
      const ost = r[r.length - 1];
      const suma = k => r.reduce((a, w) => a + (Number(w[k]) || 0), 0);
      powiadom('📊 Status', liveOpisTekstowy() +
        '\nTryb: ' + (!trybAuto() ? 'RĘCZNY' : (lsGet(L_FULL) === '1' ? 'FULL AUTO' : 'AUTO')) + ' · ' + PROCES.nazwa +
        '\nRazem: ' + suma('dobre') + ' dobrych / ' + r.reduce((a, w) => a + (Number(w.probowano ?? w.wszystkie) || 0), 0) + ' wziętych, niedopasowane ' + suma('niedopasowane') +
        (ost ? '\nOstatnie (nr ' + ost.nr + ', ' + ost.data.slice(11) + '): ' + (ost.dobre ?? '?') + ' dobrych z ' + (ost.probowano ?? ost.wszystkie) : ''),
        { tagi: ['bar_chart'], akcje: [['⏹ Stop', 'stop'], ['🤖 Auto', 'auto'], ['☠️ Full', 'full']] });
    }
  });

  function pokazTelefon() {
    document.getElementById('am-tel')?.remove();
    const o = document.createElement('div');
    o.id = 'am-tel';
    o.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:22px;border-radius:12px;width:min(560px,94vw);font-family:sans-serif;font-size:14px;line-height:1.5">
      <div style="font-size:18px;font-weight:bold;margin-bottom:8px">📱 Powiadomienia na telefon</div>
      <ol style="margin:0 0 10px 18px;padding:0">
        <li>Zainstaluj na telefonie darmową apkę <b>ntfy</b> (App Store / Google Play).</li>
        <li>W apce kliknij <b>+</b> i wpisz temat:<br>
          <code id="am-tel-temat" style="display:inline-block;margin-top:4px;background:#0f1720;padding:4px 8px;border-radius:6px;user-select:all">${ntfyTemat()}</code>
          <button id="am-tel-kopiuj" style="margin-left:6px;background:#455a64;color:#fff;border:0;border-radius:6px;padding:3px 8px;cursor:pointer">Kopiuj</button></li>
        <li>Włącz powiadomienia poniżej i kliknij <b>Test</b>.</li>
      </ol>
      <div style="font-size:12.5px;opacity:.8;margin-bottom:12px">Dostaniesz: GOTOWE do wystawienia (z przyciskami <b>Wystaw</b> / <b>Anuluj</b>), zakończone wystawienie z wynikiem, zatrzymane wystawianie (stoi 2 min), koniec katalogu, błędy.<br>
      Z telefonu możesz też wysłać na temat <code>${ntfyTemat()}-cmd</code> słowo: <b>status</b>, <b>stop</b>, <b>auto</b>, <b>full</b>, <b>wystaw</b>.<br>
      Temat działa jak hasło – nie udostępniaj go nikomu.</div>
      <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px;cursor:pointer"><input type="checkbox" id="am-tel-on" ${ntfyWlaczone() ? 'checked' : ''}> Wysyłaj powiadomienia i słuchaj komend z telefonu</label>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;font-size:13px">
        <span>Nazwa tej przeglądarki / profilu:</span>
        <input id="am-tel-nazwa" value="${PRZEGLADARKA.nazwa}" placeholder="np. Chrome 2" style="flex:1;min-width:0;background:#0f1720;color:#fff;border:1px solid #333;border-radius:6px;padding:4px 8px">
        <button id="am-tel-nazwa-ok" style="background:#455a64;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer">Zapisz</button>
      </div>
      <div style="font-size:12px;opacity:.75;margin:-6px 0 12px">Temat bierze się z nazwy profilu – po zmianie nazwy i Zapisz temat zmieni się sam (dodaj go wtedy w apce na nowo).</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="am-tel-test" style="background:#2e7d32;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Test</button>
        <button id="am-tel-zamknij" style="background:#555;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Zamknij</button>
      </div></div>`;
    document.body.appendChild(o);
    o.querySelector('#am-tel-zamknij').onclick = () => o.remove();
    o.querySelector('#am-tel-nazwa-ok').onclick = () => {
      const v = o.querySelector('#am-tel-nazwa').value.trim();
      if (v) localStorage.setItem('autoNazwaPrzegl', v); else localStorage.removeItem('autoNazwaPrzegl');
      location.reload();                               // nazwa wchodzi w życie po odświeżeniu
    };
    const bNazwij = o.querySelector('#am-tel-nazwij');
    if (bNazwij) bNazwij.onclick = () => {
      // zachowaj losową końcówkę (temat działa jak hasło), dodaj nazwę przeglądarki
      const koncowka = (ntfyTemat().split('-').pop() || '').slice(0, 8) ||
        Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => (b % 36).toString(36)).join('');
      lsSet(L_NTFY, 'automap-' + PRZEGLADARKA.id + '-' + koncowka);
      o.remove();
      pokazTelefon();                                  // pokaż okno z nowym tematem do skopiowania
      sluchajKomend();
    };
    o.querySelector('#am-tel-kopiuj').onclick = async e => {
      const ok = await kopiujTekst(ntfyTemat());
      e.target.textContent = ok ? 'Skopiowano ✔' : 'Zaznacz i Cmd+C';
      if (!ok) { const r = document.createRange(); r.selectNodeContents(o.querySelector('#am-tel-temat')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      setTimeout(() => { e.target.textContent = 'Kopiuj'; }, 2500);
    };
    o.querySelector('#am-tel-on').onchange = e => {
      lsSet(L_NTFY_ON, e.target.checked ? '1' : '0');
      odswiezPrzyciski();
      if (e.target.checked) sluchajKomend();
    };
    o.querySelector('#am-tel-test').onclick = () => { if (!ntfyWlaczone()) { lsSet(L_NTFY_ON, '1'); o.querySelector('#am-tel-on').checked = true; odswiezPrzyciski(); sluchajKomend(); status('📱 powiadomienia WŁĄCZONE'); } powiadom('✅ Test AutoMap', 'Powiadomienia działają. Kliknij przycisk, żeby sprawdzić sterowanie.', { wymus: true, tagi: ['white_check_mark'], akcje: [['📊 Status', 'status']] }); };
  }

  // ---- przesuwanie panelu + zapamiętanie miejsca ----
  const L_POZ = 'autoPanelPozycja';
  function ustawPozycje(x, y) {
    const r = panelUI.getBoundingClientRect();
    x = Math.min(Math.max(0, x), window.innerWidth - Math.min(r.width, window.innerWidth));
    y = Math.min(Math.max(0, y), window.innerHeight - Math.min(r.height, window.innerHeight));
    panelUI.style.left = x + 'px';
    panelUI.style.top = y + 'px';
    panelUI.style.bottom = 'auto';
    panelUI.style.right = 'auto';
  }
  try {
    const poz = JSON.parse(localStorage.getItem(L_POZ) || 'null');
    if (poz) requestAnimationFrame(() => ustawPozycje(poz.x, poz.y));
  } catch {}
  let ciagnie = null;
  uchwyt.addEventListener('pointerdown', e => {
    const r = panelUI.getBoundingClientRect();
    ciagnie = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    uchwyt.setPointerCapture(e.pointerId);
    uchwyt.style.cursor = 'grabbing';
    e.preventDefault();
  });
  uchwyt.addEventListener('pointermove', e => {
    if (!ciagnie) return;
    ustawPozycje(e.clientX - ciagnie.dx, e.clientY - ciagnie.dy);
  });
  uchwyt.addEventListener('pointerup', () => {
    if (!ciagnie) return;
    ciagnie = null;
    uchwyt.style.cursor = 'grab';
    const r = panelUI.getBoundingClientRect();
    try { localStorage.setItem(L_POZ, JSON.stringify({ x: r.left, y: r.top })); } catch {}
  });
  uchwyt.addEventListener('dblclick', () => {
    try { localStorage.removeItem(L_POZ); } catch {}
    panelUI.style.left = '12px'; panelUI.style.bottom = '12px';
    panelUI.style.top = 'auto'; panelUI.style.right = 'auto';
  });
  window.addEventListener('resize', () => {
    if (panelUI.style.top && panelUI.style.top !== 'auto') {
      ustawPozycje(parseFloat(panelUI.style.left) || 0, parseFloat(panelUI.style.top) || 0);
    }
  });

  function odswiezPrzyciski() {
    if (bTryb && typeof bTryby !== 'undefined') {
      const a = cyklWlaczony() && lsGet(L_AUTO) === '1';
      const t = !a ? 'reczny' : (lsGet(L_FULL) === '1' ? 'full' : 'auto');
      for (const [k, b] of Object.entries(bTryby)) {
        const akt = k === t;
        b.style.background = akt ? b.dataset.kolor : 'transparent';
        b.style.opacity = akt ? '1' : '.55';
      }
    }
    bCykl.textContent = cyklWlaczony() ? '🔁 Cykl: ON' : '🔁 Cykl: OFF';
    bCykl.style.opacity = cyklWlaczony() ? '1' : '.6';
    bAuto.textContent = lsGet(L_AUTO) === '1' ? 'Auto: ON' : 'Auto: OFF';
    bAuto.style.opacity = lsGet(L_AUTO) === '1' ? '1' : '.6';
    bSpis.textContent = '📋 ' + spis().size;
    if (bTel) bTel.style.background = (localStorage.getItem('autoNtfyOn') === '1') ? '#1565c0' : '#455a64';
    bRozmiar.textContent = '📦 ' + paczka();
    if (bStart) { bStart.textContent = dziala() ? '▶ Działa' : '▶ Start'; bStart.style.opacity = dziala() ? '.6' : '1'; }
  }


  // ---- po zakończeniu wystawiania: dopisz produkty do spisu + wpis do raportu ----
  // pominięte kroki tej paczki z powodem, np. "Nazwa – pomijam (brak pola)"
  function opisPominietych() {
    let m = {};
    try { m = JSON.parse(sessionStorage.getItem('am_' + LID + '_powody') || '{}'); } catch {}
    let pom = [];
    try { pom = JSON.parse(sessionStorage.getItem(K_SKIP) || '[]'); } catch {}
    return pom.map(n => n + (m[n] ? ' (' + String(m[n]).replace(/^pomijam\s*/i, '').replace(/[()]/g, '') + ')' : ''));
  }

  // na listę 📋 idą TYLKO produkty, które weszły do formularza (dobre, błędne, niedopasowane).
  // Te, których Base nie wczytał („Wystąpił błąd przy pobieraniu formularza”), NIE idą – wrócą w kolejnej paczce.
  const odrzuconeTejPaczki = () => { try { return new Set(JSON.parse(sessionStorage.getItem('am_' + LID + '_odrzucone') || '[]').map(String)); } catch { return new Set(); } };
  function zapiszWczytaneDoSpisu(ids) {
    try {
      if (!ids || !ids.length) return;
      const oczek = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null');
      dodajDoSpisu(ids);
      if (oczek && oczek.bezOferty && oczek.katId) dodajDoSpisuBezOferty(oczek.katId, ids);
      if (oczek) { oczek.wSpisie = Date.now(); localStorage.setItem(L_OCZEKUJACA, JSON.stringify(oczek)); }
      odswiezPrzyciski();
    } catch {}
  }
  // klik WYSTAW – DOPIERO TERAZ na listę 📋: wszystko, co się wczytało do formularza (wystawiane + usunięte jako niedopasowane).
  // Niewczytane (np. wczytało się 450 z 500) – ani na liście, ani w pamięci: wrócą w następnej paczce.
  // Paczka porzucona przed WYSTAW (zamknięta karta / cofnięcie) – nic nie idzie na listę.
  async function zapiszPaczkeDoSpisuPrzyWystaw() {
    try {
      const oczek = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null');
      if (!oczek || oczek.wSpisie) return;
      let przed = [];
      try { przed = JSON.parse(sessionStorage.getItem('am_' + LID + '_idsPrzed') || '[]'); } catch {}
      if (!przed.length && Array.isArray(oczek.wczytane)) przed = oczek.wczytane;
      let teraz = [];
      if (await mostOk()) { const r = await bazaBase('idsProduktow', {}, 30000); if (r.wynik && r.wynik.ids) teraz = r.wynik.ids; }
      const odrz = odrzuconeTejPaczki();
      let ids = [...new Set([...przed, ...teraz].map(String))].filter(id => !odrz.has(id));
      if (!ids.length && Array.isArray(oczek.ids)) ids = oczek.ids.map(String).filter(id => !odrz.has(id));   // ostateczność: nie dało się odczytać formularza
      zapiszWczytaneDoSpisu(ids);
    } catch {}
  }

  const ignorujBledy = () => lsGet('autoIgnorujBledy') === '1';     // 🙈 dokańczanie sklepu: leć dalej mimo błędnych paczek
  async function zapiszPoWystawieniu(opcje = {}) {
    if (!opcje.pusta) lsDel('autoNiedopFin');            // paczka coś dopasowała – licznik „cała niedopasowana” od zera
    let oczek = null;
    try { oczek = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null'); } catch {}
    let ids = [];
    let liczniki = null;
    if (await mostOk()) {
      const r1 = await bazaBase('idsProduktow', {}, 30000);
      if (r1.wynik && r1.wynik.ids) ids = r1.wynik.ids;
      const r2 = await bazaBase('liczniki', {}, 30000);
      if (r2.wynik) liczniki = r2.wynik;
    }
    {   // okno „Wysyłanie”: Wysłanych = poszło do Allegro bez błędu (Poprawnych Allegro dolicza później) – liczniki Base bywają w tyle
      let o = null; try { o = JSON.parse(sessionStorage.getItem('am_' + LID + '_okno') || 'null'); } catch {}
      if (o && liczniki && (Number(liczniki.sent) || 0) < o.w) { liczniki = Object.assign({}, liczniki, { sent: o.w, error: Math.max(Number(liczniki.error) || 0, o.b), zOkna: true }); }
      else if (o && !liczniki) liczniki = { sent: o.w, error: o.b, total: o.w + o.b, draft: 0, zOkna: true };
    }
    // do spisu: WSZYSTKO, co próbowaliśmy wystawić – także usunięte jako niedopasowane (żeby nie wracały w kółko)
    let idsPrzed = [];
    try { idsPrzed = JSON.parse(sessionStorage.getItem('am_' + LID + '_idsPrzed') || '[]'); } catch {}
    const odrzP = odrzuconeTejPaczki();
    if (!idsPrzed.length && oczek && Array.isArray(oczek.wczytane)) idsPrzed = oczek.wczytane;
    const zPaczki = [...new Set([...((oczek && oczek.ids) || []), ...idsPrzed])];
    // na listę tylko WCZYTANE (przed usunięciem niedopasowanych + to, co zostało w formularzu); niewczytane wracają do kolejki
    let wszystkieIds = [...new Set([...idsPrzed, ...ids].map(String))].filter(id => !odrzP.has(id));
    if (!wszystkieIds.length) wszystkieIds = zPaczki.map(String).filter(id => !odrzP.has(id));
    const sentL = Number(liczniki && liczniki.sent) || 0, errL = Number(liczniki && liczniki.error) || 0, totL = Number(liczniki && liczniki.total) || 0;
    // produkty, których Base ani nie wystawił, ani nie oznaczył jako błędne (np. „brak prawidłowych ofert”, przerwane wysyłanie)
    // – NIE idą do spisu, mają wrócić w kolejnej paczce
    let wroca = [];
    if (!opcje.pusta && liczniki && sentL + errL > 0 && totL > sentL + errL && await mostOk()) {
      const rn = await bazaBase('niewystawione', {}, 60000);
      const kand = (rn.wynik && rn.wynik.ok && Array.isArray(rn.wynik.ids)) ? rn.wynik.ids.map(String) : [];
      if (kand.length && kand.length <= (totL - sentL - errL) + 5) wroca = kand;
      else console.log('[AutoMap] niewystawione – nie biorę pod uwagę (' + kand.length + ' z ' + (totL - sentL - errL) + ')', rn);
    }
    if (wroca.length) {
      const l = lsJson(L_NIEDOKONCZONE);
      l.push({ t: Date.now(), proces: PROCES.nazwa, konto: (oczek && oczek.konto) || '', kat: (oczek && oczek.katNazwa) || '', ids: wroca, opis: 'nie wystawione i nie błędne – zostawiam poza spisem, wrócą w kolejnej paczce' });
      lsSet(L_NIEDOKONCZONE, JSON.stringify(l.slice(-200)));
      powiadom('↩︎ ' + wroca.length + ' produktów wraca do kolejki', 'Base ich nie wystawił i nie oznaczył jako błędne (wystawione ' + sentL + ', błędne ' + errL + ' / ' + totL + ') – nie dopisuję ich do spisu, wrócą w następnej paczce.', { priorytet: 4, tagi: ['leftwards_arrow_with_hook'] });
      wszystkieIds = wszystkieIds.filter(id => !wroca.includes(String(id)));
    }
    // paczka, która się NIE wystawiła (0 dobrych i 0 błędnych / brak liczników) – NIE dopisuj do spisu, wróci w następnej paczce
    const nieWyszla = !opcje.pusta && (!liczniki || sentL + errL === 0);
    // 0 dobrych, same błędy – też nie do spisu (niżej: STOP cyklu, żeby nie leciał dalej po paczkach bez wystawiania)
    const zeroDobrych = !opcje.pusta && !nieWyszla && !!liczniki && sentL === 0 && !ignorujBledy();
    if (nieWyszla) {
      const niedopIds = idsPrzed.filter(id => !ids.map(String).includes(String(id)));   // tylko faktycznie niedopasowane idą do spisu
      if (niedopIds.length && ids.length) dodajDoSpisu(niedopIds);
      lsSet('autoNieWyszlaOst', JSON.stringify({ t: Date.now(), ids: zPaczki }));
      const licz = (parseInt(lsGet('autoNieWyszlaLicz', '0')) || 0) + 1;
      lsSet('autoNieWyszlaLicz', String(licz));
      if (licz >= 2) {                                   // druga z rzędu – coś jest nie tak, stop zamiast kręcić się w kółko
        lsDel(L_FULL); lsDel(L_CYKL); lsDel(L_ETAP); lsSet(L_AUTO, '0'); lsDel('autoNieWyszlaLicz');
        pokazAlarm('2 PACZKI Z RZĘDU SIĘ NIE WYSTAWIŁY', 'Zatrzymałem cykl. Sprawdź Base / konto Allegro i włącz ponownie.');
      }
      powiadom('⚠️ Paczka się NIE wystawiła', 'Wzięto ' + zPaczki.length + ', wystawiono 0. Produkty zostają poza spisem 📋 – wrócą w kolejnej paczce. Sprawdź Base / konto Allegro.\n' + PROCES.nazwa + ' · ' + ((oczek && oczek.konto) || ''), { priorytet: 5, tagi: ['warning'] });
    } else { lsDel('autoNieWyszlaLicz'); if (wszystkieIds.length && !zeroDobrych) dodajDoSpisu(wszystkieIds); }
    const katP = (oczek && oczek.katId) || lsGet(L_KATALOG, '') || '';
    if (oczek && oczek.bezOferty && katP) {               // tryb „bez oferty”: wzięte raz → w tym katalogu już nie wracają
      const doBO = nieWyszla ? idsPrzed.filter(id => !ids.map(String).includes(String(id))) : wszystkieIds;
      if (doBO.length && (!nieWyszla || ids.length) && !zeroDobrych) dodajDoSpisuBezOferty(katP, doBO);
    }
    lsSet('autoOstatniaPaczka', JSON.stringify({ kat: katP, ids: zPaczki.map(String).filter(id => !odrzP.has(id)), nieWyszla, t: Date.now() }));   // tylko wczytane – niewczytane mają prawo wrócić
    if (!opcje.pusta && !nieWyszla && liczniki) {         // 0 dobrych (same błędy) → STOP od razu, nie bierzemy kolejnej paczki
      if (sentL === 0 && ignorujBledy()) {
        status('🙈 paczka bez dobrych ofert (błędne ' + errL + ') – lecę mimo błędów, biorę kolejną');
        powiadom('🙈 Paczka same błędy – lecę dalej', 'wystawione 0, błędne ' + errL + ' z ' + (totL || zPaczki.length) + ' · ' + ((oczek && oczek.konto) || '') + '\nTryb „lecę mimo błędów” – biorę kolejną paczkę.', { priorytet: 3, tagi: ['see_no_evil'] });
      } else if (sentL === 0) {
        lsDel('autoZeroDobrychLicz');
        zatrzymajCykl('PACZKA BEZ ANI JEDNEJ DOBREJ OFERTY', ((oczek && oczek.konto) || '') + ': wystawione 0, błędne ' + errL + ' z ' + (totL || zPaczki.length) + '. Nie biorę kolejnej paczki. Produkty zostają POZA spisem – wrócą, jak włączysz cykl.');
      } else lsDel('autoZeroDobrychLicz');
    }
    lsDel(L_OCZEKUJACA);
    const przed = parseInt(sessionStorage.getItem('am_' + LID + '_przedNiedop'));
    const po = parseInt(sessionStorage.getItem('am_' + LID + '_poNiedop'));
    const wczytane = !isNaN(przed) ? przed : (zPaczki.length || (liczniki ? liczniki.total : ids.length));
    const niedopasowane = (!isNaN(przed) && !isNaN(po)) ? Math.max(0, przed - po) : null;

    const teraz = new Date();
    const dwa = n => String(n).padStart(2, '0');
    const raport = lsJson(L_RAPORT);
    const wpis = {
      nr: (raport.length ? (raport[raport.length - 1].nr || raport.length) : 0) + 1,
      data: teraz.getFullYear() + '-' + dwa(teraz.getMonth() + 1) + '-' + dwa(teraz.getDate()) + ' ' + dwa(teraz.getHours()) + ':' + dwa(teraz.getMinutes()) + ':' + dwa(teraz.getSeconds()),
      proces: PROCES.nazwa,
      konto: ((oczek && oczek.konto) || '') + (oczek && oczek.grupa ? ' · ' + oczek.grupa : ''),
      listing: LID,
      probowano: Math.max(wczytane, wszystkieIds.length),           // ile produktów wzięto z katalogu
      niedopasowane,                                                 // usunięte jako niedopasowane
      wszystkie: opcje.pusta ? 0 : (liczniki ? liczniki.total : ids.length), // ile zostało do wystawienia
      dobre: opcje.pusta ? 0 : (liczniki ? liczniki.sent : null),
      bledne: opcje.pusta ? 0 : (liczniki ? liczniki.error : null),
      niewyslane: opcje.pusta ? 0 : (liczniki ? liczniki.draft : null),
      bezWystawienia: !!opcje.pusta,
      pominiete: (nieWyszla ? ['⚠ NIE WYSTAWIONO – produkty są w spisie 📋'] : []).concat(opisPominietych()),   // kroki, których nie dało się zrobić
      odrzucone: (() => { try { return JSON.parse(sessionStorage.getItem('am_' + LID + '_odrzucone') || '[]'); } catch { return []; } })(), // ID nie wczytane przez Base
      powtorzone: oczek && oczek.powtorzone != null ? oczek.powtorzone : null,   // ile ID było już w poprzedniej paczce
      bezOferty: !!(oczek && oczek.bezOferty),
      wersja: (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || ''
    };
    raport.push(wpis);
    lsSet(L_RAPORT, JSON.stringify(raport.slice(-500)));
    {
      const ost3 = raport.slice(-3);
      const slabe = w => !w.bezWystawienia && (Number(w.probowano) || 0) >= 50 && (Number(w.dobre) || 0) / (Number(w.probowano) || 1) < 0.15;
      if (ost3.length === 3 && ost3.every(w => w.konto === wpis.konto && slabe(w)) && cyklWlaczony() && !ignorujBledy()) {
        zatrzymajCykl('3 PACZKI Z RZĘDU PONIŻEJ 15%', (wpis.konto || '') + ': trzy paczki pod rząd z bardzo małą liczbą dobrych (' + ost3.map(w => (w.dobre || 0) + '/' + w.probowano).join(', ') + '). Zatrzymałem – sprawdź błędy / niedopasowane w Base.');
      }
    }
    if (!opcje.pusta) { lsDel('autoNiedopProba'); lsDel('autoNiedopSeria'); }   // udana paczka – liczniki „cała paczka niedopasowana” od nowa
    const kontoL = (oczek && oczek.konto) || '';                 // samo konto (bez „· grupa”)
    if (!opcje.pusta && kontoL && Number(wpis.dobre) > 0) {
      const razem = dodajDobre(kontoL, wpis.dobre), lim = limitDobrych();
      if (razem >= lim) {
        zatrzymajCykl('LIMIT ' + lim.toLocaleString('pl-PL') + ' OFERT – ' + kontoL, 'Na koncie ' + kontoL + ' wystawiono już ' + razem.toLocaleString('pl-PL') + ' poprawnych ofert (' + PROCES.nazwa + '). Allegro ma limit 20 000 – zatrzymałem. Licznik zmienisz / wyzerujesz w ⚙️ Kroki.');
      } else if (razem >= lim - 1000 && razem - Number(wpis.dobre) < lim - 1000) {
        powiadom('⚠️ ' + kontoL + ': blisko limitu', razem.toLocaleString('pl-PL') + ' / ' + lim.toLocaleString('pl-PL') + ' poprawnych ofert na tym koncie.', { priorytet: 4, tagi: ['warning'] });
      }
    }
    powiadom(wpis.bezWystawienia ? '↷ Paczka bez wystawienia' : '📦 Wystawiono paczkę nr ' + wpis.nr,
      'Wzięto ' + wpis.probowano + ' · niedopasowane ' + (wpis.niedopasowane ?? '?') + (wpis.odrzucone.length ? ' · odrzucone przez Base ' + wpis.odrzucone.length : '') + '\nWystawione ' + (wpis.dobre ?? '?') + ' · błędne ' + (wpis.bledne ?? '?') + (wpis.pominiete.length ? '\n⚠️ Pominięte: ' + wpis.pominiete.join(', ') : '') + '\n' + PROCES.nazwa + ' · ' + (wpis.konto || ''),
      { tagi: ['package'], akcje: [['📊 Status', 'status'], ['⏹ Stop', 'stop']] });
    status('nr ' + wpis.nr + ': wzięto ' + wpis.probowano + ', niedopasowane ' + (wpis.niedopasowane ?? '?') + ', wystawione ' + (wpis.dobre ?? '?') + ', błędne ' + (wpis.bledne ?? '?'));
    odswiezPrzyciski();
  }

  function pokazRaport() {
    document.getElementById('am-raport')?.remove();
    const r = lsJson(L_RAPORT).slice().reverse();
    const suma = (k) => r.reduce((a, w) => a + (Number(w[k]) || 0), 0);
    const proba = w => w.probowano ?? w.wszystkie;
    const sumaProb = r.reduce((a, w) => a + (Number(proba(w)) || 0), 0);
    const td = 'padding:5px 7px;border-bottom:1px solid #333;text-align:right;white-space:nowrap';
    const o = document.createElement('div');
    o.id = 'am-raport';
    o.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    const pr = (a, b) => (b ? Math.round(a / b * 100) + '%' : '–');
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:20px;border-radius:12px;width:min(980px,96vw);font-family:sans-serif;max-height:90vh;overflow:auto">
      <div style="font-size:18px;font-weight:bold;margin-bottom:8px">Raport wystawiania</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;font-size:13px">
        <div style="background:#263445;padding:8px 12px;border-radius:8px">Wzięto z katalogu<br><b style="font-size:18px">${sumaProb}</b></div>
        <div style="background:#263445;padding:8px 12px;border-radius:8px">Niedopasowane (usunięte)<br><b style="font-size:18px;color:#ffb74d">${suma('niedopasowane')}</b></div>
        <div style="background:#263445;padding:8px 12px;border-radius:8px">Do wystawienia<br><b style="font-size:18px">${suma('wszystkie')}</b></div>
        <div style="background:#263445;padding:8px 12px;border-radius:8px">Wystawione (dobre)<br><b style="font-size:18px;color:#81c784">${suma('dobre')}</b></div>
        <div style="background:#263445;padding:8px 12px;border-radius:8px">Błędne<br><b style="font-size:18px;color:#e57373">${suma('bledne')}</b></div>
        <div style="background:#263445;padding:8px 12px;border-radius:8px">Skuteczność (dobre / wzięte)<br><b style="font-size:18px">${pr(suma('dobre'), sumaProb)}</b></div>
      </div>
      ${r.length ? `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <tr style="opacity:.7"><td style="${td};text-align:left">Nr</td><td style="${td};text-align:left">Data i godzina</td><td style="${td};text-align:left">Proces</td><td style="${td};text-align:left">Konto</td><td style="${td}">Wzięto</td><td style="${td}" title="ile produktów było już w poprzedniej paczce">Powt.</td><td style="${td}">Niedopas.</td><td style="${td}">Do wyst.</td><td style="${td}">Dobre</td><td style="${td}">Błędne</td><td style="${td}">Skut.</td><td style="${td}">Odrzuc. Base</td><td style="${td};text-align:left">Pominięte kroki</td></tr>
        ${r.map(w => `<tr${w.bezWystawienia ? ' style="opacity:.75"' : ''}><td style="${td};text-align:left">${w.nr}</td><td style="${td};text-align:left">${w.data}</td><td style="${td};text-align:left" title="${w.wersja || ''}">${w.proces || ''}${w.bezOferty ? ' 🔁' : ''}</td><td style="${td};text-align:left">${w.konto || ''}</td><td style="${td}">${proba(w) ?? '?'}</td><td style="${td};color:${(w.powtorzone || 0) > 0 ? '#e57373' : 'inherit'}">${w.powtorzone ?? '–'}</td><td style="${td};color:#ffb74d">${w.niedopasowane ?? '?'}</td><td style="${td}">${w.wszystkie ?? '?'}</td><td style="${td};color:#81c784;font-weight:bold">${w.dobre ?? '?'}</td><td style="${td};color:#e57373">${w.bledne ?? '?'}</td><td style="${td}">${w.bezWystawienia ? 'wszystkie niedopas.' : pr(w.dobre || 0, proba(w))}</td><td style="${td}" title="${(w.odrzucone || []).join(', ')}">${(w.odrzucone || []).length ? w.odrzucone.length + ' ⓘ' : '–'}</td><td style="${td};text-align:left;color:#ffb74d;white-space:normal;max-width:220px">${(w.pominiete || []).join(', ') || '–'}</td></tr>`).join('')}
      </table>` : '<div style="opacity:.8">Brak wpisów – pojawią się po pierwszym zakończonym wystawianiu.</div>'}
      <div style="font-size:12px;opacity:.65;margin-top:10px">Wszystkie wzięte produkty (także niedopasowane i błędne) trafiają do spisu 📋 i nie są brane ponownie.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button id="am-raport-kopiuj" style="background:#455a64;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Kopiuj</button>
        <button id="am-raport-wyczysc" style="background:#c62828;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Wyczyść raport</button>
        <button id="am-raport-zamknij" style="background:#555;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Zamknij</button>
      </div></div>`;
    document.body.appendChild(o);
    o.querySelector('#am-raport-zamknij').onclick = () => o.remove();
    o.querySelector('#am-raport-wyczysc').onclick = () => { if (confirm('Wyczyścić raport?')) { lsDel(L_RAPORT); o.remove(); } };
    o.querySelector('#am-raport-kopiuj').onclick = async () => {
      const t = ['Nr\tData\tProces\tKonto\tWzięto\tNiedopasowane\tDo wystawienia\tDobre\tBłędne\tOdrzucone przez Base\tID odrzuconych\tPominięte kroki']
        .concat(r.slice().reverse().map(w => [w.nr, w.data, w.proces, w.konto, proba(w) ?? '', w.niedopasowane ?? '', w.wszystkie ?? '', w.dobre ?? '', w.bledne ?? '', (w.odrzucone || []).length, (w.odrzucone || []).join(' '), (w.pominiete || []).join(', ')].join('\t'))).join('\n');
      try { await navigator.clipboard.writeText(t); alert('Skopiowano – możesz wkleić do Excela / Arkuszy'); } catch { prompt('Skopiuj:', t); }
    };
  }

  // ---- ANALIZA CZASU z logu 📺: każda linia statusu trwa do następnej; linie są przypisane do faz ----
  const FAZY = [
    [/przerwa serwisowa/i, 'Przerwa serwisowa Base', 'base'],
    [/ustawiam filtry/, 'Katalog: ustawianie filtrów', 'base'],
    [/czekam na listę produktów|wczytuję katalog/, 'Katalog: wczytywanie listy', 'base'],
    [/zebrano \d+ niewysłanych/, 'Katalog: zbieranie ID (przechodzenie stron)', 'base'],
    [/tworzę wystawianie|Wykonaj|otwieram wystawianie|wystawianie trwa w nowej|czeka na kolejną paczkę/, 'Tworzenie wystawiania', 'base'],
    [/^odświeżam…/, 'Base: wczytywanie po odświeżeniu', 'base'],
    [/czekam na produkty|wczytuję produkty|wczytano \d+ produktów|wczytano \d+ z \d+/, '@wczytanie', 'base'],
    [/Usuń niedopasowane|niedopasowane usunięte/, 'Usuń niedopasowane', 'skrypt'],
    [/^szukam: /, 'Szukanie pola na stronie (przewijanie)', 'skrypt'],
    [/okno mapowania: (.+)|dodaję regułę: (.+)|^mapuje (.+?)…|^kopiuję|zastosuj do wszystkich/i, '@mapowanie', 'skrypt'],
    [/^ustawiam (.+?) = |^(.+?) = .+ ✔/, '@ustawianie', 'skrypt'],
    [/czyszczę|wstawiam SKU|SKU ✔/, 'Czyszczenie pól / wstawianie SKU', 'skrypt'],
    [/Nowy produkt w katalogu/, 'Nowy produkt w katalogu (Base pracuje)', 'base'],
    [/czekam aż Base wpisze -1/, 'Czekanie aż Base wpisze -1', 'base'],
    [/usuwam -1|ID produktyzacji wyczyszczone/, 'Usuwanie -1 z ID produktyzacji', 'skrypt'],
    [/wszystko zrobione – odświeżam|ładuję wynik/, 'Końcowe odświeżenie', 'base'],
    [/GOTOWE DO WYSTAWIENIA|FULL AUTO|wystawiam sam|czeka na Twoje Wystaw/, 'Gotowe → kliknięcie Wystaw', 'skrypt'],
    [/^wystawiam…/, 'Wysyłanie ofert na Allegro (Base)', 'base'],
    [/^nr \d+: wzięto|wystawione – /, 'Zapis raportu', 'skrypt'],
    [/mapowani|mapowanie EAN/, 'Usuwanie mapowania EAN', 'skrypt'],
    [/wracam do katalogu|daję znać karcie katalogu/, 'Powrót do katalogu', 'base']
  ];
  function analizaCzasu() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(L_LIVE_LOG) || '[]'); } catch {}
    const cykle = [];
    let cykl = null, faza = 'Inne', typ = 'skrypt', poKatalogu = false;
    for (let i = 0; i < log.length; i++) {
      const w = log[i], m = String(w.m || '');
      if (/^ustawiam filtry/.test(m)) {                       // początek nowej paczki
        if (cykl && cykl.n) { cykl.koniec = w.t; cykle.push(cykl); }
        cykl = { start: w.t, n: 0, fazy: {}, typy: {} };
      }
      const mn = m.match(/tworzę wystawianie dla (\d+)/);
      if (mn && cykl) cykl.n = +mn[1];
      if (!/^⏱|^odhaczono|^zrobione:|^strona wczytana/.test(m)) {   // te linie są chwilowe – czas idzie do poprzedniej fazy
        const r = FAZY.find(([re]) => re.test(m));
        if (r) {
          typ = r[2];
          if (r[1] === '@wczytanie') faza = poKatalogu ? 'Base: pierwsze wczytanie wystawiania' : 'Base: wczytywanie po odświeżeniu';
          else if (r[1] === '@mapowanie') { const x = m.match(/okno mapowania: (.+)|dodaję regułę: (.+)|^mapuje (.+?)…/); faza = 'Mapowanie przez okno Base' + (x ? ': ' + (x[1] || x[2] || x[3]).trim() : ''); }
          else if (r[1] === '@ustawianie') { const x = m.match(/^ustawiam (.+?) = |^(.+?) = /); faza = 'Ustawianie: ' + (x ? (x[1] || x[2]).trim() : '?'); }
          else faza = r[1];
          poKatalogu = r[1] === 'Tworzenie wystawiania' || (poKatalogu && r[1] === '@wczytanie');
        } else { faza = 'Inne'; typ = 'skrypt'; }
      }
      const nast = log[i + 1];
      if (!cykl || !nast) continue;
      let ms = nast.t - w.t;
      let f = faza, t = typ;
      if (ms > 20 * 60000) { f = 'Przestój (ponad 20 min bez zmian)'; t = 'stop'; }
      cykl.fazy[f] = (cykl.fazy[f] || 0) + ms;
      cykl.typy[f] = t;
    }
    return { cykle, biezacy: cykl && cykl.n ? cykl : null };
  }

  function pokazStaty() {
    document.getElementById('am-staty')?.remove();
    const h = lsJson(L_STATY).filter(p => p.start && p.gotowe && p.wystaw && p.koniec);
    // grupuj po wielkości paczki
    const grupy = {};
    h.forEach(p => {
      const k = p.n;
      const prep = p.gotowe - p.start, wys = p.koniec - p.wystaw;
      (grupy[k] = grupy[k] || []).push({ prep, wys, razem: prep + wys });
    });
    const sr = a => a.reduce((x, y) => x + y, 0) / a.length;
    const wiersze = Object.keys(grupy).map(Number).sort((a, b) => a - b).map(n => {
      const g = grupy[n];
      const prep = sr(g.map(x => x.prep)), wys = sr(g.map(x => x.wys)), razem = prep + wys;
      const na100 = razem / n * 100;
      return { n, ile: g.length, prep, wys, razem, na100, nag: n / (razem / 3600000) };
    });
    const najlepszy = wiersze.length ? wiersze.reduce((a, b) => (b.nag > a.nag ? b : a)) : null;
    const td = 'padding:5px 8px;border-bottom:1px solid #333;text-align:right';
    const o = document.createElement('div');
    o.id = 'am-staty';
    o.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:20px;border-radius:12px;width:min(720px,94vw);font-family:sans-serif;max-height:90vh;overflow:auto">
      <div style="font-size:18px;font-weight:bold;margin-bottom:4px">Pomiary paczek (${h.length})</div>
      <div style="font-size:12px;opacity:.7;margin-bottom:10px">Czas pracy maszyny = przygotowanie (od utworzenia wystawiania do GOTOWE) + wysyłanie. Czas Twojego czekania przed kliknięciem WYSTAW nie jest liczony.</div>
      ${wiersze.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="opacity:.7"><td style="${td};text-align:left">Paczka</td><td style="${td}">Pomiarów</td><td style="${td}">Przygot. [min]</td><td style="${td}">Wysył. [min]</td><td style="${td}">Razem [min]</td><td style="${td}">Min / 100 szt.</td><td style="${td}">Szt. / godz.</td></tr>
        ${wiersze.map(w => `<tr style="${w === najlepszy ? 'color:#81c784;font-weight:bold' : ''}"><td style="${td};text-align:left">${w.n}</td><td style="${td}">${w.ile}</td><td style="${td}">${min(w.prep)}</td><td style="${td}">${min(w.wys)}</td><td style="${td}">${min(w.razem)}</td><td style="${td}">${min(w.na100)}</td><td style="${td}">${Math.round(w.nag)}</td></tr>`).join('')}
      </table>
      ${najlepszy ? `<div style="margin-top:10px;font-size:14px">Najszybciej wychodzi paczka <b style="color:#81c784">${najlepszy.n}</b> – ok. ${Math.round(najlepszy.nag)} produktów na godzinę.</div>` : ''}`
      : '<div style="opacity:.8">Brak pełnych pomiarów. Pojawią się po pierwszej paczce wystawionej do końca.</div>'}
      ${(() => {
        // gdzie ucieka czas: CAŁY cykl paczki (katalog → wystawianie → wysyłanie → mapowania → powrót), z logu 📺
        const { cykle, biezacy } = analizaCzasu();
        const ost = cykle.slice(-10);
        const czas = ms => ms >= 60000 ? (ms / 60000).toFixed(1) + ' min' : Math.round(ms / 1000) + ' s';
        const kolor = { base: '#ffb74d', skrypt: '#4fc3f7', stop: '#ef5350' };
        let html = '<div style="font-size:16px;font-weight:bold;margin:18px 0 2px">Gdzie ucieka czas – cały cykl paczki</div>';
        if (!ost.length) return html + '<div style="font-size:13px;opacity:.75">Pojawi się po pierwszej pełnej paczce z tą wersją skryptu (liczone z logu 📺).</div>';
        const suma = {}, typy = {};
        ost.forEach(c => Object.entries(c.fazy).forEach(([f, ms]) => { suma[f] = (suma[f] || 0) + ms; typy[f] = c.typy[f]; }));
        const lista = Object.entries(suma).map(([f, ms]) => [f, ms / ost.length]).sort((a, b) => b[1] - a[1]);
        const razem = lista.reduce((a, x) => a + x[1], 0), max = lista[0][1] || 1;
        const sztuk = ost.reduce((a, c) => a + c.n, 0) / ost.length;
        const zBase = lista.filter(([f]) => typy[f] === 'base').reduce((a, x) => a + x[1], 0);
        html += '<div style="font-size:12px;opacity:.75;margin-bottom:8px">Średnio z ' + ost.length + ' ostatnich paczek (ok. ' + Math.round(sztuk) + ' szt.): <b>' + czas(razem) + '</b> na paczkę, z czego <span style="color:#ffb74d">Base ' + Math.round(zBase / razem * 100) + '%</span> i <span style="color:#4fc3f7">skrypt ' + Math.round((razem - zBase) / razem * 100) + '%</span>.</div>';
        html += lista.map(([f, ms]) => '<div style="display:grid;grid-template-columns:minmax(0,1fr) 130px 62px 38px;gap:8px;align-items:center;font-size:12.5px;padding:2px 0"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + f + '">' + f + '</span><span style="background:#263445;border-radius:3px;height:10px"><span style="display:block;height:10px;border-radius:3px;background:' + (kolor[typy[f]] || '#4fc3f7') + ';width:' + Math.max(2, ms / max * 100) + '%"></span></span><span style="text-align:right;font-variant-numeric:tabular-nums">' + czas(ms) + '</span><span style="text-align:right;opacity:.6;font-variant-numeric:tabular-nums">' + Math.round(ms / razem * 100) + '%</span></div>').join('');
        html += '<div style="font-size:12px;opacity:.7;margin-top:4px"><span style="color:#ffb74d">■</span> czekanie na Base &nbsp; <span style="color:#4fc3f7">■</span> praca skryptu &nbsp; <span style="color:#ef5350">■</span> przestoje</div>';
        html += '<div style="font-size:14px;font-weight:bold;margin:14px 0 4px">Ostatnie paczki</div>' + ost.slice().reverse().map(c => {
          const ms = c.koniec - c.start;
          return '<div style="display:flex;gap:10px;font-size:12.5px;font-variant-numeric:tabular-nums;padding:1px 0"><span style="opacity:.6;width:120px">' + new Date(c.start).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</span><span style="width:70px">' + c.n + ' szt.</span><span style="width:70px">' + czas(ms) + '</span><span style="opacity:.75">' + Math.round(c.n / (ms / 3600000)) + ' szt./h</span></div>';
        }).join('');
        if (biezacy) html += '<div style="font-size:12px;opacity:.7;margin-top:6px">Bieżąca paczka (' + biezacy.n + ' szt.) trwa: ' + czas(Object.values(biezacy.fazy).reduce((a, b) => a + b, 0)) + '</div>';
        return html;
      })()}
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:16px;font-size:13px;background:#263445;padding:10px;border-radius:8px;cursor:pointer">
        <input type="checkbox" id="am-szybkie" ${lsGet('autoSzybkieMapowanie') === '1' ? 'checked' : ''} style="margin-top:2px">
        <span><b>⚡ Szybkie mapowanie „= SKU”</b> (test) – EAN, Kod producenta, Model itd. wpisuje SKU prosto w dane Base, bez okna mapowania i bez odświeżania strony. Oszczędza ok. 1 min na każdym takim parametrze. Nie zapisuje reguły mapowania w Base (usuwanie mapowania EAN na końcu wtedy nic nie robi).</span>
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button id="am-staty-wyczysc" style="background:#c62828;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Wyczyść pomiary</button>
        <button id="am-staty-zamknij" style="background:#555;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Zamknij</button>
      </div></div>`;
    document.body.appendChild(o);
    o.querySelector('#am-staty-zamknij').onclick = () => o.remove();
    o.querySelector('#am-szybkie').onchange = e => { if (e.target.checked) lsSet('autoSzybkieMapowanie', '1'); else lsDel('autoSzybkieMapowanie'); };
    o.querySelector('#am-staty-wyczysc').onclick = () => { if (confirm('Wyczyścić pomiary?')) { lsDel(L_STATY); o.remove(); } };
  }

  function pokazSpis() {
    document.getElementById('am-spis')?.remove();
    const ids = [...spis()];
    const o = document.createElement('div');
    o.id = 'am-spis';
    o.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:20px;border-radius:12px;width:min(560px,92vw);font-family:sans-serif">
      <div style="font-size:18px;font-weight:bold;margin-bottom:4px">Wysłane produkty (${PROCES.nazwa}): ${ids.length}</div>
      <div style="font-size:12px;opacity:.75;margin-bottom:8px">Przenosiny do innej przeglądarki: tu „📋 Kopiuj”, tam wklej i „📥 Dopisz”. Cofnięcie: wyczyść pole, wklej ID i „🗑 Usuń wklejone”.</div>
      <textarea id="am-spis-pole" style="width:100%;height:260px;background:#0f1720;color:#fff;border:1px solid #333;border-radius:6px;padding:8px;font:12px monospace">${ids.join('\n')}</textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">
        <button id="am-spis-kopiuj" style="background:#1565c0;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">📋 Kopiuj</button>
        <button id="am-spis-niedok" title="ID produktów z paczek, które utknęły i się nie wystawiły (można je potem usunąć ze spisu = wrócą do kolejki)" style="background:#6d4c41;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">⏳ Niedokończone (${lsJson('autoNiedokonczone').reduce((a, w) => a + (w.ids || []).length, 0)})</button>
        <button id="am-spis-dopisz" style="background:#2e7d32;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">📥 Dopisz wklejone</button>
        <button id="am-spis-usun" title="Usuwa ze spisu ID wklejone w pole (np. produkty, które przez błąd trafiły do spisu jako niedopasowane)" style="background:#ef6c00;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">🗑 Usuń wklejone ze spisu</button>
        <button id="am-spis-boty" title="Kopiuje oba spisy i profile kroków – wklej do pliku ustawienia.json programu z botami" style="background:#6a1b9a;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">🤖 Eksport do botów</button>
        <button id="am-spis-wyczysc" style="background:#c62828;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Wyczyść spis</button>
        <button id="am-spis-zamknij" style="background:#555;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Zamknij</button>
      </div></div>`;
    document.body.appendChild(o);
    o.querySelector('#am-spis-zamknij').onclick = () => o.remove();
    o.querySelector('#am-spis-kopiuj').onclick = async () => {
      const t = ids.join('\n');
      try { await navigator.clipboard.writeText(t); alert('Skopiowano ' + ids.length + ' ID – wklej w 📋 w drugiej przeglądarce'); }
      catch { const p = o.querySelector('#am-spis-pole'); p.value = t; p.select(); document.execCommand('copy'); alert('Skopiowano ' + ids.length + ' ID'); }
    };
    o.querySelector('#am-spis-boty').onclick = async () => {
      const dane = {};
      ['autoSpisWyslanych', 'autoSpisWyslanychFinalne', 'autoProfileKrokow', 'autoProfilAktywny'].forEach(k => { const v = localStorage.getItem(k); if (v) dane[k] = v; });
      const t = JSON.stringify(dane);
      try { await navigator.clipboard.writeText(t); alert('Skopiowane. Wklej do pliku ustawienia.json w folderze z botami (zastąp całą zawartość).'); }
      catch { const p = o.querySelector('#am-spis-pole'); p.value = t; p.select(); document.execCommand('copy'); alert('Skopiowane – wklej do ustawienia.json'); }
    };
    o.querySelector('#am-spis-niedok').onclick = () => {
      const l = lsJson('autoNiedokonczone');
      if (!l.length) { alert('Brak niedokończonych paczek.'); return; }
      o.querySelector('#am-spis-pole').value = [...new Set(l.flatMap(w => w.ids || []))].join('\n');
      alert(l.length + ' niedokończonych paczek:\n' + l.slice(-15).map(w => new Date(w.t).toLocaleString('pl-PL') + ' · ' + w.proces + ' · ' + w.konto + ' · ' + (w.ids || []).length + ' szt.').join('\n') + '\n\nID są w polu. „Usuń wklejone ze spisu” = wrócą do kolejki.');
    };
    o.querySelector('#am-spis-dopisz').onclick = () => {
      const nowe = (o.querySelector('#am-spis-pole').value.match(/\d{6,}/g) || []);
      const przed = spis().size;
      dodajDoSpisu(nowe);
      const po = spis().size;
      alert('Dopisano ' + (po - przed) + ' nowych ID (razem w spisie: ' + po + ')');
      o.remove(); odswiezPrzyciski();
    };
    o.querySelector('#am-spis-usun').onclick = () => {
      const doUsuniecia = new Set(o.querySelector('#am-spis-pole').value.match(/\d{6,}/g) || []);
      if (!doUsuniecia.size) { alert('Wklej w pole ID do usunięcia (po jednym w linii).'); return; }
      const s = spis(); const przed = s.size;
      doUsuniecia.forEach(i => s.delete(i));
      if (!confirm('Usunąć ze spisu ' + (przed - s.size) + ' ID? Zostanie: ' + s.size)) return;
      lsSet(L_SPIS, JSON.stringify([...s]));
      alert('Usunięto ' + (przed - s.size) + ' ID. W spisie zostało: ' + s.size);
      o.remove(); odswiezPrzyciski();
    };
    o.querySelector('#am-spis-wyczysc').onclick = () => {
      if (!confirm('Na pewno wyczyścić spis? Skrypt może wtedy wysłać te produkty ponownie.')) return;
      lsDel(L_SPIS); o.remove(); odswiezPrzyciski();
    };
  }

  // =========================================================

  // =========================================================
  // ===== MOST DO DANYCH FORMULARZA BASE (bez klikania) =====
  // Base trzyma oferty w lokalnej bazie formularza. Ustawiamy wartości tak, jak robi to sam Base
  // (FormItemHelper.updatePropertiesValuesById) – dla wszystkich produktów naraz, bez otwierania list.
  // =========================================================
  const MOST_KOD = `(() => {
    if (window.__amMost) return; window.__amMost = true;
    const norm = t => String(t == null ? '' : t).replace(/\\s+/g, ' ').trim().toLowerCase();
    async function produkty() {
      if (typeof flushPendingInputUpdates === 'function') { try { await flushPendingInputUpdates(); } catch (e) {} }
      const ids = await FormItemHelper.getUniqueItemsIds(getListingId());
      const raw = await FormItemHelper.getItemsByIds(ids);
      return (raw instanceof Map ? [...raw.values()] : Array.isArray(raw) ? raw : Object.values(raw || {})).filter(Boolean);
    }
    function znajdzParam(pl, nazwa) {            // [grupa, id] parametru o danej nazwie (EAN = też „EAN (GTIN)” / „GTIN”)
      const warianty = ['ean', 'ean (gtin)', 'gtin'].includes(norm(nazwa)) ? ['ean', 'ean (gtin)', 'gtin'] : [norm(nazwa)];
      for (const grp of ['categoryParams', 'customParams', 'marketplaceParams']) {
        const g = pl && pl[grp]; if (!g) continue;
        for (const [k, v] of Object.entries(g)) if (v && typeof v === 'object' && warianty.includes(norm(v.name))) return [grp, k];
      }
      return null;
    }
    const cacheOpcji = {};
    function idOpcji(pid, tekst) {
      const klucz = pid + '|' + norm(tekst);
      if (klucz in cacheOpcji) return cacheOpcji[klucz];
      let wynik = null;
      try {
        const kat = activeSettings.sites.pl.categoryParams || {};
        for (const c of Object.keys(kat)) {
          const o = kat[c] && kat[c][pid] && kat[c][pid].options;
          if (!o) continue;
          for (const [id, t] of Object.entries(o)) if (norm(t) === norm(tekst)) { wynik = id; break; }
          if (wynik) break;
        }
      } catch (e) {}
      return (cacheOpcji[klucz] = wynik);
    }
    async function zapisz(it, upd) { await FormItemHelper.updatePropertiesValuesById(it.uniqueId, upd, false); }

    const akcje = {
      async test() { return { ok: typeof FormItemHelper !== 'undefined', n: (await produkty()).length }; },
      // liczniki wystawiania: total / sent (wystawione) / error (błędne) / draft
      async liczniki() { return await FormItemHelper.countItemsInDB(getListingId()); },
      // ID produktów, które się NIE wystawiły: pole statusu szukane tak, żeby liczba „wystawionych” zgadzała się z licznikami Base
      async niewystawione() {
        const items = await produkty();
        const lic = await FormItemHelper.countItemsInDB(getListingId()) || {};
        const sent = Number(lic.sent) || 0, err = Number(lic.error) || 0;
        const idP = it => String(it.uniqueId || '').split('_')[1];
        const klucze = new Set(); items.slice(0, 20).forEach(it => Object.keys(it || {}).forEach(k => { const v = it[k]; if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) klucze.add(k); }));
        for (const k of klucze) {
          const hist = {}; items.forEach(it => { const v = String(it[k]); hist[v] = (hist[v] || 0) + 1; });
          const wartosci = Object.entries(hist);
          if (wartosci.length < 2 || wartosci.length > 8) continue;
          const vSent = wartosci.find(([, n]) => n === sent);
          if (!vSent || sent === 0) continue;
          const vErr = err ? wartosci.find(([v, n]) => n === err && v !== vSent[0]) : null;
          const ids = items.filter(it => String(it[k]) !== vSent[0] && (!vErr || String(it[k]) !== vErr[0])).map(idP).filter(Boolean);
          return { ok: true, pole: k, wystawione: vSent[0], ids, sent, err, total: items.length };
        }
        return { ok: false, sent, err, total: items.length, klucze: [...klucze].slice(0, 40), probka: items[0] ? Object.fromEntries([...klucze].slice(0, 40).map(k => [k, items[0][k]])) : null };
      },
      // nazwy wszystkich parametrów w tej paczce (z liczbą produktów, które je mają)
      async nazwyParametrow() {
        const licz = {};
        for (const it of await produkty()) {
          const pl = it.siteItems && it.siteItems.pl; if (!pl) continue;
          for (const grp of ['categoryParams', 'customParams']) {
            for (const v of Object.values(pl[grp] || {})) if (v && v.name) licz[v.name] = (licz[v.name] || 0) + 1;
          }
        }
        return { nazwy: Object.entries(licz).sort((a, b) => b[1] - a[1]) };
      },
      // ID produktów z katalogu, które są w tym wystawianiu
      async idsProduktow() { return { ids: (await produkty()).map(it => String(it.uniqueId || '').split('_')[1]).filter(Boolean) }; },

      // ustaw wartość z listy (np. Stan = Nowy, Wyrób medyczny = nie) we wszystkich produktach, które mają ten parametr
      async ustawListe({ nazwa, tekst }) {
        const items = await produkty();
        let pola = 0, zmienione = 0, brakOpcji = 0;
        for (const it of items) {
          const pl = it.siteItems && it.siteItems.pl; const zp = znajdzParam(pl, nazwa); if (!zp) continue;
          pola++;
          const opt = idOpcji(zp[1], tekst);
          if (!opt) { brakOpcji++; continue; }
          if (String(pl[zp[0]][zp[1]].value) !== String(opt)) { await zapisz(it, { ['siteItems.pl.' + zp[0] + '.' + zp[1] + '.value']: opt }); zmienione++; }
        }
        let zle = 0;
        for (const it of await produkty()) {
          const pl = it.siteItems && it.siteItems.pl; const zp = znajdzParam(pl, nazwa); if (!zp) continue;
          const opt = idOpcji(zp[1], tekst); if (!opt || String(pl[zp[0]][zp[1]].value) !== String(opt)) zle++;
        }
        return { pola, zmienione, brakOpcji, zle };
      },

      // wstaw SKU produktu do parametru (zastępuje wszystko, co tam było) – jak mapowanie "Wstaw SKU"
      async ustawSku({ nazwa }) {
        const items = await produkty();
        let pola = 0, zmienione = 0, bezSku = 0;
        for (const it of items) {
          const pl = it.siteItems && it.siteItems.pl; const zp = znajdzParam(pl, nazwa); if (!zp) continue;
          pola++;
          if (!it.productSku) { bezSku++; continue; }
          const p = pl[zp[0]][zp[1]];
          if (String(p.value) !== String(it.productSku)) {
            const upd = { ['siteItems.pl.' + zp[0] + '.' + zp[1] + '.value']: String(it.productSku) };
            if (!(pl.paramsMappedValues && zp[1] in pl.paramsMappedValues)) upd['siteItems.pl.paramsMappedValues.' + zp[1]] = p.value;
            await zapisz(it, upd); zmienione++;
          }
        }
        let zle = 0;
        for (const it of await produkty()) {
          const pl = it.siteItems && it.siteItems.pl; const zp = znajdzParam(pl, nazwa); if (!zp || !it.productSku) continue;
          if (String(pl[zp[0]][zp[1]].value) !== String(it.productSku)) zle++;
        }
        return { pola, zmienione, bezSku, zle };
      },

      // tylko sprawdź: ile produktów ma parametr i u ilu wartość ≠ SKU (bez zmieniania czegokolwiek)
      async sprawdzSku({ nazwa }) {
        let pola = 0, zle = 0;
        for (const it of await produkty()) {
          const pl = it.siteItems && it.siteItems.pl; const zp = znajdzParam(pl, nazwa); if (!zp) continue;
          pola++;
          if (it.productSku && String(pl[zp[0]][zp[1]].value) !== String(it.productSku)) zle++;
        }
        return { pola, zle };
      },

      // znajdź cennik wysyłki: ostatnie słowo nazwy zaczyna się od "slowo" (DUZE / KURIER / PACZKOMAT);
      // gdy pasuje kilka – ten, który ma najwięcej słów wspólnych z nazwą katalogu (np. PRZEMYSLOWA)
      async znajdzCennik({ slowo, katalog }) {
        const opcje = (activeSettings.sites.pl.marketplaceParams.delivery_method || {}).options || {};
        const bezPl = t => norm(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/ł/g, 'l').toUpperCase();
        const S = bezPl(slowo);
        const kand = Object.entries(opcje).filter(([id, t]) => id !== '_order' && typeof t === 'string' && bezPl(t).split(/[\\s_]+/).pop().startsWith(S));
        const wszystkie = Object.values(opcje).filter(t => typeof t === 'string').join(' | ');
        if (!kand.length) return { blad: 'brak cennika „' + slowo + '”', wszystkie };
        const slowaKat = new Set(bezPl(katalog || '').split(/[\\s_]+/).filter(w => w.length > 2));
        const ocena = t => bezPl(t).split(/[\\s_]+/).filter(w => slowaKat.has(w)).length;
        kand.sort((a, b) => ocena(b[1]) - ocena(a[1]));
        if (kand.length > 1 && ocena(kand[0][1]) === ocena(kand[1][1])) return { blad: 'kilka pasujących cenników: ' + kand.map(k => k[1]).join(' / '), wszystkie };
        return { tekst: kand[0][1], id: kand[0][0] };
      },

      // ustaw pole po ścieżce (np. Szablon oferty = marketplaceParams.theme) – opcje z ustawień listy
      async ustawPole({ sciezka, zrodlo, tekst }) {
        const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
        const opcje = get(activeSettings, zrodlo) || {};
        let opt = null;
        for (const [id, t] of Object.entries(opcje)) if (id !== '_order' && norm(t) === norm(tekst)) { opt = id; break; }
        if (!opt) for (const [id, t] of Object.entries(opcje)) if (id !== '_order' && id !== '' && norm(t).startsWith(norm(tekst))) { opt = id; break; }
        if (!opt) return { pola: 0, zmienione: 0, brakOpcji: 1, zle: 0, opcjeDostepne: Object.values(opcje).filter(x => typeof x === 'string').join(' | ') };
        const czesci = sciezka.split('.'); const rodzic = czesci.slice(0, -1).join('.');
        let pola = 0, zmienione = 0;
        for (const it of await produkty()) {
          if (get(it, rodzic) == null) continue;
          pola++;
          if (String(get(it, sciezka)) !== String(opt)) { await zapisz(it, { [sciezka]: opt }); zmienione++; }
        }
        let zle = 0;
        for (const it of await produkty()) { if (get(it, rodzic) == null) continue; if (String(get(it, sciezka)) !== String(opt)) zle++; }
        return { pola, zmienione, brakOpcji: 0, zle, opt };
      },

      // ustaw filtry w katalogu produktów (tryb zaawansowany) + liczbę produktów na stronę
      async ustawFiltry({ filtry, rozmiar }) {
        const c = 'table_inventory_products_container';
        const czekaj = ms => new Promise(r => setTimeout(r, ms));
        // wartości list (np. "Dowolne konto marketplace") Base doczytuje w tle – podajemy je jako tablice
        // tagi podane nazwami (np. "LOG:PALETA") – zamień na ID z listy tagów Base
        const tagiId = {};
        document.querySelectorAll('select[name="filter_tags[]"] option').forEach(o => { tagiId[norm(o.textContent)] = o.value; });
        const brakTagow = [];
        let doUstawienia = filtry.map(g => g.map(f => {
          if (f.tagi) {
            const ids = f.tagi.map(t => tagiId[norm(t)]).filter(Boolean);
            f.tagi.forEach(t => { if (!tagiId[norm(t)]) brakTagow.push(t); });
            return { field: f.field, op: f.op, val: ids };
          }
          if (f.niepuste) return Object.assign({}, f);
          return Object.assign({}, f, { val: (f.field === 'stock' || typeof f.val !== 'string') ? f.val : [f.val] });
        }));
        // „wartość nie pusta”: pole EAN po nazwie z listy pól, operator po tekście („nie pusta” / „niepusta”…)
        const niepuste = [].concat(...doUstawienia).filter(f => f.niepuste);
        let pominietoEan = false;
        if (niepuste.length) {
          const polePoNazwie = [...document.querySelectorAll('select option')].find(o => norm(o.textContent) === 'ean' && o.value);
          niepuste.forEach(f => { if (polePoNazwie) f.field = polePoNazwie.value; });
          // 1) zapamiętane z 🎯 (ustawione raz ręcznie w Base) – zawsze pierwszeństwo
          const opZapamietany = localStorage.getItem('autoOpNiepusty'), poleZapamietane = localStorage.getItem('autoPoleEan');
          if (opZapamietany) {
            niepuste.forEach(f => { f.op = opZapamietany; if (poleZapamietane) f.field = poleZapamietane; });
            console.log('[AutoMap] filtry: zapamiętany EAN – pole', poleZapamietane, 'operator', opZapamietany);
          } else {
            // 2) operator „nie jest pusta” z listy tej wersji Base – wpisanie własnego kodu potrafi wywalić Base
            const opNiepusty = [...document.querySelectorAll('select option')].find(o => o.value && /nie\s*(jest\s*)?pust|niepust|not\s*empty|wypełnion|uzupełnion/i.test(o.textContent || ''));
            if (opNiepusty) niepuste.forEach(f => { f.op = opNiepusty.value; });
            else console.log('[AutoMap] filtry: operator „nie jest pusta” nie w DOM – poszukam po wybraniu pola EAN (albo użyj 🎯 EAN)');
          }
        }
        if (brakTagow.length) return { ok: false, brakTagow };
        const pusta = v => v == null || v === '' || (Array.isArray(v) && v.length === 0);
        const zOp = x => (x && (x.op != null ? x.op : (x.operation != null ? x.operation : x.filterOperation)));
        const kompletne = () => {
          const d = table_getFiltersData(c) || [];
          const plaskie = [].concat(...d);
          return [].concat(...doUstawienia).every(f => plaskie.some(x => x.field === f.field && String(zOp(x)) === String(zOp(f)) && (f.niepuste || !pusta(x.val))));
        };
        // Base w różnych wersjach czyta operator z innego pola (op / operation / filterOperation).
        // Zły klucz = „undefined is not an object (evaluating 'filterOperation.toLowerCase')” → podajemy wszystkie i nie wywalamy się na wyjątku.
        let bladLadowania = null, uzytyKlucz = null;
        const zWszystkimiKluczami = dane => dane.map(g => g.map(f => { const v = zOp(f); return Object.assign({}, f, { op: v, operation: v, filterOperation: v }); }));
        const zaladuj = dane => {
          const warianty = uzytyKlucz ? [uzytyKlucz] : ['wszystkie', 'op'];
          for (const w of warianty) {
            try {
              table_loadFilterValues(c, w === 'wszystkie' ? zWszystkimiKluczami(dane) : dane);
              uzytyKlucz = w; return true;
            } catch (e) { bladLadowania = (e && e.message) || String(e); console.log('[AutoMap] filtry – wariant ' + w + ' nie przeszedł:', e); }
          }
          return false;
        };
        if (String(table_getFilteringMode(c).val()) !== String(FILTER_MODE_COMPLEX)) {
          table_setFilteringMode(c, FILTER_MODE_COMPLEX);
          await czekaj(800);
        }
        // zrzut dla diagnostyki: jak wyglądają filtry i jakie operatory ma ta wersja Base
        const zrzut = () => {
          let selecty = [];
          try {
            const kont = table_getFiltersContainer(c);
            selecty = [...jQuery(kont).find('select')].slice(0, 12).map(s => ({ name: s.name || s.id, opcje: [...s.options].slice(0, 25).map(o => o.value + '=' + (o.textContent || '').trim()) }));
          } catch (e) {}
          return { proba: doUstawienia, wBase: [].concat(...(table_getFiltersData(c) || [])).slice(0, 8), selecty };
        };
        const koniecCzasu = Date.now() + 110000;             // twardy limit, żeby nie było „brak odpowiedzi”
        let ok = false;
        for (let proba = 0; proba < 12 && !ok; proba++) {   // do ~12 s – aż Base doczyta opcje list
          const poszlo = zaladuj(doUstawienia);
          if (!poszlo && !uzytyKlucz) return { ok: false, bladLadowania, wyjatek: true, zrzut: zrzut() };   // Base wywala się na każdym wariancie – nie ma po co czekać
          await czekaj(1000);
          ok = kompletne();
          if (Date.now() > koniecCzasu) break;
        }
        // „nie zawiera” (np. Marketplace (oferta) nie zawiera dowolnego konta) – Base może mieć inny kod operatora; szukamy go
        const negacje = [].concat(...doUstawienia).filter(f => f.op === 'NOT LIKE');
        if (!ok && negacje.length) {
          const zListy = [...document.querySelectorAll('select option')].filter(o => /nie zawiera/i.test(o.textContent)).map(o => o.value);
          const kandydaci = [...new Set([...zListy, 'NOT LIKE', 'NOT_LIKE', 'NOTLIKE', '!LIKE', 'NOT IN', '!=', '<>'])].filter(Boolean);
          for (const op of kandydaci) {
            if (Date.now() > koniecCzasu) break;
            negacje.forEach(f => { f.op = op; });
            for (let proba = 0; proba < 4 && !ok; proba++) { zaladuj(doUstawienia); await czekaj(1000); ok = kompletne(); }
            if (ok) break;
          }
        }
        if (!ok && niepuste.length) {
          // Base renderuje listę operatorów dopiero po wybraniu pola – wybierz EAN w wierszu filtra i odczytaj jego operatory
          const operatorZUI = async () => {
            try {
              const kont = table_getFiltersContainer(c);
              const selecty = [...jQuery(kont).find('select')];
              const polowy = selecty.find(sel => [...sel.options].some(o => norm(o.textContent) === 'ean'));
              if (!polowy) return null;
              const opt = [...polowy.options].find(o => norm(o.textContent) === 'ean');
              jQuery(polowy).val(opt.value).trigger('change');
              await czekaj(1500);
              const wiersz = polowy.closest('tr') || polowy.parentElement && polowy.parentElement.parentElement;
              const opcjeWiersza = [...(wiersz || kont).querySelectorAll('select option')];
              console.log('[AutoMap] operatory dla EAN:', opcjeWiersza.map(o => o.value + '=' + (o.textContent || '').trim()).slice(0, 40));
              const kand = opcjeWiersza.find(o => o.value && /nie\s*(jest\s*)?pust|niepust|not\s*empty|wypełnion|uzupełnion/i.test(o.textContent || ''));
              if (kand) { try { localStorage.setItem('autoPoleEan', String(opt.value)); } catch (e) {} }
              return kand ? kand.value : null;
            } catch (e) { console.log('[AutoMap] operatorZUI:', e); return null; }
          };
          const zUI = await operatorZUI();
          const zListy = [...document.querySelectorAll('select option')].filter(o => o.value && /nie\s*(jest\s*)?pust|niepust|not\s*empty|wypełnion|uzupełnion/i.test(o.textContent || '')).map(o => o.value);
          const zPamieci = localStorage.getItem('autoOpNiepusty');
          const kandydaci = [...new Set([zUI, zPamieci, ...zListy, 'notempty', 'not_empty', 'NOT EMPTY', 'NOT_EMPTY', 'NOTEMPTY', 'is not null', 'IS NOT NULL', 'NOT NULL', 'notnull', '!EMPTY', 'nempty', 'filled', '!=', '<>'])].filter(Boolean);
          const pola = [...new Set([localStorage.getItem('autoPoleEan'), niepuste[0].field, 'ean', 'product_ean', 'EAN'].filter(Boolean))];
          szukaj: for (const pole of pola) for (const op of kandydaci) {
            if (Date.now() > koniecCzasu) break szukaj;
            niepuste.forEach(f => { f.field = pole; f.op = op; });
            for (let proba = 0; proba < 3 && !ok; proba++) { zaladuj(doUstawienia); await czekaj(900); ok = kompletne(); }
            if (ok) break szukaj;
          }
          if (ok) { console.log('[AutoMap] EAN niepusty: pole', niepuste[0].field, 'operator', niepuste[0].op); try { localStorage.setItem('autoOpNiepusty', String(niepuste[0].op)); localStorage.setItem('autoPoleEan', String(niepuste[0].field)); } catch (e) {} }
        }
        if (!ok) return { ok: false, bladLadowania, klucz: uzytyKlucz, zrzut: zrzut(), dane: table_getFiltersData(c), negacja: negacje.length > 0, niepuste: niepuste.length > 0, opcje: [...document.querySelectorAll('select option')].filter(o => /pust|ean/i.test(o.textContent)).map(o => o.value + '=' + o.textContent.trim()).slice(0, 30) };
        if (rozmiar) jQuery(table_getFiltersContainer(c)).find('#rows_per_page').val(rozmiar);
        table_setFilters(c);
        return { ok: true, pominietoEan, dane: table_getFiltersData(c) };
      },

      // aktualne filtry ustawione na ekranie + listy pól/operatorów (do zapamiętania „EAN niepusty”)
      async zrzutFiltrow() {
        const c = 'table_inventory_products_container';
        let dane = [], selecty = [];
        try { dane = [].concat(...(table_getFiltersData(c) || [])); } catch (e) {}
        try {
          const kont = table_getFiltersContainer(c);
          selecty = [...jQuery(kont).find('select')].slice(0, 16).map(sel => ({
            name: sel.name || sel.id || '',
            wybrane: sel.value,
            wybranyTekst: (sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '').trim(),
            opcje: [...sel.options].slice(0, 40).map(o => o.value + '=' + (o.textContent || '').trim())
          }));
        } catch (e) {}
        return { dane, selecty, tryb: (() => { try { return String(table_getFilteringMode(c).val()); } catch (e) { return '?'; } })() };
      },

      // sprawdź obowiązkowe parametry we wszystkich produktach paczki (nic nie zmienia)
      async sprawdzObowiazkowe({ reguly }) {
        const items = await produkty();
        const wynik = reguly.map(r => ({ nazwa: r.nazwa, pola: 0, zle: 0, bezSku: 0, przyklad: [] }));
        for (const it of items) {
          const pl = it.siteItems && it.siteItems.pl; if (!pl) continue;
          reguly.forEach((r, i) => {
            const zp = znajdzParam(pl, r.nazwa); if (!zp) return;
            const w = wynik[i]; w.pola++;
            let v = pl[zp[0]][zp[1]].value; if (Array.isArray(v)) v = v[0];
            let ok = true;
            if (r.regula === 'sku') { if (!it.productSku) { ok = false; w.bezSku++; } else ok = String(v) === String(it.productSku); }
            else if (r.regula === 'opcja') { const o = idOpcji(zp[1], r.wartosc); ok = !!o && String(v) === String(o); }
            else if (r.regula === 'liczba') ok = parseFloat(String(v == null ? '' : v).replace(',', '.')) > 0;
            if (!ok) { w.zle++; if (w.przyklad.length < 5) w.przyklad.push(String(it.uniqueId || '').split('_')[1] + '=' + JSON.stringify(v == null ? '' : v)); }
          });
        }
        return { n: items.length, wynik };
      },

      // ile produktów ma -1 w ID produktyzacji
      async ileMinusJeden() {
        let n = 0; for (const it of await produkty()) { const p = it.siteItems.pl.marketplaceParams.productization_id; if (p && String(p.value).trim() === '-1') n++; }
        return { n };
      },
      // usuń -1 z ID produktyzacji (prawdziwych ID nie rusza)
      async wyczyscIdProd() {
        let zmienione = 0;
        for (const it of await produkty()) {
          const p = it.siteItems.pl.marketplaceParams && it.siteItems.pl.marketplaceParams.productization_id;
          if (p && String(p.value).trim() === '-1') { await zapisz(it, { 'siteItems.pl.marketplaceParams.productization_id.value': '' }); zmienione++; }
        }
        const zostalo = (await akcje.ileMinusJeden()).n;
        return { zmienione, zle: zostalo };
      }
    };

    window.addEventListener('message', async e => {
      const d = e.data; if (!d || d.__am !== 'req' || e.source !== window) return;
      let wynik, blad = null;
      try { wynik = await akcje[d.akcja](d.dane || {}); } catch (err) { blad = String(err && err.message || err); }
      window.postMessage({ __am: 'res', id: d.id, wynik, blad }, '*');
    });
  })();`;
  let mostWstrzykniety = false;
  function wstawDoStrony(kod) {
    const sc = document.createElement('script');
    sc.textContent = kod;
    (document.head || document.documentElement).appendChild(sc);
    sc.remove();
  }
  function wstrzyknijMost() {
    if (mostWstrzykniety) return;
    mostWstrzykniety = true;
    const sc = document.createElement('script');
    sc.textContent = MOST_KOD;
    (document.head || document.documentElement).appendChild(sc);
    sc.remove();
  }
  let mostLicznik = 0;
  function bazaBase(akcja, dane, limitMs = 120000) {
    wstrzyknijMost();
    const id = 'am' + Date.now() + '_' + (++mostLicznik);
    return new Promise(resolve => {
      const t = setTimeout(() => { window.removeEventListener('message', h); resolve({ blad: 'brak odpowiedzi' }); }, limitMs);
      function h(e) {
        const d = e.data; if (!d || d.__am !== 'res' || d.id !== id) return;
        clearTimeout(t); window.removeEventListener('message', h); resolve(d);
      }
      window.addEventListener('message', h);
      window.postMessage({ __am: 'req', id, akcja, dane }, '*');
    });
  }
  let mostDziala = null;   // null = nie sprawdzono
  async function mostOk() {
    if (mostDziala !== null) return mostDziala;
    const r = await bazaBase('test', {}, 15000);
    mostDziala = !!(r && !r.blad && r.wynik && r.wynik.ok);
    console.log('[AutoMap] dostęp do danych Base:', mostDziala, r);
    return mostDziala;
  }

  // ================== STRONA WYSTAWIANIA ===================
  // =========================================================
  const modal = () => document.getElementById('modal_params_mapping');
  const modalOtwarty = () => { const m = modal(); return !!(m && m.classList.contains('in') && getComputedStyle(m).display !== 'none'); };
  const tytulModala = () => (modal()?.querySelector('.modal-title, .modal-header')?.textContent || '').replace(/\s+/g, ' ').trim();
  const przyciskWszystkie = () => {
    if (!modalOtwarty()) return null;
    return [...modal().querySelectorAll('button.params_mapping_save_button')]
      .find(b => b.textContent.includes('wszystkich') && b.offsetParent !== null);
  };
  const regulyWOknie = () => [...modal().querySelectorAll('tr.paramMappingRow')].filter(r => r.id !== 'row_-1' && r.offsetParent !== null);
  const poleParametru = nazwa => {
    const lab = [...document.querySelectorAll('span.param_label')].find(s => s.title === nazwa);
    return lab ? lab.closest('.lfi_param') : null;
  };
  const listaZaladowana = () => document.querySelector('.lfi_param button.params_mapping');

  // checklista
  const pozycja = nazwa => {
    const panel = document.getElementById('blcl');
    if (!panel) return null;
    const label = [...panel.querySelectorAll('.bd label')].find(l => norm(l.textContent.split('=')[0]) === norm(nazwa));
    return label ? label.querySelector('input[type="checkbox"]') : null;
  };
  const odhaczoneNaLiscie = nazwa => !!pozycja(nazwa)?.checked;
  async function odhacz(nazwa) {
    await czekajNa(() => document.getElementById('blcl'), 10000);
    const box = pozycja(nazwa);
    if (!box) { status('zrobione: ' + nazwa); return; }
    if (!box.checked) box.click();
    status('odhaczono: ' + nazwa);
    await czekaj(500);
  }
  const zrobione = n => odhaczoneNaLiscie(n) || lista(K_DONE).includes(n) || lista(K_SKIP).includes(n);
  const nastepny = () => KROKI.find(k => !zrobione(k.nazwa));
  const K_POWODY = 'am_' + LID + '_powody';
  const pomin = async (nazwa, powod) => {
    status(powod + ': ' + nazwa);
    try { const m = JSON.parse(sessionStorage.getItem(K_POWODY) || '{}'); m[nazwa] = powod; sessionStorage.setItem(K_POWODY, JSON.stringify(m)); } catch {}
    if (modalOtwarty()) modal().querySelector('button.btn-default')?.click();
    dodaj(K_SKIP, nazwa);
    await czekaj(1500);
  };

  async function szukajZeScrollem(nazwa) {
    status('szukam: ' + nazwa);
    // najpierw bez przewijania – może pole już jest gdzieś na stronie
    let p = poleParametru(nazwa);
    if (p) return p;
    window.scrollTo(0, 0);
    await czekaj(500);
    p = poleParametru(nazwa);
    if (p) return p;

    // duże skoki w dół (SKOK_EKRANOW ekranów naraz), krótkie czekanie
    let bezZmian = 0, skok = 0;
    while (bezZmian < 3) {
      if (!dziala()) return 'pauza';
      const przed = window.scrollY, wys = document.scrollingElement.scrollHeight;
      window.scrollBy(0, window.innerHeight * SKOK_EKRANOW);
      skok++;
      status('szukam: ' + nazwa + ' (skok ' + skok + ')');
      await czekaj(SKOK_CZEKAJ_MS);
      p = poleParametru(nazwa);
      if (p) return p;
      bezZmian = (window.scrollY === przed && document.scrollingElement.scrollHeight === wys) ? bezZmian + 1 : 0;
    }
    return null;
  }


  // ---- Base robi kopiowanie/mapowanie/akcje jako "operację masową" w tle.
  // Dopóki trwa, przycisk na dolnym pasku ma status "processing". Nowa operacja PRZERYWA poprzednią,
  // a odświeżenie strony też ją przerywa – więc zawsze czekamy aż się skończy.
  const trwaOperacja = () => {
    const $ = window.jQuery;
    const b = document.getElementById('run_massive_action_button');
    return !!(($ && $('#run_massive_action_button').data('status') === 'processing') || b?.querySelector('.fa-spinner'));
  };
  async function czekajNaOperacje(opis = 'Base zapisuje') {
    await czekaj(800);                                   // daj operacji wystartować
    const start = Date.now();
    while (trwaOperacja() && Date.now() - start < 15 * 60000) {
      const postep = (document.body.innerText.match(/Postęp:\s*[^\n]{0,25}/) || [''])[0];
      status(opis + '… ' + Math.round((Date.now() - start) / 1000) + ' s ' + postep);
      await czekaj(500);
    }
    await czekaj(500);
  }

  async function zrobAkcje(k) {
    const sel = document.getElementById('massive_action');
    const run = document.getElementById('run_massive_action_button');
    if (!sel || !run) return 'brak paska akcji';
    if (![...sel.options].some(o => o.value === k.wartosc)) return 'brak akcji';
    const K_PRZED = 'am_' + LID + '_przedNiedop', K_PO = 'am_' + LID + '_poNiedop';
    if (k.wartosc === 'remove_mismatched' && await mostOk()) {
      const r = await bazaBase('test', {}, 20000);
      if (r.wynik) sessionStorage.setItem(K_PRZED, String(r.wynik.n));
      // zapamiętaj ID wszystkich produktów PRZED usunięciem (niedopasowane też trafią do spisu)
      const ri = await bazaBase('idsProduktow', {}, 30000);
      if (ri.wynik && ri.wynik.ids) {
        sessionStorage.setItem('am_' + LID + '_idsPrzed', JSON.stringify(ri.wynik.ids));   // tylko PAMIĘĆ paczki – na listę 📋 dopiero przy kliknięciu WYSTAW
        try { const oc = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null'); if (oc) { oc.wczytane = ri.wynik.ids.map(String); localStorage.setItem(L_OCZEKUJACA, JSON.stringify(oc)); } } catch {}
      }
    }
    ustawSelect(sel, k.wartosc);
    await czekaj(500);
    dodaj(K_DONE, k.nazwa);
    run.click();
    status(k.nazwa + ' – czekam…');
    await czekaj(2000);
    await czekajNaOperacje(k.nazwa);
    await czekajNa(listaZaladowana, 60000);
    await czekaj(2000);
    if (k.wartosc === 'remove_mismatched' && await mostOk()) {
      const r = await bazaBase('test', {}, 20000);
      if (r.wynik) { sessionStorage.setItem(K_PO, String(r.wynik.n)); sessionStorage.setItem('am_' + LID + '_ileProduktow', String(r.wynik.n)); }
      status('niedopasowane usunięte: ' + ((+sessionStorage.getItem(K_PRZED) || 0) - (r.wynik ? r.wynik.n : 0)) + ', zostało: ' + (r.wynik ? r.wynik.n : '?'));
    }
    return 'ok';
  }

  async function dodajRegule(wartosc) {
    const m = modal();
    const dodajBtn = [...m.querySelectorAll('button')].find(b => b.textContent.includes('Dodaj parametr') && b.offsetParent);
    if (!dodajBtn) return false;
    dodajBtn.click();
    const sel = await czekajNa(() => { const s = document.getElementById('editorActionType'); return s && s.offsetParent ? s : null; }, 5000);
    if (!sel) return false;
    await czekaj(400);
    ustawSelect(sel, wartosc);
    const when = document.getElementById('editorActionWhen');
    if (when) ustawSelect(when, 0);
    await czekaj(600);
    document.getElementById('btnSaveEdition')?.click();
    return !!(await czekajNa(() => !document.getElementById('row_-1') && regulyWOknie().length > 0, 8000));
  }

  async function zamknijWszystkieMenu() {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.querySelectorAll('.btn-group.open').forEach(g => g.classList.remove('open'));
    if (window.jQuery) { try { window.jQuery('select.select2-hidden-accessible').select2('close'); } catch {} }
    document.body.click();
    await czekaj(400);
  }

  async function mapuj(nazwa, regula, pole) {
    const oknoOk = () => modalOtwarty() && tytulModala().endsWith(nazwa);
    let otwarte = false;
    for (let proba = 1; proba <= 3 && !otwarte; proba++) {
      await zamknijWszystkieMenu();
      // po "Kopiuj do wszystkich" Base potrafi przerysować pola – weź świeże
      if (!pole || !pole.isConnected || proba > 1) pole = poleParametru(nazwa) || (await szukajZeScrollem(nazwa));
      if (!pole || pole === 'pauza') return 'brak pola do mapowania';
      const lan = pole.querySelector('button.params_mapping');
      if (!lan) return 'brak przycisku mapowania';
      lan.scrollIntoView({ block: 'center' });
      await czekaj(600);
      lan.click();
      status('czekam na okno mapowania: ' + nazwa);
      otwarte = !!(await czekajNa(oknoOk, 30000));    // Base bywa wolny – do 30 s
      if (!otwarte) {
        if (modalOtwarty() && !oknoOk()) modal().querySelector('button.btn-default')?.click(); // otwarte złe okno – zamknij
        status('okno mapowania się nie otworzyło – próba ' + (proba + 1));
        await czekaj(2000);
        if (oknoOk()) otwarte = true;                  // otworzyło się w ostatniej chwili
      }
    }
    if (!otwarte) return 'nie otworzyło się okno';
    await czekaj(1800);
    if (regulyWOknie().length === 0) {
      if (regula == null) return 'brak reguły, pomijam';
      status('dodaję regułę: ' + nazwa);
      if (!await dodajRegule(regula)) return 'nie udało się dodać reguły';
      await czekaj(1000);
    }
    const b = przyciskWszystkie();
    if (!b || b.disabled) return 'przycisk nieaktywny';
    b.click();
    status('mapuje ' + nazwa + '…');
    await czekaj(1000);
    for (let i = 0; i < 1500 && modalOtwarty(); i++) await czekaj(200);
    await czekajNaOperacje('Base mapuje ' + nazwa);
    await czekaj(1000);
    return 'ok';
  }

  async function kopiujDoWszystkich(pole) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // zamknij otwarte listy
    await czekaj(300);
    const toggle = pole.querySelector('button.dropdown-toggle');
    const grupa = toggle?.closest('.btn-group');
    if (toggle && !grupa?.classList.contains('open')) toggle.click();
    await czekaj(600);
    if (toggle && !grupa?.classList.contains('open')) { toggle.click(); await czekaj(600); }
    const kopiuj = pole.querySelector('a.copy_param[data-type="products"]');
    if (!kopiuj) return false;
    kopiuj.click();
    await czekajNaOperacje('Base kopiuje');
    await czekaj(500);
    // Base pokazuje kręciołek na przycisku, dopóki kopiuje – czekaj aż zniknie (max 2 min)
    for (let i = 0; i < 600; i++) {
      const p2 = poleParametru(pole.querySelector('span.param_label')?.title || '') || pole;
      if (!p2.querySelector('.fa-spinner')) break;
      if (i % 25 === 0) status('Base kopiuje…');
      await czekaj(200);
    }
    await czekaj(1500);
    if (grupa?.classList.contains('open')) toggle.click();   // zamknij menu
    return true;
  }

  // odczyt wartości pola (lista / multi-lista / tekst)
  const wartoscPola = p => {
    const sel = p.querySelector('select');
    if (sel) {
      const t = [...sel.selectedOptions].map(o => o.text.trim()).filter(Boolean).join(', ');
      if (t) return t;
      const r = p.querySelector('.select2-selection__rendered');
      return r ? r.textContent.replace(/^×/, '').replace(/\s+/g, ' ').trim() : '';
    }
    return (p.querySelector('input, textarea')?.value || '').trim();
  };
  // ile pól o tej nazwie (z załadowanych na stronie) ma inną wartość niż oczekiwana
  const niezgodne = (nazwa, oczekiwana) => [...document.querySelectorAll('span.param_label')]
    .filter(s => s.title === nazwa).map(s => s.closest('.lfi_param')).filter(Boolean)
    .filter(p => {                       // pomiń listy jeszcze niezaładowane (Base ładuje je dopiero po kliknięciu)
      const sel = p.querySelector('select');
      return !(sel && sel.classList.contains('lazy-select2-pending') && !sel.options.length);
    })
    .filter(p => norm(wartoscPola(p).replace(/^×/, '')) !== norm(oczekiwana));
  const policzPola = nazwa => [...document.querySelectorAll('span.param_label')].filter(s => s.title === nazwa).length;

  // ---- sprawdzenie w BAZIE formularza Base (widok innych produktów odświeża się dopiero po przeładowaniu) ----
  const pustaWartosc = v => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  const wartoscZeSciezki = (obj, sciezka) => sciezka.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  async function sprawdzWBazie(nazwa, oczekiwana) {   // oczekiwana: wartość (np. id opcji) albo '' = puste
    const H = window.FormItemHelper, F = window.findParentFormItemUniqueId, $ = window.jQuery;
    if (!H || !F || !$) return null;                 // nie da się sprawdzić
    const pola = [...document.querySelectorAll('span.param_label')].filter(x => x.title === nazwa)
      .map(x => x.closest('.lfi_param')).filter(Boolean);
    let zle = 0, wszystkie = 0, timeouty = 0;
    const start = Date.now();
    const zLimitem = (pr, ms) => Promise.race([pr, new Promise(r => setTimeout(() => r('__timeout'), ms))]);
    for (const p of pola.slice(0, 15)) {                 // próbka 15 produktów wystarczy
      if (Date.now() - start > 30000) break;             // nie dłużej niż 30 s
      const inp = p.querySelector('[data-field-source]');
      if (!inp) continue;
      const sciezka = inp.getAttribute('data-field-source');
      try {
        const item = await zLimitem(H.getItemFromDB(F($(inp))), 6000);
        if (item === '__timeout') { if (++timeouty >= 3) return null; continue; }
        if (!item) continue;
        wszystkie++;
        const v = wartoscZeSciezki(item, sciezka);
        const ok = pustaWartosc(oczekiwana)
          ? pustaWartosc(v)
          : String(Array.isArray(v) ? v.join(',') : v) === String(Array.isArray(oczekiwana) ? oczekiwana.join(',') : oczekiwana);
        if (!ok) zle++;
      } catch { }
    }
    return { zle, wszystkie };
  }
  // czeka do 20 s aż baza się zgodzi
  async function czekajNaBaze(nazwa, oczekiwana) {
    let w = null;
    for (let i = 0; i < 20; i++) {
      w = await sprawdzWBazie(nazwa, oczekiwana);
      if (!w || w.zle === 0) return w;
      await czekaj(1000);
    }
    return w;
  }

  // otwiera listę w danym polu i wybiera wartość – kilka sposobów, bo Base ładuje listy leniwie
  async function wybierzWPolu(pole, wartosc) {
    const sel = pole.querySelector('select');
    if (!sel) return { ok: false, powod: 'brak listy' };
    const $ = window.jQuery;
    const szukajOpcji = () => [...document.querySelectorAll('.select2-results__option')]
      .find(e => e.offsetParent && norm(e.textContent) === norm(wartosc));
    const zamknij = () => { try { $ && $(sel).hasClass('select2-hidden-accessible') && $(sel).select2('close'); } catch {} };

    // już ustawione?
    if (norm(sel.selectedOptions[0]?.text) === norm(wartosc)) return { ok: true, sel };

    await zamknijWszystkieMenu();
    pole.scrollIntoView({ block: 'center' });
    await czekaj(700);

    const sposoby = [
      () => { myszka(sel, ['mouseover', 'mouseenter', 'focus', 'mousedown']); sel.focus(); },
      () => { const b = pole.querySelector('.select2-selection'); if (b) myszka(b, ['mousedown', 'mouseup', 'click']); },
      () => { try { $ && $(sel).select2('open'); } catch {} },
      () => { const b = pole.querySelector('.select2-selection'); if (b) { b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); } }
    ];
    let opcja = null;
    for (const sposob of sposoby) {
      sposob();
      opcja = await czekajNa(szukajOpcji, 6000);   // lista może się chwilę ładować
      if (opcja) break;
      zamknij();
      await czekaj(500);
    }
    if (!opcja) {                                  // ostatnia szansa: wpisz w wyszukiwarkę listy
      sposoby[1]();
      const szukaj = await czekajNa(() => { const i = document.querySelector('.select2-container--open .select2-search__field'); return i && i.offsetParent ? i : null; }, 3000);
      if (szukaj) {
        szukaj.value = wartosc;
        szukaj.dispatchEvent(new Event('input', { bubbles: true }));
        szukaj.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        opcja = await czekajNa(szukajOpcji, 6000);
      }
    }
    if (!opcja) { zamknij(); return { ok: false, powod: 'brak opcji ' + wartosc }; }
    myszka(opcja, ['mouseover', 'mousedown', 'mouseup', 'click']);
    await czekaj(900);
    if (norm(sel.selectedOptions[0]?.text) !== norm(wartosc)) { zamknij(); return { ok: false, powod: 'nie wybrało ' + wartosc }; }
    return { ok: true, sel };
  }

  async function zrobWybor(k, pole) {
    if (await mostOk()) {
      status('ustawiam ' + k.nazwa + ' = ' + k.wartosc + ' we wszystkich produktach…');
      const r = k.sciezka
        ? await bazaBase('ustawPole', { sciezka: k.sciezka, zrodlo: k.zrodlo, tekst: k.wartosc })
        : await bazaBase('ustawListe', { nazwa: k.nazwa, tekst: k.wartosc });
      if (!r.blad && r.wynik) {
        const w = r.wynik;
        if (w.pola === 0) return 'żaden produkt nie ma tego parametru';
        if (w.brakOpcji === w.pola) return 'brak opcji ' + k.wartosc;
        if (w.zle) return 'nie ustawiło w ' + w.zle + ' z ' + w.pola + ' produktów';
        status(k.nazwa + ' = ' + k.wartosc + ' ✔ (' + w.pola + ' produktów)');
        return 'ok';
      }
      console.log('[AutoMap] dane Base – błąd, przechodzę na klikanie:', r.blad);
    }
    return await zrobWyborKlikaniem(k, pole);
  }

  // cennik wysyłki wg grupy tagów paczki (DUŻE / KURIER / PACZKOMAT)
  async function zrobCennik(k, pole) {
    let oczek = null;
    try { oczek = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null'); } catch {}
    if (!oczek || !oczek.cennik) return 'pomijam – paczka bez grupy tagów (brak cennika do ustawienia)';
    const blad = powod => {                                   // zły cennik = zła wysyłka → nie wystawiaj automatycznie
      sessionStorage.setItem('am_' + LID + '_krytyczne', 'Cennik wysyłki: ' + powod);
      return powod;
    };
    if (!await mostOk()) return blad('brak dostępu do danych Base');
    const r = await bazaBase('znajdzCennik', { slowo: oczek.cennik, katalog: oczek.katNazwa || '' }, 30000);
    if (r.blad || !r.wynik) return blad(r.blad || 'brak odpowiedzi');
    if (r.wynik.blad) { console.log('[AutoMap] cenniki:', r.wynik.wszystkie); return blad(r.wynik.blad); }
    status('grupa ' + oczek.grupa + ' → cennik „' + r.wynik.tekst + '”');
    const w = await zrobWybor({
      typ: 'wybor', nazwa: 'Cennik wysyłki', wartosc: r.wynik.tekst,
      sciezka: 'siteItems.pl.marketplaceParams.delivery_method.value', zrodlo: 'sites.pl.marketplaceParams.delivery_method.options'
    }, pole);
    return w === 'ok' ? 'ok' : blad(w);
  }

  async function zrobWyborKlikaniem(k, pole) {
    if (!pole) { pole = await szukajZeScrollem(k.nazwa); if (!pole || pole === 'pauza') return 'brak pola'; }
    // spróbuj w pierwszym produkcie, a jak się nie da – w kolejnych (max 4)
    const kandydaci = [pole, ...[...document.querySelectorAll('span.param_label')]
      .filter(x => x.title === k.nazwa).map(x => x.closest('.lfi_param'))
      .filter(p => p && p !== pole)].slice(0, 4);
    let wynik = null;
    for (const p of kandydaci) {
      wynik = await wybierzWPolu(p, k.wartosc);
      if (wynik.ok) { pole = p; break; }
      status(k.nazwa + ': ' + wynik.powod + ' – próbuję w innym produkcie');
    }
    if (!wynik || !wynik.ok) return wynik ? wynik.powod : 'brak listy';
    const sel = wynik.sel;
    if (!await kopiujDoWszystkich(pole)) return 'brak "Kopiuj do wszystkich"';

    // sprawdź w bazie, czy naprawdę skopiowało; jak nie – ponów
    const cel = sel.value;
    for (let proba = 1; proba <= 3; proba++) {
      const w = await czekajNaBaze(k.nazwa, cel);
      if (!w) {                                   // brak dostępu do bazy – stary sposób
        const zle = niezgodne(k.nazwa, k.wartosc).length;
        return zle ? 'nie skopiowało do ' + zle + ' produktów' : 'ok';
      }
      if (w.zle === 0) return 'ok';
      status('w bazie ' + w.zle + '/' + w.wszystkie + ' bez zmiany – kopiuję ponownie');
      pole = poleParametru(k.nazwa) || pole;
      pole.scrollIntoView({ block: 'center' });
      await czekaj(600);
      if (!await kopiujDoWszystkich(pole)) break;
    }
    const w = await sprawdzWBazie(k.nazwa, cel);
    return (w && w.zle) ? 'nie skopiowało do ' + w.zle + ' z ' + w.wszystkie + ' produktów' : 'ok';
  }

  function wyczyscInput(inp) {
    inp.focus();
    inp.value = '';
    ['input', 'keyup', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
    if (window.jQuery) window.jQuery(inp).trigger('change');
  }

  // Wstaw SKU od razu w danych Base (bez okna mapowania i bez odświeżania); zapas: mapowanie przez Base
  async function zrobSku(k, pole) {
    if (await mostOk()) {
      status('wstawiam SKU do ' + k.nazwa + ' we wszystkich produktach…');
      const r = await bazaBase('ustawSku', { nazwa: k.nazwa });
      if (!r.blad && r.wynik) {
        const w = r.wynik;
        if (w.pola === 0) return 'żaden produkt nie ma tego parametru';
        if (w.zle) return 'nie wstawiło SKU w ' + w.zle + ' z ' + w.pola + ' produktów';
        status(k.nazwa + ' = SKU ✔ (' + w.pola + ' produktów)');
        return 'ok';
      }
    }
    if (!pole) { pole = await szukajZeScrollem(k.nazwa); if (!pole || pole === 'pauza') return 'brak pola'; }
    return await mapuj(k.nazwa, 5, pole);
  }

  async function zrobWyczysc(k, pole) {
    if (k.regula === 5 && await mostOk()) {
      status('wstawiam SKU do ' + k.nazwa + ' we wszystkich produktach…');
      const r = await bazaBase('ustawSku', { nazwa: k.nazwa });
      if (!r.blad && r.wynik) {
        const w = r.wynik;
        if (w.pola === 0) return 'żaden produkt nie ma tego parametru';
        if (w.zle) return 'nie wstawiło SKU w ' + w.zle + ' z ' + w.pola + ' produktów';
        status(k.nazwa + ' = SKU ✔ (' + w.pola + ' produktów)');
        return 'ok';
      }
      console.log('[AutoMap] dane Base – błąd, przechodzę na klikanie:', r.blad);
    }
    return await zrobWyczyscKlikaniem(k, pole);
  }

  async function zrobWyczyscKlikaniem(k, pole) {
    if (!pole) { pole = await szukajZeScrollem(k.nazwa); if (!pole || pole === 'pauza') return 'brak pola'; }
    pole.scrollIntoView({ block: 'center' });
    await czekaj(800);
    const sel = pole.querySelector('select');
    if (sel) {
      if (window.jQuery) window.jQuery(sel).val(null).trigger('change');
      for (let i = 0; i < 50; i++) {
        const x = pole.querySelector('.select2-selection__choice__remove');
        if (!x) break;
        myszka(x, ['mousedown', 'mouseup', 'click']);
        await czekaj(200);
      }
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } else {
      const inp = pole.querySelector('input, textarea');
      if (inp) wyczyscInput(inp);
    }
    await czekaj(800);
    if (!await kopiujDoWszystkich(pole)) return 'brak "Kopiuj do wszystkich"';
    const wb = await czekajNaBaze(k.nazwa, '');
    if (wb && wb.zle) {                 // jeszcze raz
      status('czyszczenie nie weszło w ' + wb.zle + ' produktach – ponawiam');
      const p2 = poleParametru(k.nazwa) || pole;
      await kopiujDoWszystkich(p2);
      const wb2 = await czekajNaBaze(k.nazwa, '');
      if (wb2 && wb2.zle) return 'nie wyczyściło w ' + wb2.zle + ' z ' + wb2.wszystkie + ' produktów';
    }
    await czekaj(1000);
    return await mapuj(k.nazwa, k.regula, poleParametru(k.nazwa) || pole);
  }

  async function zrobIdProd(k, pole) {
    if (await mostOk()) {
      status('czekam aż Base wpisze -1 w ID produktyzacji…');
      let n = 0;
      for (let i = 0; i < 45; i++) {                 // do ~90 s
        const r = await bazaBase('ileMinusJeden', {});
        n = (r.wynik && r.wynik.n) || 0;
        if (n > 0) break;
        await czekaj(2000);
      }
      if (n === 0) return 'brak -1 w ID produktyzacji (nic do czyszczenia)';
      status('usuwam -1 z ' + n + ' produktów…');
      const r = await bazaBase('wyczyscIdProd', {});
      if (!r.blad && r.wynik) {
        if (r.wynik.zle) return 'zostało -1 w ' + r.wynik.zle + ' produktach';
        status('ID produktyzacji wyczyszczone ✔ (' + r.wynik.zmienione + ')');
        return 'ok';
      }
      console.log('[AutoMap] dane Base – błąd, przechodzę na klikanie:', r.blad);
    }
    return await zrobIdProdKlikaniem(k, pole);
  }

  async function zrobIdProdKlikaniem(k, pole) {
    if (!pole) { pole = await szukajZeScrollem(k.nazwa); if (!pole || pole === 'pauza') return 'brak pola'; }
    // pola ID produktyzacji wszystkich produktów
    const polaId = () => [...document.querySelectorAll('span.param_label')]
      .filter(s => s.title === k.nazwa)
      .map(s => s.closest('.lfi_param'))
      .filter(Boolean);
    const zMinusJeden = () => polaId().find(p => p.querySelector('input')?.value.trim() === '-1');

    // akcja "Nowy produkt w katalogu" wpisuje -1 z opóźnieniem – poczekaj do 90 s
    status('czekam aż w ID produktyzacji pojawi się -1…');
    let cel = zMinusJeden();
    for (let i = 0; i < 90 && !cel; i++) {
      await czekaj(1000);
      cel = zMinusJeden();
      if (!cel && i % 10 === 9) {           // może -1 jest niżej – zjedź
        window.scrollBy(0, window.innerHeight * 0.8);
      }
    }
    if (!cel) return 'nie znalazłem -1 w ID produktyzacji';

    cel.scrollIntoView({ block: 'center' });
    await czekaj(800);
    const inp = cel.querySelector('input');
    wyczyscInput(inp);
    await czekaj(800);
    if (inp.value.trim() !== '') return 'nie udało się wyczyścić -1';
    if (!await kopiujDoWszystkich(cel)) return 'brak "Kopiuj do wszystkich"';
    const wb = await czekajNaBaze(k.nazwa, '');
    if (wb && wb.zle) return 'w bazie ' + wb.zle + ' z ' + wb.wszystkie + ' produktów dalej ma ID';
    await czekaj(1500);
    const zostalo = polaId().filter(p => p.querySelector('input')?.value.trim() === '-1').length;
    if (zostalo) status('uwaga: w ' + zostalo + ' polach dalej jest -1');
    return 'ok';
  }

  // ---- czekanie aż Base skończy wysyłać ----
  const oknoWysylania = () => [...document.querySelectorAll('.modal')]
    .find(m => m.offsetParent !== null && getComputedStyle(m).display !== 'none' && /Wysyłanie/i.test(m.querySelector('.modal-title, .modal-header')?.textContent || ''));
  const przerwijWidoczny = () => [...document.querySelectorAll('.modal button')]
    .some(b => b.offsetParent !== null && /Przerwij/i.test(b.textContent));

  const MINUTY_BEZ_POSTEPU = 2;                       // po ilu minutach bez postępu alarm
  // wysyłanie stoi w miejscu → odśwież stronę i kliknij WYSTAW jeszcze raz (Base wyśle tylko to, co jeszcze nie poszło); do PONOW_MAX razy na paczkę
  const SEKUNDY_STOI_PONOW = 120, PONOW_MAX = 10;
  // liczniki z opisu („wystawione X, błędne Y / Z”) albo ze stanu („X/Y/Z”) – do decyzji, czy w ogóle ponawiać
  const liczniki = (opis, stan) => {
    const m = String(opis || '').match(/wystawione\s+(\d+),\s*b\S*dne\s+(\d+)\s*\/\s*(\d+)/i) || String(stan || '').match(/^(\d+)\/(\d+)\/(\d+)$/);
    return m ? { sent: +m[1], err: +m[2], tot: +m[3] } : null;
  };
  async function ponowWystawianie(opis, stan) {
    const K = 'am_' + LID + '_ponowN', KS = 'am_' + LID + '_ponowStan';
    // Base przerobił całą paczkę (wystawione + błędne = wszystkie) – błędnych nie wystawi ani teraz, ani po odświeżeniu.
    // Nie ponawiamy: błędne lądują na liście ⏳ i bierzemy kolejną paczkę.
    const l = liczniki(opis, stan);
    if (l && l.tot > 0 && l.sent + l.err >= l.tot) {
      sessionStorage.removeItem(K); sessionStorage.removeItem(KS);
      if (l.err > 0) { await zakonczNiedokonczona('cała paczka przerobiona: wystawione ' + l.sent + ', błędne ' + l.err + ' – błędnych się nie da wystawić'); return; }
      status('wszystko przerobione (' + l.sent + '/' + l.tot + ') – lecę dalej');
      await dalejPoWystawieniu();
      await new Promise(() => {});
      return;
    }
    const n = (parseInt(sessionStorage.getItem(K)) || 0) + 1;
    // po odświeżeniu i ponownym WYSTAW nic się nie ruszyło (te same liczby) → Base nie ma już czego wysłać:
    // niewystawione z tej paczki na osobną listę ⏳ i lecimy dalej (raport, mapowanie EAN / następna paczka)
    if (stan && n >= 2 && sessionStorage.getItem(KS) === String(stan)) { await zakonczNiedokonczona(opis); return; }
    // są błędne i po jednym ponowieniu dalej stoi – to już te, których Base nie wystawi: na ⏳ i kolejna paczka
    if (l && l.err > 0 && n >= 2) { await zakonczNiedokonczona('po ponowieniu dalej stoi: wystawione ' + l.sent + ', błędne ' + l.err + ' / ' + l.tot + ' – resztę zapisuję'); return; }
    if (stan) sessionStorage.setItem(KS, String(stan));
    sessionStorage.setItem(K, String(n));
    if (n > PONOW_MAX) {
      zatrzymajCykl('WYSTAWIANIE STOI', 'Po ' + PONOW_MAX + ' odświeżeniach i ponownym WYSTAW dalej stoi (' + (opis || '') + '). Zajrzyj do Base.');
      return;
    }
    status('⏳ stoi ' + SEKUNDY_STOI_PONOW / 60 + ' min (' + (opis || '') + ') – odświeżam i wystawiam jeszcze raz (' + n + '/' + PONOW_MAX + ')…');
    powiadom('↻ Wystawianie stało – ponawiam ' + n + '/' + PONOW_MAX, (opis || '') + '\nOdświeżam stronę i klikam WYSTAW jeszcze raz.', { tagi: ['repeat'] });
    sessionStorage.setItem('am_' + LID + '_ponowWystaw', '1');
    await czekaj(1500);
    location.reload();
    await new Promise(() => {});                          // strona się przeładowuje
  }
  const L_NIEDOKONCZONE = 'autoNiedokonczone';
  async function zakonczNiedokonczona(opis) {
    let ids = [], info = '';
    if (await mostOk()) {
      const r = await bazaBase('niewystawione', {}, 60000);
      if (r.wynik && r.wynik.ok) { ids = r.wynik.ids; info = 'pole ' + r.wynik.pole; }
      else console.log('[AutoMap] niewystawione – nie rozpoznałem statusu:', r);
    }
    let oczek = null; try { oczek = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null'); } catch {}
    const l = lsJson(L_NIEDOKONCZONE);
    l.push({ t: Date.now(), proces: PROCES.nazwa, konto: (oczek && oczek.konto) || '', kat: (oczek && oczek.katNazwa) || '', ids, opis: opis || '' });
    lsSet(L_NIEDOKONCZONE, JSON.stringify(l.slice(-200)));
    sessionStorage.removeItem('am_' + LID + '_ponowN'); sessionStorage.removeItem('am_' + LID + '_ponowStan');
    status('⏳ paczka niedokończona (' + (opis || '') + ') – ' + (ids.length ? ids.length + ' niewystawionych na liście ⏳' : 'nie rozpoznałem, które – zapisane bez ID') + ', lecę dalej');
    powiadom('⏳ Paczka niedokończona – lecę dalej', (opis || '') + '\n' + (ids.length ? ids.length + ' niewystawionych zapisanych na liście ⏳ (📋 → Niedokończone).' : 'Nie rozpoznałem, które produkty nie poszły – zapisałem wpis bez ID.'), { priorytet: 4, tagi: ['hourglass'] });
    await czekaj(1500);
    document.querySelectorAll('.toast .close, .toast-close-button, .notification .close').forEach(b => { try { b.click(); } catch {} });
    await dalejPoWystawieniu();
    await new Promise(() => {});                          // dalej idzie przez dalejPoWystawieniu – nie wracaj do wywołującego (bez podwójnego raportu)
  }
  async function ponowWystawPoOdswiezeniu() {
    sessionStorage.removeItem('am_' + LID + '_ponowWystaw');
    status('🔁 ponowne WYSTAW po odświeżeniu – czekam na listę…');
    await czekajNa(listaZaladowana, 90000);
    await czekaj(4000);
    const w = await czekajNa(() => document.getElementById('button_sell_start'), 30000);
    if (!w) { status('nie znalazłem przycisku Wystaw oferty – kliknij sam'); pikaj(3); return; }
    status('🔁 klikam WYSTAW jeszcze raz…');
    try { const oc = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null'); if (oc) { oc.wystawiono = Date.now(); localStorage.setItem(L_OCZEKUJACA, JSON.stringify(oc)); } } catch {}
    w.click();
    await czekajNaKoniecWysylania();
    await dalejPoWystawieniu();
  }

  async function czekajNaKoniecWysylania() {
    status('wystawiam… czekam na koniec');
    // „Wystąpił błąd – Brak prawidłowych ofert do wysłania” = Base nie ma czego wysłać → zapisz niewystawione i leć dalej
    const brakOfert = () => /Brak prawid\S* ofert do wys/i.test(document.body.innerText || '');
    await czekajNa(() => oknoWysylania() || przerwijWidoczny() || brakOfert(), 30000);
    if (brakOfert()) { await zakonczNiedokonczona('Base: brak prawidłowych ofert do wysłania'); return; }
    let spokoj = 0, ostatniPostep = -1, ostatniaZmiana = Date.now(), alarm = false, opis = '';
    const uzyjBazy = await mostOk();
    // postęp = ile ofert Base już przerobił (wystawione + błędne) – z liczników Base
    const liczbyOkna = () => { const m = (document.body.innerText || '').match(/Wysłanych:\s*(\d+)\s*\|\s*Błędnych:\s*(\d+)\s*\|\s*Poprawnych\s*:\s*(\d+)/i); if (!m) return null; const o = { w: +m[1], b: +m[2], p: +m[3] }; try { sessionStorage.setItem('am_' + LID + '_okno', JSON.stringify(o)); } catch {} return o; };
    // Base wysłał już wszystko do Allegro (Wysłanych + Błędnych = cała paczka) – „Poprawnych” Allegro dolicza potem w tle (TWORZENIE), na to nie czekamy
    const wszystkoWyslane = tot => { const o = liczbyOkna(); const n = tot || (pomiar() && pomiar().n) || 0; return !!(o && n > 0 && o.w + o.b >= n); };
    const zOkna = () => { const m = (document.body.innerText || '').match(/Wysłanych:\s*(\d+)\s*\|\s*Błędnych:\s*(\d+)\s*\|\s*Poprawnych\s*:\s*(\d+)/i); return m ? m.slice(1).join('/') : ''; };
    const postep = async () => {
      if (uzyjBazy) {
        const r = await bazaBase('liczniki', {}, 15000);
        if (r.wynik) {
          const w = r.wynik;
          opis = 'wystawione ' + (w.sent || 0) + ', błędne ' + (w.error || 0) + ' / ' + (w.total || '?');
          return (Number(w.sent) || 0) + (Number(w.error) || 0);
        }
      }
      // zapas: licznik z okna wysyłania
      const t = (oknoWysylania()?.innerText || '') + ' ' + ((document.body.innerText.match(/Postęp:[^\n]*/) || [''])[0]);
      const m = t.match(/\(\s*(\d+)\s*\/\s*\d+\s*\)/);
      opis = m ? 'postęp ' + m[1] : '';
      return m ? parseInt(m[1]) : -1;
    };
    for (let i = 0; i < 4 * 3600; i++) {              // max 4 h
      const trwa = przerwijWidoczny();
      if (!trwa && brakOfert()) { await zakonczNiedokonczona('Base: brak prawidłowych ofert do wysłania'); return; }
      spokoj = trwa ? 0 : spokoj + 1;
      if (spokoj >= 8) break;                          // 8 s bez "Przerwij" = koniec
      if (i % 5 === 0) {                               // co 5 s sprawdź postęp
        const p = await postep();
        const okno = zOkna();
        if (!przerwijWidoczny() && wszystkoWyslane()) { status('Base wysłał całą paczkę (' + okno + ') – Allegro tworzy oferty w tle, lecę dalej'); break; }
        if (okno && okno !== czekajNaKoniecWysylania.__okno) { czekajNaKoniecWysylania.__okno = okno; ostatniaZmiana = Date.now(); }
        if (p >= 0 && p <= ostatniPostep && Date.now() - ostatniaZmiana > SEKUNDY_STOI_PONOW * 1000) { await ponowWystawianie(opis || okno, p + '|' + okno); return; }
        if (p > ostatniPostep) {                       // poszło do przodu
          ostatniPostep = p; ostatniaZmiana = Date.now();
          if (alarm) { alarm = false; schowajAlarm(); powiadom('▶ Wystawianie ruszyło', opis, { tagi: ['arrow_forward'] }); }
        } else if (!alarm && trwa && p >= 0 && Date.now() - ostatniaZmiana > MINUTY_BEZ_POSTEPU * 60000) {
          alarm = true;
          pokazAlarm('WYSTAWIANIE STOI', 'Od ' + MINUTY_BEZ_POSTEPU + ' min liczba wystawionych się nie zmienia (' + opis + '). Sprawdź okno Base.');
          powiadom('⚠️ Wystawianie stoi', 'Od ' + MINUTY_BEZ_POSTEPU + ' min bez postępu: ' + opis + ' (' + PROCES.nazwa + ').', { priorytet: 5, tagi: ['warning'], akcje: [['📊 Status', 'status'], ['⏹ Stop', 'stop']] });
        }
        status('wystawiam… ' + opis + (alarm ? ' – ⚠️ STOI' : ''));
      }
      await czekaj(1000);
    }
    if (alarm) schowajAlarm();
    // Base może jeszcze tworzyć oferty w tle („TWORZENIE” – np. kategorie erotyczne) – przycisk „Przerwij” już zniknął,
    // a liczniki pokazują 0 wystawionych. Czekamy, aż liczby się ustabilizują (90 s bez zmian), max 20 min.
    if (uzyjBazy) {
      let ost = null, stabilnie = 0;
      const start = Date.now();
      while (Date.now() - start < 20 * 60000 && !przerwanoKatalog) {
        const r = await bazaBase('liczniki', {}, 15000);
        const w = r.wynik || {};
        const sent = Number(w.sent) || 0, err = Number(w.error) || 0, tot = Number(w.total) || 0;
        const klucz = sent + '/' + err + '/' + zOkna();
        stabilnie = klucz === ost ? stabilnie + 10 : 0; ost = klucz;
        if (wszystkoWyslane(tot)) { status('Base wysłał całą paczkę (' + zOkna() + ') – Allegro tworzy oferty w tle, lecę dalej'); break; }
        const wszystko = tot > 0 && sent + err >= tot;
        status('wystawiam… Base kończy w tle: wystawione ' + sent + ', błędne ' + err + ' / ' + (tot || '?') + (stabilnie ? ' (bez zmian ' + stabilnie + ' s)' : ''));
        if (wszystko && stabilnie >= 20) break;          // wszystko policzone i stoi 20 s
        if (!wszystko && tot > 0 && stabilnie >= SEKUNDY_STOI_PONOW) { await ponowWystawianie('wystawione ' + sent + ', błędne ' + err + ' / ' + tot + (zOkna() ? ' · okno ' + zOkna() : ''), sent + '/' + err + '/' + tot); return; }
        if (tot <= 0 && stabilnie >= 90) break;          // brak liczników – 90 s bez zmian = koniec
        await czekaj(10000);
      }
    }
    await czekaj(3000);
  }

  // duży alarm na ekranie + pikanie do skutku
  let alarmPik = null;
  function zatrzymajCykl(tytul, tekst) {
    lsDel(L_FULL); lsDel(L_CYKL); lsDel(L_ETAP); lsSet(L_AUTO, '0');
    try { status('STOP: ' + tytul); } catch {}
    pokazAlarm(tytul, tekst);
    powiadom('🛑 ' + tytul, tekst + '\n' + PROCES.nazwa, { priorytet: 5, tagi: ['rotating_light'] });
    try { odswiezPrzyciski(); } catch {}
  }
  function pokazAlarm(tytul, tekst) {
    schowajAlarm();
    const o = document.createElement('div');
    o.id = 'am-alarm';
    o.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999999;background:#b71c1c;color:#fff;font-family:sans-serif;padding:18px 20px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.6)';
    o.innerHTML = '<div style="font-size:26px;font-weight:bold">⚠️ ' + tytul + '</div><div style="font-size:15px;margin-top:6px">' + tekst + '</div><button id="am-alarm-ok" style="margin-top:10px;background:#fff;color:#b71c1c;border:0;border-radius:8px;padding:8px 16px;font:bold 14px sans-serif;cursor:pointer">Wyłącz dźwięk</button>';
    document.body.appendChild(o);
    o.querySelector('#am-alarm-ok').onclick = () => { clearInterval(alarmPik); alarmPik = null; o.querySelector('#am-alarm-ok').remove(); };
    { const x = document.createElement('button'); x.textContent = '✕'; x.title = 'Schowaj alarm (bot dalej stoi)'; x.style.cssText = 'position:absolute;top:8px;right:12px;background:transparent;color:#fff;border:0;font:bold 22px sans-serif;cursor:pointer'; x.onclick = () => schowajAlarm(); o.appendChild(x); }
    pikaj(4);
    alarmPik = setInterval(() => pikaj(4), 15000);
  }
  function schowajAlarm() {
    if (alarmPik) { clearInterval(alarmPik); alarmPik = null; }
    document.getElementById('am-alarm')?.remove();
  }

  function pokazGotowe() {
    if (pomiar()) zapiszPomiar({ gotowe: Date.now(), pominiete: lista(K_SKIP).length });
    document.getElementById('automap-gotowe')?.remove();
    const pom = lista(K_SKIP);
    const o = document.createElement('div');
    o.id = 'automap-gotowe';
    o.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center';
    o.innerHTML = `
      <div style="background:#1e2a38;color:#fff;padding:36px 44px;border-radius:16px;text-align:center;font-family:sans-serif;max-width:560px;box-shadow:0 10px 40px rgba(0,0,0,.6)">
        <div style="font-size:52px;line-height:1">✅</div>
        <div style="font-size:30px;font-weight:bold;margin:14px 0 8px">GOTOWE DO WYSTAWIENIA</div>
        <div style="font-size:14px;opacity:.8">Sprawdź oferty i potwierdź wystawienie.</div>
        ${cyklWlaczony() ? '<div style="font-size:13px;color:#ce93d8;margin-top:6px">Cykl ON – po wystawieniu skrypt weźmie kolejną paczkę.</div>' : ''}
        ${pom.length ? `<div style="font-size:13px;color:#ffb74d;margin:10px 0;text-align:left;display:inline-block">Pominięte:<br>${(() => { let m = {}; try { m = JSON.parse(sessionStorage.getItem('am_' + LID + '_powody') || '{}'); } catch {} return pom.map(n => '• ' + n + (m[n] ? ' – <span style="opacity:.8">' + m[n] + '</span>' : '')).join('<br>'); })()}</div>` : ''}
        <div style="display:flex;gap:12px;justify-content:center;margin-top:22px">
          <button id="am-wystaw" style="background:#2e7d32;color:#fff;border:0;border-radius:10px;padding:14px 30px;font:bold 18px sans-serif;cursor:pointer">WYSTAW</button>
          ${pom.length ? '<button id="am-powtorz" style="background:#ef6c00;color:#fff;border:0;border-radius:10px;padding:14px 18px;font:bold 15px sans-serif;cursor:pointer">↻ Powtórz pominięte</button>' : ''}
          <button id="am-nie" style="background:#555;color:#fff;border:0;border-radius:10px;padding:14px 22px;font:bold 16px sans-serif;cursor:pointer">Nie teraz</button>
        </div>
      </div>`;
    document.body.appendChild(o);
    const oldTitle = document.title;
    let migaj = true;
    (async () => { while (migaj) { document.title = document.title.startsWith('✅') ? oldTitle : '✅ GOTOWE DO WYSTAWIENIA'; await czekaj(1000); } document.title = oldTitle; })();
    (async () => { for (let i = 0; i < 5 && migaj; i++) { await pikaj(3); await czekaj(8000); } })();

    const bPow = o.querySelector('#am-powtorz');
    if (bPow) bPow.onclick = () => {
      migaj = false; o.remove();
      sessionStorage.removeItem(K_SKIP);
      sessionStorage.removeItem('am_' + LID + '_powody');
      sessionStorage.removeItem('am_' + LID + '_krytyczne');
      sessionStorage.setItem(K_RUN, '1');
      status('powtarzam pominięte…');
      if (!pracuje) krok();
    };
    // telefon: powiadomienie z przyciskami + komendy
    {
      const fa = cyklWlaczony() && lsGet(L_AUTO) === '1' && lsGet(L_FULL) === '1';
      const ile = (pomiar() && pomiar().n) || '';
      powiadom(pom.length ? '⚠️ GOTOWE – są pominięte kroki' : '✅ GOTOWE do wystawienia',
        PROCES.nazwa + (ile ? ' · paczka ' + ile : '') + (pom.length ? '\nPominięte: ' + opisPominietych().join(', ') : '') + (fa ? '\n☠️ FULL AUTO wystawi sam za ' + SEKUNDY_DO_AUTO_WYSTAWIENIA + ' s' : ''),
        { priorytet: pom.length ? 5 : 4, tagi: [pom.length ? 'warning' : 'white_check_mark'], akcje: [['✅ Wystaw', 'wystaw'], ['✖ Anuluj', 'anuluj']] });
      naKomende(kom => {
        if (!document.getElementById('automap-gotowe')) return;
        if (kom === 'wystaw') o.querySelector('#am-wystaw')?.click();
        if (kom === 'anuluj') o.querySelector('#am-nie')?.click();
      });
    }

    // ☠️ FULL AUTO: wystaw sam po odliczaniu – pominięte kroki NIE zatrzymują (są w raporcie i na telefonie)
    let odliczanie = null;
    const fullAuto = cyklWlaczony() && lsGet(L_AUTO) === '1' && lsGet(L_FULL) === '1';
    const krytyczne = sessionStorage.getItem('am_' + LID + '_krytyczne');
    if (fullAuto && krytyczne) {                     // np. zły / brak cennika wysyłki – tego nie wystawiamy w ciemno
      status('☠️ FULL AUTO wstrzymany – ' + krytyczne);
      pokazAlarm('FULL AUTO WSTRZYMANY', krytyczne + '. Ustaw ręcznie i kliknij WYSTAW.');
      powiadom('🛑 Wstrzymane: cennik wysyłki', krytyczne + '\n' + PROCES.nazwa + ' – ustaw ręcznie i wystaw.', { priorytet: 5, tagi: ['rotating_light'], akcje: [['✅ Wystaw mimo to', 'wystaw'], ['✖ Anuluj', 'anuluj']] });
    } else if (fullAuto) {
      let sek = SEKUNDY_DO_AUTO_WYSTAWIENIA;
      const info = document.createElement('div');
      info.style.cssText = 'margin-top:14px;font:bold 15px sans-serif;color:#ef9a9a';
      o.querySelector('#am-wystaw').parentElement.after(info);
      o.querySelector('#am-nie').textContent = 'Anuluj';
      const tik = () => { info.textContent = '☠️ FULL AUTO – wystawiam sam za ' + sek + ' s'; };
      tik();
      odliczanie = setInterval(() => {
        sek--; tik();
        if (sek <= 0) { clearInterval(odliczanie); odliczanie = null; o.querySelector('#am-wystaw').click(); }
      }, 1000);
    }
    o.querySelector('#am-nie').onclick = () => {
      if (odliczanie) { clearInterval(odliczanie); odliczanie = null; }
      migaj = false; o.remove();
      status(fullAuto ? '☠️ anulowano automatyczne wystawienie – kliknij WYSTAW sam albo Start' : 'gotowe – czeka na Twoje Wystaw');
    };
    o.querySelector('#am-wystaw').onclick = async () => {
      if (odliczanie) { clearInterval(odliczanie); odliczanie = null; }
      migaj = false;
      o.remove();
      const w = document.getElementById('button_sell_start');
      if (!w) { status('nie znalazłem przycisku Wystaw oferty'); return; }
      if (pomiar()) zapiszPomiar({ wystaw: Date.now() });
      await zapiszPaczkeDoSpisuPrzyWystaw();
      try { const oc = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null'); if (oc) { oc.wystawiono = Date.now(); localStorage.setItem(L_OCZEKUJACA, JSON.stringify(oc)); } } catch {}
      w.click();
      await czekajNaKoniecWysylania();
      await dalejPoWystawieniu();
    };
  }


  // ---- czekaj, aż Base wczyta WSZYSTKIE produkty wystawiania (500 / 1000), a nie tylko pierwsze ----
  async function czekajNaWszystkieProdukty() {
    const oczekiwane = (pomiar() && pomiar().n) || 0;          // ile wysłaliśmy z katalogu (jeśli wiemy)
    const licznikZeStrony = () => {                              // np. "Postęp: 0% (0/543)"
      const m = document.body.innerText.match(/Postęp:[^(]*\(\s*\d+\s*\/\s*(\d+)\s*\)/);
      return m ? parseInt(m[1]) : 0;
    };
    const laduje = () => /Ładowanie listy|Wczytywanie/i.test(document.body.innerText) || !!document.querySelector('.lfi_loader:not([style*="none"]), .loading-overlay:not([style*="none"])');
    // ile produktów ma to wystawianie – zapamiętane przy PIERWSZYM wczytaniu (po odświeżeniu nie czekamy już 30 s)
    const K_ZNANA = 'am_' + LID + '_ileProduktow';
    const znana = parseInt(sessionStorage.getItem(K_ZNANA)) || 0;
    const start = Date.now();
    let poprz = -1, stabilnie = 0, ile = 0, ostatniaLiczba = -1, zmianaCzas = Date.now(), bladFormularza = false;
    const zamknijBladFormularza = () => {
      const okna = [...document.querySelectorAll('.modal, .swal2-popup, .bootbox, [role="dialog"], .jconfirm-box, .toast, .alert')]
        .filter(e => e.getClientRects().length && /błąd przy pobieraniu formularza|wystąpił błąd/i.test(e.innerText || ''));
      if (!okna.length) return false;
      for (const o of okna) {
        const b = [...o.querySelectorAll('button, a.btn, .close, input[type="button"]')].find(x => x.getClientRects().length && /^(ok|zamknij|close|×|x)$/i.test((x.innerText || x.value || x.getAttribute('aria-label') || '').trim()))
          || o.querySelector('.close, [data-dismiss="modal"], .swal2-confirm');
        try { b && b.click(); } catch {}
      }
      return true;
    };
    while (Date.now() - start < 10 * 60000) {                  // max 10 min
      if (zamknijBladFormularza()) {
        if (!bladFormularza) { bladFormularza = true; zmianaCzas = Date.now(); status('Base: błąd przy pobieraniu formularza – czekam chwilę i biorę to, co się wczytało…'); }
      }
      if (await mostOk()) {
        const r = await bazaBase('test', {}, 20000);
        ile = (r.wynik && r.wynik.n) || 0;
      } else {
        ile = document.querySelectorAll('.lfi_param button.params_mapping').length;
      }
      const naStronie = licznikZeStrony();
      const cel = znana || Math.max(oczekiwane, naStronie);
      status('wczytuję produkty: ' + ile + (cel ? ' / ' + cel : '') + '…');
      stabilnie = (ile === poprz && ile > 0) ? stabilnie + 1 : 0;
      poprz = ile;
      if (cel && ile >= cel) break;                            // wczytane wszystkie (np. 1000/1000) – start od razu
      // Base sam pokazuje, ile ma w wystawianiu (np. 497) – jak tyle wczytał i liczba stoi 2 s, to więcej nie będzie
      if (!znana && naStronie && ile >= naStronie && stabilnie >= 2 && !laduje()) break;
      if (ile !== ostatniaLiczba) { ostatniaLiczba = ile; zmianaCzas = Date.now(); }
      // liczba stoi (pierwszy raz 30 s, po odświeżeniu 10 s; po błędzie formularza 8 s) – ruszamy z tym, co jest
      if (ile > 0 && !laduje() && Date.now() - zmianaCzas > (bladFormularza ? 8000 : znana ? 10000 : 30000)) {
        if (cel && ile < cel) status('wczytano ' + ile + ' z ' + cel + ' – Base odrzucił ' + (cel - ile) + ', ruszam');
        break;
      }
      if (!cel && stabilnie >= 3 && !laduje()) break;          // nie wiemy ile ma być – czekaj aż liczba przestanie rosnąć
      await czekaj(cel ? 1000 : 2000);
    }
    if (ile > 0) sessionStorage.setItem(K_ZNANA, String(ile));
    // zapisz, których produktów z paczki Base nie wczytał (do raportu)
    if (!sessionStorage.getItem('am_' + LID + '_odrzucone') && await mostOk()) {
      try {
        const oczek = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null');
        const r = await bazaBase('idsProduktow', {}, 30000);
        if (oczek && oczek.ids && r.wynik && r.wynik.ids && r.wynik.ids.length) {
          const sa = new Set(r.wynik.ids.map(String));
          const odrz = oczek.ids.map(String).filter(id => !sa.has(id));
          sessionStorage.setItem('am_' + LID + '_odrzucone', JSON.stringify(odrz));
          if (odrz.length) powiadom('↷ Base odrzucił ' + odrz.length + ' produkt(y)', 'Wczytano ' + ile + ' z ' + oczek.ids.length + '\nID: ' + odrz.slice(0, 20).join(', ') + '\nLecę dalej.', { tagi: ['information_source'], priorytet: 3 });
        }
      } catch {}
    }
    status('wczytano ' + ile + ' produktów');
    await czekaj(znana ? 500 : 1500);
  }


  // ---- powrót do katalogu: jeśli katalog czeka w osobnej karcie – daj mu znać i zamknij tę kartę ----
  const L_KATALOG_CZEKA = 'autoKatalogCzeka';     // znacznik czasu ustawiany przez kartę katalogu
  const L_SYGNAL = 'autoSygnalNastepna';
  // pełny adres https strony mapowań parametrów Allegro (z zakodowanym „|”, żeby Base nie przekierował na http)
  const adresMapowan = kat => 'https://' + location.host + '/allegro_link_parameters.php?storage=' + encodeURIComponent('db|' + (kat || ''));
  // TRYB JEDNEJ KARTY: katalog → wystawianie → mapowania → katalog w tej samej karcie.
  // Domyślnie w Safari (Safari po zamknięciu karty przełącza na przypadkową kartę, a ukryty katalog zasypia).
  const L_JEDNA_KARTA = 'autoJednaKarta';
  const toSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg/.test(navigator.userAgent);
  const jednaKarta = () => { const v = lsGet(L_JEDNA_KARTA); return v === null || v === undefined || v === '' ? toSafari : v === '1'; };
  async function wrocDoKatalogu() {
    lsSet(L_ETAP, 'katalog');
    const czeka = parseInt(lsGet(L_KATALOG_CZEKA, '0')) || 0;
    if (jednaKarta()) {                                 // Safari: wszystko w tej jednej karcie
      lsDel(L_KATALOG_CZEKA);
      status('wracam do katalogu w tej karcie…');
      await czekaj(1500);
      location.href = '/inventory_products';
      return;
    }
    if (czeka && Date.now() - czeka < 6 * 3600000) {   // katalog czeka (max 6 h)
      lsSet(L_SYGNAL, String(Date.now()));
      status('daję znać karcie katalogu i zamykam tę kartę…');
      await czekaj(1500);
      window.close();
      await czekaj(1500);                               // jeśli przeglądarka nie pozwoliła zamknąć – przejdź normalnie
    }
    location.href = '/inventory_products';
  }

  // ---- CZASY KROKÓW: ile trwał każdy krok i wczytywanie strony (sumowane w paczce, zapisywane w pomiarze ⏱) ----
  function zapiszCzasKroku(nazwa, start, uwaga) {
    const ms = Math.max(0, Date.now() - start);
    const K = 'am_' + LID + '_czasy';
    let c = {};
    try { c = JSON.parse(sessionStorage.getItem(K) || '{}'); } catch {}
    c[nazwa] = (c[nazwa] || 0) + ms;
    sessionStorage.setItem(K, JSON.stringify(c));
    if (pomiar()) zapiszPomiar({ kroki: c });
    if (!nazwa.startsWith('⟳')) status('⏱ ' + nazwa + ': ' + Math.round(ms / 1000) + ' s' + (uwaga ? ' (' + uwaga + ')' : ''));
  }

  // ---- STRAŻNIK: jeśli przygotowanie paczki stoi (żaden krok nie ruszył) przez X min – odśwież i ponów krok ----
  const MINUTY_STOI_KROK = 15;      // tyle min bez zrobionego kroku = Base się zawiesił
  const MAX_ODSWIEZEN_STRAZNIKA = 2; // potem już nie odświeża, tylko alarm
  let straznikId = null;
  function straznikPostepu() {
    if (straznikId) return;
    const K_POST = 'am_' + LID + '_straznik';
    const postep = () => lista(K_DONE).length + lista(K_SKIP).length;
    const czytaj = () => { try { return JSON.parse(sessionStorage.getItem(K_POST) || 'null'); } catch { return null; } };
    let s = czytaj();
    if (!s || s.n !== postep()) s = { n: postep(), t: Date.now(), proby: (s && s.n === postep()) ? s.proby : 0 };
    sessionStorage.setItem(K_POST, JSON.stringify(s));
    straznikId = setInterval(() => {
      if (!pracuje) return;
      let st = czytaj() || { n: -1, t: Date.now(), proby: 0 };
      const n = postep();
      if (n !== st.n) { st = { n, t: Date.now(), proby: 0 }; sessionStorage.setItem(K_POST, JSON.stringify(st)); return; }
      const minut = (Date.now() - st.t) / 60000;
      if (minut < MINUTY_STOI_KROK) return;
      const krokNazwa = nastepny() ? nastepny().nazwa : '?';
      if (st.proby < MAX_ODSWIEZEN_STRAZNIKA) {
        st.proby++; st.t = Date.now();
        sessionStorage.setItem(K_POST, JSON.stringify(st));
        powiadom('🔄 Base się zawiesił – odświeżam', 'Krok „' + krokNazwa + '” stoi ' + Math.round(minut) + ' min.\nOdświeżam stronę i ponawiam (próba ' + st.proby + '/' + MAX_ODSWIEZEN_STRAZNIKA + ').', { priorytet: 4, tagi: ['arrows_counterclockwise'] });
        status('krok „' + krokNazwa + '” stoi ' + Math.round(minut) + ' min – odświeżam i ponawiam');
        setTimeout(() => location.reload(), 3000);
      } else {
        clearInterval(straznikId);
        powiadom('🛑 Skrypt stoi', 'Krok „' + krokNazwa + '” nie rusza mimo ' + MAX_ODSWIEZEN_STRAZNIKA + ' odświeżeń.\nZajrzyj do Chrome (może zrestartować przeglądarkę).', { priorytet: 5, tagi: ['rotating_light'], akcje: [['📊 Status', 'status']] });
        pokazAlarm('SKRYPT STOI', 'Krok „' + krokNazwa + '” nie rusza mimo ' + MAX_ODSWIEZEN_STRAZNIKA + ' odświeżeń. Odśwież sam albo zrestartuj Chrome.');
      }
    }, 30000);
  }

  async function krok() {
    pracuje = true;
    straznikPostepu();
    status('czekam na produkty…');
    await czekajNa(listaZaladowana, 90000);
    await czekajNaWszystkieProdukty();
    if (!window.__amWczytanieZapisane) { window.__amWczytanieZapisane = true;
    zapiszCzasKroku('⟳ wczytywanie strony', performance.timeOrigin || Date.now(), '');
    let c = {}; try { c = JSON.parse(sessionStorage.getItem('am_' + LID + '_czasy') || '{}'); } catch {}
      status('strona wczytana w ' + Math.round((Date.now() - (performance.timeOrigin || Date.now())) / 1000) + ' s (łącznie w tej paczce: ' + Math.round((c['⟳ wczytywanie strony'] || 0) / 60000) + ' min)'); }

    const doOdhaczenia = sessionStorage.getItem(K_ODHACZ);
    if (doOdhaczenia) {
      await odhacz(doOdhaczenia);
      sessionStorage.removeItem(K_ODHACZ);
      await czekaj(800);
    }

    while (true) {
      if (!dziala()) {
        pracuje = false;
        status('pauza – ' + (nastepny() ? 'następny: ' + nastepny().nazwa : 'wszystko zrobione'));
        return;
      }
      const k = nastepny();
      if (!k) break;
      const startKroku = Date.now();
      if (trwaOperacja()) await czekajNaOperacje();

      if (k.typ === 'akcja') {
        status(k.nazwa + '…');
        const w = await zrobAkcje(k);
        if (w !== 'ok') await pomin(k.nazwa, w); else await odhacz(k.nazwa);
        zapiszCzasKroku(k.nazwa, startKroku, w === 'ok' ? '' : 'pominięty');
        // nic nie zostało do wystawienia (wszystko niedopasowane) – zapisz w spisie i raporcie, weź następną paczkę
        if (w === 'ok' && k.wartosc === 'remove_mismatched' && sessionStorage.getItem('am_' + LID + '_poNiedop') === '0') {
          sessionStorage.removeItem(K_RUN);
          pracuje = false;
          // CAŁA paczka niedopasowana = problem systemowy (brak mapowania EAN, SKU bez nowych EAN-ów),
          // a nie złe produkty – NIE dopisuj do spisu (inaczej przepadną) i zatrzymaj wszystko
          const ilePrzed = parseInt(sessionStorage.getItem('am_' + LID + '_przedNiedop')) || 0;
          if (ilePrzed >= 20) {
            let idsCalej = []; try { idsCalej = JSON.parse(sessionStorage.getItem('am_' + LID + '_idsPrzed') || '[]'); } catch {}
            if (!idsCalej.length) { try { idsCalej = (JSON.parse(lsGet(L_OCZEKUJACA) || 'null') || {}).ids || []; } catch {} }
            sessionStorage.removeItem('am_' + LID + '_idsPrzed');
            // przeróbki: najczęściej zostało mapowanie EAN = SKU z poprzedniej paczki → usuń je i weź tę samą paczkę jeszcze raz (raz)
            if (PROCES.poWystawieniu === 'mapowania' && cyklWlaczony() && lsGet('autoNiedopProba') !== '1') {
              lsSet('autoNiedopProba', '1');
              lsDel(L_OCZEKUJACA);
              status('cała paczka niedopasowana – usuwam mapowanie EAN i biorę ją jeszcze raz');
              powiadom('↻ Cała paczka niedopasowana', 'Usuwam mapowanie EAN i biorę tę paczkę jeszcze raz (nie dopisuję do spisu).\n' + PROCES.nazwa, { tagi: ['repeat'] });
              lsSet(L_ETAP, 'mapowania');
              location.href = adresMapowan(lsGet(L_KATALOG));
              return;
            }
            lsDel('autoNiedopProba');
            // 🙈 „lecę mimo błędów”: nie zatrzymuj – dopisz tę paczkę do spisu i weź następną (z bezpiecznikiem na serię)
            if (ignorujBledy() && cyklWlaczony()) {
              const seria = (parseInt(lsGet('autoNiedopSeria', '0')) || 0) + 1;
              lsSet('autoNiedopSeria', String(seria));
              if (seria <= 20) {
                status('🙈 cała paczka niedopasowana (' + seria + '/20) – dopisuję do spisu i biorę następną');
                powiadom('🙈 Cała paczka niedopasowana – jadę dalej', ilePrzed + ' produktów bez dopasowania (' + seria + '/20) – dopisane do spisu, biorę następną paczkę.', { priorytet: 3, tagi: ['see_no_evil'] });
                await zapiszPoWystawieniu({ pusta: true });
                await czekaj(2000);
                if (PROCES.poWystawieniu === 'katalog') await wrocDoKatalogu();
                else { lsSet(L_ETAP, 'mapowania'); location.href = adresMapowan(lsGet(L_KATALOG)); }
                return;
              }
              lsDel('autoNiedopSeria');
              status('🛑 20 paczek z rzędu całych niedopasowanych – stop mimo trybu 🙈');
            }
            // FINALNE: cała paczka niedopasowana → spróbuj tę samą paczkę do 3 razy; za 3. razem stop + przycisk „dopisz do spisu i jedź dalej”
            if (PROCES.poWystawieniu === 'katalog' && idsCalej.length) {
              let st = null; try { st = JSON.parse(lsGet('autoNiedopFin') || 'null'); } catch {}
              const tenSam = st && Array.isArray(st.ids) && idsCalej.filter(id => st.ids.map(String).includes(String(id))).length >= 0.5 * idsCalej.length;
              const licz = tenSam ? (st.licz || 0) + 1 : 1;
              const oczekF = (() => { try { return JSON.parse(lsGet(L_OCZEKUJACA) || 'null') || {}; } catch { return {}; } })();
              lsSet('autoNiedopFin', JSON.stringify({ ids: idsCalej.map(String), licz, kat: oczekF.katId || lsGet(L_KATALOG, ''), konto: oczekF.konto || '', full: lsGet(L_FULL) === '1', t: Date.now() }));
              lsDel(L_OCZEKUJACA);
              if (licz < 3 && cyklWlaczony()) {
                status('cała paczka niedopasowana (' + licz + '/3) – biorę ją jeszcze raz');
                powiadom('↻ Cała paczka niedopasowana ' + licz + '/3', ilePrzed + ' produktów, 0 dopasowanych – próbuję tę samą paczkę jeszcze raz.\n' + PROCES.nazwa + (oczekF.konto ? ' · ' + oczekF.konto : ''), { tagi: ['repeat'] });
                await czekaj(2000);
                await wrocDoKatalogu();
                return;
              }
              lsDel(L_FULL); lsDel(L_CYKL); lsDel(L_ETAP); lsSet(L_AUTO, '0');
              const tekst = ilePrzed + ' produktów – ' + licz + ' razy z rzędu ŻADEN nie dopasowany' + (oczekF.konto ? ' (' + oczekF.konto + ')' : '') + '. Kliknij „Dopisz do spisu i jedź dalej”, żeby te produkty już nie wracały, albo popraw i uruchom ponownie.';
              status('🛑 cała paczka niedopasowana ' + licz + '× – czekam na decyzję');
              pokazAlarm('CAŁA PACZKA NIEDOPASOWANA ' + licz + '×', tekst);
              const al = document.getElementById('am-alarm');
              if (al) { const b = document.createElement('button'); b.textContent = '📋 Dopisz do spisu i jedź dalej'; b.style.cssText = 'margin:10px 0 0 8px;background:#2e7d32;color:#fff;border:0;border-radius:8px;padding:8px 16px;font:bold 14px sans-serif;cursor:pointer'; b.onclick = () => dopiszNiedopIJedz(true); al.appendChild(b); }
              powiadom('🛑 Cała paczka niedopasowana ' + licz + '×', tekst + '\n' + PROCES.nazwa, { priorytet: 5, tagi: ['rotating_light'], akcje: [['📋 Dopisz i jedź dalej', 'dopisz'], ['⏹ Zostaw', 'stop']] });
              pikaj(3);
              odswiezPrzyciski();
              return;
            }
            lsDel(L_FULL); lsDel(L_CYKL); lsDel(L_ETAP); lsSet(L_AUTO, '0');
            if (idsCalej.length) {                       // zapamiętaj paczkę, żeby dało się ją dopisać do spisu jednym kliknięciem
              const oczekP = (() => { try { return JSON.parse(lsGet(L_OCZEKUJACA) || 'null') || {}; } catch { return {}; } })();
              lsSet('autoNiedopFin', JSON.stringify({ ids: idsCalej.map(String), licz: 1, kat: oczekP.katId || lsGet(L_KATALOG, ''), konto: oczekP.konto || '', full: lsGet(L_FULL) === '1', t: Date.now() }));
            }
            const powod = 'Wszystkie ' + ilePrzed + ' produkty z paczki są NIEDOPASOWANE. Najczęściej: brak mapowania EAN (= SKU) dla tego katalogu albo w SKU nie ma jeszcze nowych EAN-ów z przerabiacza. Produkty NIE zostały dopisane do spisu.';
            status('🛑 zatrzymano – cała paczka niedopasowana');
            pokazAlarm('CAŁA PACZKA NIEDOPASOWANA', powod + ' Popraw i uruchom ponownie – albo kliknij „Dopisz do spisu i jedź dalej”.');
            if (idsCalej.length) { const al0 = document.getElementById('am-alarm'); if (al0) { const b0 = document.createElement('button'); b0.textContent = '📋 Dopisz do spisu i jedź dalej'; b0.style.cssText = 'margin:10px 0 0 8px;background:#2e7d32;color:#fff;border:0;border-radius:8px;padding:8px 16px;font:bold 14px sans-serif;cursor:pointer'; b0.onclick = () => dopiszNiedopIJedz(true); al0.appendChild(b0); } }
            powiadom('🛑 Cała paczka niedopasowana', powod + '\n' + PROCES.nazwa, { priorytet: 5, tagi: ['rotating_light'], akcje: [['📋 Dopisz i jedź dalej', 'dopisz'], ['⏹ Zostaw', 'stop']] });
            pikaj(3);
            odswiezPrzyciski();
            return;
          }
          await zapiszPoWystawieniu({ pusta: true });
          pikaj(1);
          if (cyklWlaczony()) {
            status('wszystkie niedopasowane – zapisane, biorę następną paczkę');
            await czekaj(2000);
            if (PROCES.poWystawieniu === 'katalog') await wrocDoKatalogu();
            else { lsSet(L_ETAP, 'mapowania'); location.href = adresMapowan(lsGet(L_KATALOG)); }
          } else {
            status('wszystkie produkty niedopasowane – nic do wystawienia (zapisane w spisie i raporcie)');
          }
          return;
        }
        continue;
      }

      // mapowanie "= SKU": najpierw szybko sprawdź w danych Base – jeśli parametru nie ma w żadnym produkcie
      // albo wszystkie już mają SKU, nie przewijaj 500 produktów i nie odświeżaj strony
      if (k.typ === 'mapuj' && k.regula === 5 && await mostOk()) {
        const r = await bazaBase('sprawdzSku', { nazwa: k.nazwa }, 60000);
        if (r.wynik && r.wynik.pola === 0) {
          status(k.nazwa + ': żaden produkt w paczce go nie ma – pomijam bez szukania');
          dodaj(K_DONE, k.nazwa); await odhacz(k.nazwa); zapiszCzasKroku(k.nazwa, startKroku, 'brak');
          continue;
        }
        if (r.wynik && r.wynik.zle === 0) {
          status(k.nazwa + ': wszystkie ' + r.wynik.pola + ' już mają SKU – pomijam mapowanie');
          dodaj(K_DONE, k.nazwa); await odhacz(k.nazwa); zapiszCzasKroku(k.nazwa, startKroku, 'już');
          continue;
        }
        // ⚡ szybkie mapowanie: SKU wpisane prosto w dane, bez okna i bez odświeżania
        if (lsGet('autoSzybkieMapowanie') === '1') {
          status('wstawiam SKU w ' + k.nazwa + ' (szybko, ' + ((r.wynik && r.wynik.pola) || '?') + ' produktów)…');
          const s = await bazaBase('ustawSku', { nazwa: k.nazwa }, 180000);
          if (s.wynik && s.wynik.zle === 0) {
            status(k.nazwa + ' = SKU ✔ (' + s.wynik.pola + ' produktów, zmienione ' + s.wynik.zmienione + ')');
            dodaj(K_DONE, k.nazwa); await odhacz(k.nazwa); zapiszCzasKroku(k.nazwa, startKroku, 'szybko');
            continue;
          }
          status(k.nazwa + ': szybkie nie wyszło (' + (s.blad || (s.wynik ? 'zostało ' + s.wynik.zle : 'brak odpowiedzi')) + ') – robię przez okno mapowania');
        }
      }

      // kroki robione przez dane Base nie potrzebują szukania pola na stronie
      const przezDane = ['wybor', 'wyczysc', 'idprod', 'sku', 'cennik'].includes(k.typ) && (k.typ !== 'wyczysc' || k.regula === 5) && await mostOk();
      let pole = null;
      if (!przezDane) {
        pole = await szukajZeScrollem(k.nazwa);
        if (pole === 'pauza') continue;
        if (!pole) { await pomin(k.nazwa, 'pomijam (brak pola)'); zapiszCzasKroku(k.nazwa, startKroku, 'brak pola'); continue; }
      }

      let w;
      if (k.typ === 'mapuj') {
        w = await mapuj(k.nazwa, k.regula, pole);
        if (w === 'ok' && k.odswiez) {
          dodaj(K_DONE, k.nazwa);
          sessionStorage.setItem(K_ODHACZ, k.nazwa);
          await czekajNaOperacje();
          zapiszCzasKroku(k.nazwa, startKroku, '');
          status('odświeżam…');
          location.reload();
          return;
        }
      } else if (k.typ === 'wybor') {
        status('ustawiam ' + k.nazwa + ' = ' + k.wartosc);
        w = await zrobWybor(k, pole);
      } else if (k.typ === 'wyczysc') {
        status('czyszczę ' + k.nazwa);
        w = await zrobWyczysc(k, pole);
      } else if (k.typ === 'idprod') {
        status('usuwam -1 z ' + k.nazwa);
        w = await zrobIdProd(k, pole);
      } else if (k.typ === 'sku') {
        w = await zrobSku(k, pole);
      } else if (k.typ === 'cennik') {
        status('ustawiam cennik wysyłki…');
        w = await zrobCennik(k, pole);
      }
      if (w === 'żaden produkt nie ma tego parametru') {      // nic do ustawienia – idziemy dalej
        status(k.nazwa + ': żaden produkt w paczce go nie ma – pomijam bez zatrzymywania');
        powiadom('ℹ️ Brak parametru: ' + k.nazwa, 'Żaden produkt w tej paczce nie ma parametru „' + k.nazwa + '”. Skrypt idzie dalej.', { priorytet: 2, tagi: ['information_source'] });
        dodaj(K_DONE, k.nazwa);
        await odhacz(k.nazwa);
        zapiszCzasKroku(k.nazwa, startKroku, 'brak');
        continue;
      }
      if (w !== 'ok' && jestObowiazkowy(k.nazwa)) {          // obowiązkowy – nie pomijaj, przerwij i spróbuj jeszcze raz
        const kl = 'am_' + LID + '_proba_' + k.nazwa;
        const n = (parseInt(sessionStorage.getItem(kl)) || 0) + 1;
        sessionStorage.setItem(kl, String(n));
        if (n < PROBY_OBOWIAZKOWYCH) {
          status('⚠️ ' + k.nazwa + ': ' + w + ' – to obowiązkowe, próbuję jeszcze raz (' + (n + 1) + '/' + PROBY_OBOWIAZKOWYCH + ')');
          if (modalOtwarty()) { modal().querySelector('button.btn-default')?.click(); await czekaj(1000); }
          await czekaj(3000);
          continue;
        }
      }
      if (w !== 'ok') { await pomin(k.nazwa, w); zapiszCzasKroku(k.nazwa, startKroku, 'pominięty'); continue; }
      dodaj(K_DONE, k.nazwa);
      await odhacz(k.nazwa);
      zapiszCzasKroku(k.nazwa, startKroku, '');
    }

    if (modalOtwarty()) { modal().querySelector('button.btn-default')?.click(); await czekaj(1000); }
    sessionStorage.removeItem(K_RUN);
    pracuje = false;
    // przeładuj raz, żeby na ekranie było widać to, co naprawdę jest zapisane
    sessionStorage.setItem('am_' + LID + '_final', '1');
    await czekajNaOperacje();
    status('wszystko zrobione – odświeżam, żeby pokazać wynik…');
    await czekaj(1500);
    location.reload();
  }

  // po zakończeniu wysyłania: raport + spis, potem następny etap cyklu
  async function dalejPoWystawieniu() {
    await zapiszPoWystawieniu();
    zamknijPomiar();
    if (cyklWlaczony() && PROCES.poWystawieniu === 'katalog') {
      status('wystawione – biorę kolejną paczkę');
      await czekaj(1500);
      await wrocDoKatalogu();
    } else if (cyklWlaczony()) {
      const kat = lsGet(L_KATALOG);
      lsSet(L_ETAP, 'mapowania');
      status('wystawione – przechodzę do mapowań');
      await czekaj(1500);
      location.href = adresMapowan(kat);
    } else {
      status('wystawione ✔');
      pikaj(2);
    }
  }

  // strona przeładowała się w środku (strażnik, Safari „za dużo pamięci”, zawieszenie) – kroki zrobione, a bot by stał
  async function wznowPoOdswiezeniu() {
    const K_W = 'am_' + LID + '_wznow';
    const n = (parseInt(sessionStorage.getItem(K_W)) || 0) + 1;
    sessionStorage.setItem(K_W, String(n));
    if (n > 4) {
      status('stoi – ' + (n - 1) + ' wznowień po odświeżeniu nie pomogło');
      powiadom('🛑 AutoMap stoi po odświeżeniu', 'Kroki zrobione, ale ' + (n - 1) + ' prób wznowienia nie pomogło. Zajrzyj do przeglądarki.\n' + PROCES.nazwa, { priorytet: 5, tagi: ['rotating_light'] });
      return;
    }
    status('🔁 strona się przeładowała – wznawiam (próba ' + n + ')…');
    await czekajNa(listaZaladowana, 90000);
    await czekaj(2000);
    let oczek = null;
    try { oczek = JSON.parse(localStorage.getItem(L_OCZEKUJACA) || 'null'); } catch {}
    if (oczek && oczek.wystawiono && await mostOk()) {      // WYSTAW był już kliknięty – może wysyłanie zdążyło się skończyć
      const r = await bazaBase('liczniki', {}, 20000);
      const w = r.wynik;
      if (w && Number(w.total) > 0 && (Number(w.sent) || 0) + (Number(w.error) || 0) >= Number(w.total)) {
        status('wysyłanie skończyło się przed odświeżeniem – zapisuję raport i lecę dalej');
        await dalejPoWystawieniu();
        return;
      }
    }
    // pokaż GOTOWE (Full auto samo kliknie WYSTAW – Base wyśle tylko to, co jeszcze nie poszło)
    sessionStorage.setItem('am_' + LID + '_final', '1');
    pokazPoFinalnymOdswiezeniu();
  }

  async function pokazPoFinalnymOdswiezeniu() {
    status('ładuję wynik…');
    await czekajNa(listaZaladowana, 90000);
    sessionStorage.removeItem('am_' + LID + '_final');   // dopiero po wczytaniu – jak strona padnie wcześniej, po odświeżeniu spróbuje znowu
    await czekaj(2000);
    window.scrollTo(0, 0);
    if (await kontrolaObowiazkowych() === 'powtarzam') return;
    status('GOTOWE DO WYSTAWIENIA ✔');
    pokazGotowe();
  }

  // ---- OBOWIĄZKOWE PARAMETRY: sprawdź w danych Base; źle → popraw i powtórz kroki; po PROBY_OBOWIAZKOWYCH – blokada FULL AUTO ----
  async function kontrolaObowiazkowych() {
    const reguly = OBOWIAZKOWE[procesKlucz()] || [];
    if (!reguly.length) return 'ok';
    const K = 'am_' + LID + '_probaObow';
    const zablokuj = opis => {
      sessionStorage.setItem('am_' + LID + '_krytyczne', 'Obowiązkowe parametry: ' + opis);
      powiadom('🛑 Obowiązkowe parametry niekompletne', opis + '\n' + PROCES.nazwa + ' – NIE wystawiam sam. Popraw i kliknij WYSTAW.', { priorytet: 5, tagi: ['rotating_light'] });
      return 'ok';
    };
    // parametry „mapowanie”: OK, jeśli krok mapowania się udał (nie patrzymy na wartość w oknie)
    const mapReguly = reguly.filter(x => x.regula === 'mapowanie');
    const daneReguly = reguly.filter(x => x.regula !== 'mapowanie');
    const brakiMap = mapReguly.filter(x => !lista(K_DONE).includes(x.krok) || lista(K_SKIP).includes(x.krok))
      .map(x => ({ nazwa: x.nazwa, pola: 0, zle: 1, bezSku: 0, mapowanie: true }));
    let wyniki = [], n = 0;
    if (daneReguly.length) {
      if (!await mostOk()) return zablokuj('brak dostępu do danych Base – nie da się sprawdzić');
      status('sprawdzam obowiązkowe parametry…');
      const r = await bazaBase('sprawdzObowiazkowe', { reguly: daneReguly }, 120000);
      if (r.blad || !r.wynik) return zablokuj('nie udało się sprawdzić (' + (r.blad || 'brak odpowiedzi') + ')');
      wyniki = r.wynik.wynik; n = r.wynik.n;
    }
    const braki = wyniki.filter(w => w.zle > 0 || (w.pola === 0 && n > 0 && w.nazwa === 'Stan')).concat(brakiMap);
    if (!braki.length) {
      sessionStorage.removeItem(K);
      status('obowiązkowe ✔ ' + wyniki.map(w => w.nazwa + ' ' + (w.pola - w.zle) + '/' + w.pola).concat(mapReguly.map(x => x.nazwa.split(' ')[0] + ' zmapowana')).join(' · '));
      await czekaj(1500);
      return 'ok';
    }
    const opis = braki.map(b => b.nazwa + ': ' + (b.mapowanie ? 'mapowanie się nie udało' : b.pola ? b.zle + ' z ' + b.pola + ' źle' : 'brak pola') + (b.bezSku ? ' (bez SKU: ' + b.bezSku + ')' : '')).join('; ');
    console.log('[AutoMap] obowiązkowe – braki:', braki);
    const proba = (parseInt(sessionStorage.getItem(K)) || 0) + 1;
    sessionStorage.setItem(K, String(proba));
    if (proba > PROBY_OBOWIAZKOWYCH) {
      status('🛑 obowiązkowe dalej niekompletne po ' + PROBY_OBOWIAZKOWYCH + ' próbach: ' + opis);
      return zablokuj(opis + ' (po ' + PROBY_OBOWIAZKOWYCH + ' próbach)');
    }
    status('⚠️ obowiązkowe niekompletne (' + opis + ') – poprawiam, próba ' + proba + '/' + PROBY_OBOWIAZKOWYCH);
    powiadom('↻ Obowiązkowe – poprawiam', opis + '\nPróba ' + proba + '/' + PROBY_OBOWIAZKOWYCH + ' · ' + PROCES.nazwa, { priorytet: 3, tagi: ['repeat'] });
    // 1) szybka poprawka w danych (SKU / wartość z listy)
    for (const b of braki) {
      const reg = reguly.find(x => x.nazwa === b.nazwa);
      if (reg.regula === 'sku') await bazaBase('ustawSku', { nazwa: reg.nazwa }, 180000);
      else if (reg.regula === 'opcja') await bazaBase('ustawListe', { nazwa: reg.nazwa, tekst: reg.wartosc }, 120000);
    }
    // 2) powtórz kroki tych parametrów (np. waga – mapowanie z mnożnikiem przez okno Base)
    const doPowtorki = braki.map(b => (reguly.find(x => x.nazwa === b.nazwa) || {}).krok).filter(Boolean);
    sessionStorage.setItem(K_DONE, JSON.stringify(lista(K_DONE).filter(n => !doPowtorki.includes(n))));
    sessionStorage.setItem(K_SKIP, JSON.stringify(lista(K_SKIP).filter(n => !doPowtorki.includes(n))));
    doPowtorki.forEach(n => sessionStorage.removeItem('am_' + LID + '_proba_' + n));
    for (const n of doPowtorki) { const b = pozycja(n); if (b && b.checked) b.click(); }
    sessionStorage.setItem(K_RUN, '1');
    await czekaj(1500);
    krok();
    return 'powtarzam';
  }

  function startWystawiania() {
    if (sessionStorage.getItem('am_' + LID + '_ponowWystaw') === '1') { ponowWystawPoOdswiezeniu(); return; }
    if (sessionStorage.getItem('am_' + LID + '_final') === '1') { pokazPoFinalnymOdswiezeniu(); return; }
    const widziane = lsJson(L_WIDZIANE);
    const nowe = !widziane.includes(LID);
    const zCyklu = lsGet(L_ETAP) === 'lista';

    if (zCyklu || (nowe && lsGet(L_AUTO) === '1')) {
      if (zCyklu) lsSet(L_ETAP, 'wystawianie');
      widziane.push(LID);
      lsSet(L_WIDZIANE, JSON.stringify(widziane.slice(-200)));
      sessionStorage.setItem(K_RUN, '1');
    }
    if (dziala() || sessionStorage.getItem(K_ODHACZ)) krok();
    else if (cyklWlaczony() && lsGet(L_ETAP) === 'wystawianie' && !nastepny() && lsGet(L_OCZEKUJACA) && widziane.includes(LID)) wznowPoOdswiezeniu();
    else status('stoi – ' + (nastepny() ? 'następny: ' + nastepny().nazwa : 'czeka'));
  }

  // =========================================================
  // ==================== STRONA MAPOWAŃ =====================
  // =========================================================
  async function stronaMapowan() {
    { let z = null; try { z = JSON.parse(lsGet('autoZadanieEanSku') || 'null'); } catch {}
      if (z && Date.now() - z.t < 30 * 60000 && decodeURIComponent(location.search).includes('db|' + z.kat)) return mapowanieEanSku(z); }
    const etap = lsGet(L_ETAP);
    if (!cyklWlaczony() || (etap !== 'mapowania' && etap !== 'mapowania2')) { status('stoi'); return; }

    // Cloudflare „czy jesteś człowiekiem” – nic nie rób; po przejściu strona przeładuje się sama i ruszymy dalej
    const cloudflare = () => /just a moment|chwileczk|attention required|jeszcze chwil/i.test(document.title) ||
      !!document.querySelector('#challenge-form, #challenge-stage, #challenge-running, #cf-challenge-running, .cf-turnstile, iframe[src*="challenges.cloudflare.com"]') ||
      !!window._cf_chl_opt;
    if (cloudflare()) { status('🛡 Cloudflare – potwierdź, że jesteś człowiekiem, potem lecę dalej sam'); return; }

    // nieudana próba → odśwież i spróbuj jeszcze raz. Licznik POD RZĄD – po udanym usunięciu od zera.
    // Etap zostaje „mapowania2”, więc po odświeżeniu skrypt wie, co robił.
    const L_PROBY = 'autoMapowaniaProby';
    const MAX_PROB = 6;
    const ponow = async powod => {
      if (cloudflare()) return;
      const n = (parseInt(lsGet(L_PROBY, '0')) || 0) + 1;
      if (n > MAX_PROB) {
        lsDel(L_PROBY);
        lsDel(L_FULL); lsDel(L_CYKL); lsDel(L_ETAP); lsSet(L_AUTO, '0');
        const opis = powod + ' – ' + MAX_PROB + ' odświeżeń pod rząd nie pomogło. Nie biorę kolejnej paczki, żeby nie wyszła cała niedopasowana.';
        status('🛑 ' + opis);
        pokazAlarm('MAPOWANIE EAN NIE USUNIĘTE', opis + ' Usuń je ręcznie i włącz cykl ponownie.');
        powiadom('🛑 Mapowanie EAN nie usunięte', opis, { priorytet: 5, tagi: ['rotating_light'] });
        pikaj(3);
        return;
      }
      lsSet(L_PROBY, String(n));
      lsSet(L_ETAP, 'mapowania2');
      status('⚠️ ' + powod + ' – odświeżam i próbuję jeszcze raz (' + n + '/' + MAX_PROB + ')');
      if (n >= 2) powiadom('🔄 Mapowanie EAN – ponawiam', powod + '\nOdświeżam (próba ' + n + '/' + MAX_PROB + ' pod rząd).', { priorytet: 3, tagi: ['arrows_counterclockwise'] });
      await czekaj(3000);
      location.reload();
    };

    if (etap === 'mapowania') {               // najpierw odśwież (nowa paczka – licznik prób od zera)
      lsDel(L_PROBY);
      lsSet(L_ETAP, 'mapowania2');
      status('odświeżam mapowania…');
      await czekaj(1500);
      location.reload();
      return;
    }

    // pewność, że to parametry PRZERABIANEGO katalogu (przy kolejce katalogów)
    { const kat = lsGet(L_KATALOG);
      if (kat && !decodeURIComponent(location.search).includes('db|' + kat)) { status('to nie ten katalog – przechodzę do parametrów katalogu ' + kat); location.href = adresMapowan(kat); return; }
      status('szukam mapowania EAN w katalogu ' + kat + '…'); }

    // strona wczytana = są wiersze mapowań albo przycisk „Dodaj parametr”; nie wczytała się → odśwież
    const wczytana = () => !!document.querySelector('tr.paramMappingRow') ||
      [...document.querySelectorAll('button')].some(b => /Dodaj parametr/.test(b.textContent) && b.offsetParent);
    if (!await czekajNa(wczytana, 60000)) return ponow('strona parametrów się nie wczytała');
    await czekajNa(() => document.querySelector('tr.paramMappingRow'), 15000);   // wiersze dochodzą chwilę po przycisku
    await czekaj(2000);

    // nazwa parametru w wierszu (Allegro bywa „EAN”, „EAN (GTIN)”, „GTIN” – łapiemy każdą z nich)
    const nazwaParam = r => (r.querySelector('td[id^="cellServiceParam_"] a') || r.querySelector('td[id^="cellServiceParam_"]'))?.textContent.replace(/\s+/g, ' ').trim() || '';
    const toEAN = n => /^(EAN|GTIN)(\s*\((GTIN|EAN)\))?$/i.test(n);
    const wierszEAN = () => [...document.querySelectorAll('tr.paramMappingRow')].find(r => toEAN(nazwaParam(r)));
    const nazwy = [...document.querySelectorAll('tr.paramMappingRow')].map(nazwaParam);
    lsSet('autoOstatnieMapowania', JSON.stringify({ t: Date.now(), kat: lsGet(L_KATALOG), nazwy }));
    console.log('[AutoMap] mapowania na stronie:', nazwy);

    // usuń (do 3 prób na tej stronie) – jak dalej jest, odśwież i od nowa
    for (let proba = 1; proba <= 3 && wierszEAN(); proba++) {
      const r = wierszEAN();
      status('usuwam mapowanie „' + nazwaParam(r) + '” (próba ' + proba + ')…');
      r.scrollIntoView({ block: 'center' });
      await czekaj(500);
      r.querySelector('td.del a')?.click();
      const ok = await czekajNa(() => {
        const b = document.querySelector('#delete_modal button[data-tid="deleteRow"]');
        return b && b.offsetParent ? b : null;
      }, 6000);
      if (ok) { await czekaj(500); ok.click(); }
      await czekajNa(() => !wierszEAN(), 10000);
      await czekaj(1000);
    }
    if (wierszEAN()) return ponow('nie udało się usunąć mapowania „' + nazwaParam(wierszEAN()) + '”');
    lsDel(L_PROBY);

    if (!nazwy.some(toEAN)) {
      status('brak mapowania EAN na tej stronie (mapowania: ' + (nazwy.join(', ') || 'żadnych') + ')');
      powiadom('ℹ️ Brak mapowania EAN do usunięcia', 'Strona mapowań katalogu ' + (lsGet(L_KATALOG) || '?') + ' nie ma wiersza EAN.\nWiersze: ' + (nazwy.join(', ') || 'żadnych') + '\nJeśli następna paczka wyjdzie niedopasowana – wyślij to Claude.', { priorytet: 3, tagi: ['information_source'] });
    } else {
      status('usunięto mapowanie EAN ✔');
    }
    await czekaj(2000);
    await wrocDoKatalogu();
  }

  // =========================================================
  // =================== KATALOG PRODUKTÓW ===================
  // =========================================================
  const wierszeProduktow = () => [...document.querySelectorAll('tr.product_row')].filter(r => r.id.startsWith('row_'));
  const idZWiersza = r => r.id.replace('row_', '');


  // ---- KONIEC: fajerwerki + podsumowanie sesji ----
  function pokazZakonczone() {
    let sesja = null;
    try { sesja = JSON.parse(localStorage.getItem(L_SESJA) || 'null'); } catch {}
    const wszystkie = lsJson(L_RAPORT);
    const wpisy = sesja ? wszystkie.filter(w => (w.nr || 0) > sesja.odNr) : wszystkie;
    const suma = k => wpisy.reduce((a, w) => a + (Number(w[k]) || 0), 0);
    const wziete = wpisy.reduce((a, w) => a + (Number(w.probowano ?? w.wszystkie) || 0), 0);
    const ms = sesja ? Date.now() - sesja.start : 0;
    const czas = ms ? (Math.floor(ms / 3600000) + ' h ' + Math.floor(ms % 3600000 / 60000) + ' min') : '?';
    const naGodz = ms ? Math.round(wziete / (ms / 3600000)) : 0;
    lsDel(L_SESJA);
    lsDel(L_ETAP);

    powiadom('🎆 ZAKOŃCZONE – ' + PROCES.nazwa,
      'Czas: ' + czas + ' · paczek: ' + wpisy.length +
      '\nWzięto: ' + wziete + ' · niedopasowane: ' + suma('niedopasowane') +
      '\nWystawione: ' + suma('dobre') + ' · błędne: ' + suma('bledne') +
      (naGodz ? '\nTempo: ' + naGodz + ' produktów/h' : ''),
      { priorytet: 4, tagi: ['tada', 'fireworks'], akcje: [['📊 Status', 'status']] });

    // fajerwerki
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;z-index:99999998;pointer-events:none';
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const czastki = [];
    const kolory = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ffffff', '#ff6e40'];
    const wybuch = () => {
      const x = innerWidth * (0.15 + Math.random() * 0.7), y = innerHeight * (0.12 + Math.random() * 0.4);
      const kol = kolory[Math.floor(Math.random() * kolory.length)];
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
        czastki.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, zycie: 70 + Math.random() * 40, kol });
      }
    };
    let klatka = 0;
    const anim = () => {
      klatka++;
      if (klatka < 600 && klatka % 18 === 0) wybuch();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = czastki.length - 1; i >= 0; i--) {
        const c = czastki[i];
        c.x += c.vx; c.y += c.vy; c.vy += 0.05; c.vx *= 0.99; c.zycie--;
        ctx.globalAlpha = Math.max(0, c.zycie / 100);
        ctx.fillStyle = c.kol;
        ctx.beginPath(); ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2); ctx.fill();
        if (c.zycie <= 0) czastki.splice(i, 1);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (klatka < 720 || czastki.length) requestAnimationFrame(anim); else cv.remove();
    };
    wybuch(); anim();
    (async () => { for (let i = 0; i < 3; i++) { await pikaj(3); await czekaj(700); } })();

    // okno podsumowania
    const o = document.createElement('div');
    o.id = 'am-koniec';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999997;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    const kafel = (t, v, kol) => '<div style="background:#263445;padding:10px 14px;border-radius:10px;min-width:130px"><div style="font-size:12px;opacity:.75">' + t + '</div><div style="font-size:24px;font-weight:bold;color:' + (kol || '#fff') + '">' + v + '</div></div>';
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:30px 36px;border-radius:18px;text-align:center;font-family:sans-serif;max-width:720px;box-shadow:0 10px 50px rgba(0,0,0,.7)">
      <div style="font-size:54px;line-height:1">🎆</div>
      <div style="font-size:34px;font-weight:bold;margin:10px 0 4px">ZAKOŃCZONE</div>
      <div style="font-size:14px;opacity:.8;margin-bottom:16px">${PROCES.nazwa} · cały katalog w filtrze przerobiony</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
        ${kafel('Czas', czas)}${kafel('Paczek', wpisy.length)}${kafel('Wzięto', wziete)}
        ${kafel('Niedopasowane', suma('niedopasowane'), '#ffb74d')}${kafel('Wystawione', suma('dobre'), '#81c784')}${kafel('Błędne', suma('bledne'), '#e57373')}
        ${kafel('Skuteczność', wziete ? Math.round(suma('dobre') / wziete * 100) + '%' : '–')}${kafel('Tempo', naGodz ? naGodz + '/h' : '–')}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
        ${procesKlucz() === 'przerobki' ? '<a href="https://salescenter.allegro.com/my-assortment" target="_blank" style="background:#ff5a00;color:#fff;border-radius:10px;padding:12px 16px;font:bold 15px sans-serif;text-decoration:none">🔎 Allegro: oferty sprawdzane</a><button id="am-koniec-przer" style="background:#c62828;color:#fff;border:0;border-radius:10px;padding:12px 16px;font:bold 15px sans-serif;cursor:pointer">🏁 Zakończ oferty + zdjęcia</button><button id="am-koniec-zdjecia" style="background:#1565c0;color:#fff;border:0;border-radius:10px;padding:12px 16px;font:bold 15px sans-serif;cursor:pointer">📸 Tylko zdjęcia</button>' : ''}
        <button id="am-koniec-raport" style="background:#2e7d32;color:#fff;border:0;border-radius:10px;padding:12px 20px;font:bold 15px sans-serif;cursor:pointer">📊 Pełny raport</button>
        <button id="am-koniec-ok" style="background:#555;color:#fff;border:0;border-radius:10px;padding:12px 20px;font:bold 15px sans-serif;cursor:pointer">Zamknij</button>
      </div></div>`;
    document.body.appendChild(o);
    o.querySelector('#am-koniec-ok').onclick = () => o.remove();
    o.querySelector('#am-koniec-raport').onclick = () => { o.remove(); pokazRaport(); };
    const bZdj = o.querySelector('#am-koniec-zdjecia');
    if (bZdj) bZdj.onclick = () => zdjeciaFinalne();
    const bPrz = o.querySelector('#am-koniec-przer');
    if (bPrz) bPrz.onclick = () => {
      let k = null; try { k = JSON.parse(lsGet('autoOstatnieKonto') || 'null'); } catch {}
      if (!k) { alert('Nie wiem, które konto było przerabiane.'); return; }
      if (!confirm('Sprawdziłeś na Allegro, że „oferty sprawdzane” = 0 dla konta ' + k.nazwa + '?\n\nSkrypt ZAKOŃCZY WSZYSTKIE trwające oferty tego konta w Base, a potem ustawi zdjęcia na finalne.')) return;
      koniecPrzerobek();
    };
    if (procesKlucz() === 'przerobki') {
      let k = null; try { k = JSON.parse(lsGet('autoOstatnieKonto') || 'null'); } catch {}
      powiadom('🏁 Przeróbki skończone' + (k ? ' – ' + k.nazwa : ''), 'Sprawdź na Allegro „oferty sprawdzane” dla tego konta.\nGdy będzie 0 – kliknij „Kończ oferty”: skrypt zakończy wszystkie trwające oferty konta ' + (k ? k.nazwa : '') + ' i ustawi zdjęcia na finalne.', { priorytet: 4, tagi: ['checkered_flag'], akcje: [['🏁 Kończ oferty', 'koniecprzer'], ['📊 Status', 'status']] });
    }
    status('🎆 ZAKOŃCZONE – ' + suma('dobre') + ' wystawionych w ' + czas);
  }

  // ---- KONIEC PRZERÓBEK: w integracji konta Allegro zdjęcia na finalne (kolejność z magazynu, wszystkie zdjęcia) ----
  const ZDJECIA_FINALNE = { gallery_images_sort: 'Kolejność zdjęć zgodna z magazynem', gallery_images_use: 'Wstaw wszystkie dostępne zdjęcia z magazynu' };
  function zdjeciaFinalne() {
    let k = null; try { k = JSON.parse(lsGet('autoOstatnieKonto') || 'null'); } catch {}
    if (!k || !k.id) { alert('Nie wiem, które konto Allegro było przerabiane (brak zapisanego konta).'); return; }
    lsSet('autoZadanieIntegracja', JSON.stringify({ konto: k.id, nazwa: k.nazwa, pola: ZDJECIA_FINALNE, t: Date.now() }));
    location.href = '/list_integrations.php';
  }
  // ---- KONIEC PRZERÓBEK cz. 1: zakończ WSZYSTKIE trwające oferty konta (Base → Zarządzanie ofertami) ----
  function koniecPrzerobek() {
    let k = null; try { k = JSON.parse(lsGet('autoOstatnieKonto') || 'null'); } catch {}
    if (!k || !k.id) { status('STOP: nie wiem, które konto było przerabiane'); return; }
    lsSet('autoZadanieKoniec', JSON.stringify({ konto: String(k.id), nazwa: k.nazwa, t: Date.now() }));
    location.href = '/allegro_auctions.php?status_id=1';
  }
  async function stronaOfert() {
    let z = null; try { z = JSON.parse(lsGet('autoZadanieKoniec') || 'null'); } catch {}
    if (!z || Date.now() - z.t > 15 * 60000) { lsDel('autoZadanieKoniec'); status('stoi'); return; }
    const sel = await czekajNa(() => document.getElementById('account_id_select'), 30000);
    if (!sel) { lsDel('autoZadanieKoniec'); status('STOP: nie widzę wyboru konta'); pikaj(3); return; }
    if (!z.konto) {                                        // podana tylko nazwa konta (np. z bota) – znajdź jego id
      const o = [...sel.options].find(o => norm(o.textContent) === norm(z.nazwa));
      if (!o) { lsDel('autoZadanieKoniec'); status('STOP: w Base nie ma konta Allegro „' + z.nazwa + '”'); pikaj(3); return; }
      z.konto = o.value; lsSet('autoZadanieKoniec', JSON.stringify(z));
    }
    // 1) właściwe konto (zmiana konta przeładowuje listę / stronę)
    if (sel.value !== z.konto) {
      if (z.przelaczono) { lsDel('autoZadanieKoniec'); status('STOP: nie udało się przełączyć na konto ' + z.nazwa); pikaj(3); return; }
      z.przelaczono = true; lsSet('autoZadanieKoniec', JSON.stringify(z));
      status('przełączam na konto ' + z.nazwa + '…');
      wstawDoStrony('(() => { const s = document.getElementById("account_id_select"); s.value = ' + JSON.stringify(z.konto) + '; if (typeof handleSelectedAccountChanged === "function") handleSelectedAccountChanged(s); else s.dispatchEvent(new Event("change", { bubbles: true })); })();');
      await czekaj(8000);
      if (document.getElementById('account_id_select')?.value !== z.konto) return;   // strona się przeładowuje – ruszy od nowa
    }
    lsDel('autoZadanieKoniec');                            // dalej tylko raz – bez powtórek po odświeżeniu
    // 2) ile trwających
    const btnZazn = await czekajNa(() => document.getElementById('table_offers_containerDropdownCheck'), 30000);
    await czekaj(3000);
    const m = (btnZazn?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
    const ile = m ? parseInt(m[2]) : 0;
    if (!ile) {
      status('konto ' + z.nazwa + ': brak trwających ofert – przechodzę do zdjęć');
      lsSet('autoZadanieIntegracja', JSON.stringify({ konto: z.konto, nazwa: z.nazwa, pola: ZDJECIA_FINALNE, t: Date.now() }));
      await czekaj(1500); location.href = '/list_integrations.php'; return;
    }
    const wybrane = document.getElementById('account_id_select').selectedOptions[0]?.textContent.trim();
    if (norm(wybrane) !== norm(z.nazwa)) { status('STOP: wybrane konto „' + wybrane + '” ≠ „' + z.nazwa + '” – nic nie kończę'); pikaj(3); return; }
    status('kończę ' + ile + ' trwających ofert konta ' + z.nazwa + '…');
    const klik = async (el, opis) => { if (!el) throw new Error('brak: ' + opis); el.click(); await czekaj(1200); };
    const widoczny = (sel, re) => [...document.querySelectorAll(sel)].find(e => e.offsetParent && re.test((e.textContent || e.value || '').trim()));
    try {
      await klik(btnZazn, 'Zaznacz');
      await klik(widoczny('a, button, li', /^Zaznacz wszystkie$/), 'Zaznacz wszystkie');
      const potw = widoczny('button', /^Potwierdź$/);
      if (potw) await klik(potw, 'Potwierdź');
      const zazn = (document.getElementById('table_offers_containerDropdownCheck')?.textContent.match(/(\d+)\s*\/\s*(\d+)/) || []);
      if (zazn[1] && parseInt(zazn[1]) !== ile) throw new Error('zaznaczono ' + zazn[1] + ' z ' + ile);
      await klik(widoczny('button', /^Operacje$/), 'Operacje');
      await klik(widoczny('a', /^Zakończ$/), 'Zakończ');
      const wyk = await czekajNa(() => { const b = document.getElementById('button_execute'); return b && b.offsetParent ? b : null; }, 15000);
      await klik(wyk, 'Wykonaj');
    } catch (e) {
      status('STOP przy kończeniu ofert: ' + e.message); pikaj(3);
      powiadom('⚠️ Kończenie ofert – stop', z.nazwa + ': ' + e.message + '. Dokończ ręcznie.', { priorytet: 5, tagi: ['warning'] });
      return;
    }
    await czekaj(4000);
    const przebieg = (document.body.innerText.match(/Oczekuje w kolejce\s*(\d+)/) || [])[1];
    status('✔ zlecono zakończenie ' + ile + ' ofert (' + z.nazwa + ')' + (przebieg ? ', w kolejce ' + przebieg : '') + ' – teraz zdjęcia');
    powiadom('🏁 Kończenie ofert zlecone', z.nazwa + ': ' + ile + ' ofert idzie do zakończenia (Base robi to w tle).\nTeraz ustawiam zdjęcia na finalne.', { tagi: ['checkered_flag'] });
    lsSet('autoZadanieIntegracja', JSON.stringify({ konto: z.konto, nazwa: z.nazwa, pola: ZDJECIA_FINALNE, t: Date.now() }));
    await czekaj(3000);
    location.href = '/list_integrations.php';
  }

  async function stronaIntegracji() {
    let z = null; try { z = JSON.parse(lsGet('autoZadanieIntegracja') || 'null'); } catch {}
    if (!z || Date.now() - z.t > 10 * 60000) { lsDel('autoZadanieIntegracja'); status('stoi'); return; }
    lsDel('autoZadanieIntegracja');                       // jednorazowe – po odświeżeniu nie powtarza
    status('otwieram ustawienia konta ' + z.nazwa + '…');
    wstawDoStrony('openIntegrationSettings("allegro", ' + JSON.stringify(String(z.konto)) + ');');
    const gotowe = await czekajNa(() => Object.keys(z.pola).every(id => document.getElementById(id)), 30000);
    if (!gotowe) { status('STOP: nie otworzyły się ustawienia konta ' + z.nazwa); pikaj(3); return; }
    await czekaj(1500);
    const zmiany = [];
    for (const [id, tekst] of Object.entries(z.pola)) {
      const sel = document.getElementById(id);
      const opt = [...sel.options].find(o => norm(o.textContent) === norm(tekst));
      if (!opt) { status('STOP: brak opcji „' + tekst + '”'); pikaj(3); return; }
      if (sel.value !== opt.value) zmiany.push(id);
      wstawDoStrony('(() => { const s = document.getElementById(' + JSON.stringify(id) + '); s.value = ' + JSON.stringify(opt.value) + '; if (window.jQuery) jQuery(s).trigger("change"); else s.dispatchEvent(new Event("change", { bubbles: true })); })();');
      await czekaj(400);
    }
    const form = document.getElementById(Object.keys(z.pola)[0]).closest('form');
    const zapisz = form && [...form.querySelectorAll('button')].find(b => /^\s*Zapisz\s*$/.test(b.textContent));
    if (!zapisz) { status('STOP: nie znalazłem przycisku Zapisz'); pikaj(3); return; }
    zapisz.click();
    await czekaj(3000);
    const ok = Object.entries(z.pola).every(([id, tekst]) => norm(document.getElementById(id)?.selectedOptions[0]?.textContent) === norm(tekst));
    status(ok ? '✔ zdjęcia w integracji ' + z.nazwa + ' ustawione na finalne' + (zmiany.length ? '' : ' (już były)') : '⚠ sprawdź ustawienia zdjęć – nie potwierdziło zapisu');
    powiadom(ok ? '📸 Zdjęcia ustawione' : '⚠️ Zdjęcia – sprawdź', 'Konto ' + z.nazwa + ': kolejność zgodna z magazynem, wszystkie zdjęcia z magazynu.', { tagi: [ok ? 'camera' : 'warning'] });
    pikaj(ok ? 1 : 3);
  }

  // =========================================================
  // ===== 🗂 KOLEJKA KATALOGÓW – jeden bot, katalog po katalogu =====
  // =========================================================
  const L_KOLEJKA = 'autoKolejkaKatalogow';               // { lista:[{id,nazwa}], idx, proces, start }
  const kolejka = () => { try { const k = JSON.parse(localStorage.getItem(L_KOLEJKA) || 'null'); return k && k.lista && k.lista.length ? k : null; } catch { return null; } };
  function pokazKolejke() {
    document.getElementById('am-kolejka')?.remove();
    const sel = document.getElementById('inventory-option-catalog');
    let kat = sel ? [...sel.options].filter(o => o.value && o.text.trim()).map(o => ({ id: o.value, nazwa: o.text.trim() })) : [];
    if (kat.length) lsSet('autoKatalogiLista', JSON.stringify(kat));                  // zapamiętaj – do edycji kolejki z innych stron
    else { try { kat = JSON.parse(lsGet('autoKatalogiLista') || '[]'); } catch { kat = []; } }
    if (!kat.length) { alert('Wejdź raz na Listę produktów (Magazyn → Lista produktów), żeby bot zapamiętał katalogi. Potem kolejkę możesz zmieniać z każdej strony.'); return; }
    const k = kolejka();
    const wybrane = new Set(k ? k.lista.map(x => x.id) : []);
    const o = document.createElement('div');
    o.id = 'am-kolejka';
    o.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    const pole = 'background:#0f1720;color:#fff;border:1px solid #37474f;border-radius:6px;padding:6px 8px;font:13px sans-serif';
    const pr = kol => `background:${kol};color:#fff;border:0;border-radius:6px;padding:8px 12px;font:bold 13px sans-serif;cursor:pointer`;
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:20px;border-radius:12px;width:min(640px,96vw);font-family:sans-serif;max-height:92vh;display:flex;flex-direction:column">
      <div style="font-size:18px;font-weight:bold;margin-bottom:6px">🗂 Kolejka katalogów – ${PROCES.nazwa}</div>
      <div style="font-size:12.5px;opacity:.8;margin-bottom:10px">Zaznacz katalogi (kolejność jak na liście). Bot robi pierwszy do końca, potem sam przechodzi na następny.${procesKlucz() === 'przerobki' ? ' Po każdym katalogu przeróbek ustawia w parametrach mapowanie EAN = SKU (do finalnego).' : ''}${k ? '<br><b>Teraz w kolejce: ' + (k.idx + 1) + '/' + k.lista.length + ' – ' + k.lista[k.idx].nazwa + '</b>' : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
        <input id="kq-filtr" placeholder="filtr, np. AUTOMATIC PRZE" style="${pole};flex:1;min-width:180px">
        <input id="kq-ile" type="number" min="1" placeholder="ile" style="${pole};width:70px">
        <button id="kq-pierwsze" style="${pr('#455a64')}">Zaznacz pierwsze N z filtra</button>
        <button id="kq-nic" style="${pr('#555')}">Odznacz</button>
      </div>
      <div id="kq-lista" style="overflow:auto;flex:1;min-height:200px;background:#0f1720;border-radius:8px;padding:6px"></div>
      <div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px;flex-wrap:wrap">
        <button id="kq-usun" style="${pr('#c62828')}">Wyczyść kolejkę</button>
        <div style="display:flex;gap:8px"><button id="kq-anuluj" style="${pr('#555')}">Zamknij</button><button id="kq-start" style="${pr('#2e7d32')}">${k ? 'Zapisz (bot leci dalej)' : 'Zapisz i zacznij'}</button></div>
      </div></div>`;
    document.body.appendChild(o);
    const $ = q => o.querySelector(q);
    const rysuj = () => {
      const f = norm($('#kq-filtr').value);
      const fin = procesKlucz() === 'finalne';
      const selG = x => { const v = startGrupy(x.id, x.nazwa); return `<select data-g="${x.id}" title="grupa tagów / cennik dla tego katalogu" style="background:#263238;color:#fff;border:1px solid #455a64;border-radius:5px;font-size:11.5px;padding:1px 3px;margin-left:6px">${['0', '1', '2', 'wyl'].map(g => `<option value="${g}" ${g === v ? 'selected' : ''}>${nazwaGrupy(g)}</option>`).join('')}</select>`; };
      $('#kq-lista').innerHTML = kat.filter(x => !f || norm(x.nazwa).includes(f)).map(x => `<div style="display:flex;align-items:center;padding:2px 4px"><label style="cursor:pointer;flex:1"><input type="checkbox" data-id="${x.id}" ${wybrane.has(x.id) ? 'checked' : ''}> ${x.nazwa.replace(/[<>&]/g, '')}</label>${fin ? selG(x) : ''}</div>`).join('') || '<div style="opacity:.6">brak</div>';
      o.querySelectorAll('#kq-lista input').forEach(c => c.onchange = () => { if (c.checked) wybrane.add(c.dataset.id); else wybrane.delete(c.dataset.id); });
      o.querySelectorAll('#kq-lista select[data-g]').forEach(sg => sg.onchange = () => {
        zapiszGrupeKat(sg.dataset.g, sg.value);
        const kq = kolejka(); if (kq && kq.lista[kq.idx] && kq.lista[kq.idx].id === sg.dataset.g) { lsSet(L_GRUPA, sg.value); status('ten katalog: ' + nazwaGrupy(sg.value)); }
      });
    };
    $('#kq-filtr').oninput = rysuj;
    $('#kq-pierwsze').onclick = () => { const n = parseInt($('#kq-ile').value) || 9999; const f = norm($('#kq-filtr').value); kat.filter(x => !f || norm(x.nazwa).includes(f)).slice(0, n).forEach(x => wybrane.add(x.id)); rysuj(); };
    $('#kq-nic').onclick = () => { wybrane.clear(); rysuj(); };
    $('#kq-anuluj').onclick = () => o.remove();
    $('#kq-usun').onclick = () => { lsDel(L_KOLEJKA); lsDel('autoKatalogDocelowy'); o.remove(); status('kolejka katalogów wyczyszczona'); };
    $('#kq-start').onclick = () => {
      const lista = kat.filter(x => wybrane.has(x.id));
      if (!lista.length) { alert('Zaznacz katalogi.'); return; }
      // kolejka już trwa i bieżący katalog dalej jest zaznaczony – tylko podmień listę, bez restartu
      const biez = k && k.lista[k.idx];
      const idxBiez = biez ? lista.findIndex(x => x.id === biez.id) : -1;
      if (idxBiez >= 0) {
        if (!confirm('Zmieniam kolejkę (' + lista.length + ' katalogów). Bot dokańcza „' + biez.nazwa + '” i leci dalej wg nowej listy:\n\n' + lista.map((x, i) => (i === idxBiez ? '▶ ' : '') + (i + 1) + '. ' + x.nazwa).join('\n'))) return;
        lsSet(L_KOLEJKA, JSON.stringify(Object.assign({}, k, { lista, idx: idxBiez })));
        o.remove(); status('kolejka zmieniona: ' + (idxBiez + 1) + '/' + lista.length); powiadom('🗂 Kolejka zmieniona', lista.length + ' katalogów, teraz: ' + biez.nazwa, { tagi: ['card_index_dividers'] });
        return;
      }
      if (!confirm('Kolejka ' + PROCES.nazwa + ' – ' + lista.length + ' katalogów:\n\n' + lista.map((x, i) => (i + 1) + '. ' + x.nazwa).join('\n') + '\n\nZacząć od pierwszego?')) return;
      lsSet(L_KOLEJKA, JSON.stringify({ lista, idx: 0, proces: procesKlucz(), start: Date.now() }));
      lsSet('autoKatalogDocelowy', lista[0].id);
      lsDel(L_SESJA);
      if (procesKlucz() === 'finalne') lsSet(L_GRUPA, startGrupy(lista[0].id, lista[0].nazwa));
      o.remove();
      powiadom('🗂 Kolejka katalogów', PROCES.nazwa + ': ' + lista.length + ' katalogów\n1. ' + lista[0].nazwa, { tagi: ['card_index_dividers'] });
      if (cyklWlaczony()) lsSet(L_ETAP, 'katalog');
      if (NA_KATALOGU) wezPaczke(); else status('kolejka zapisana – ruszy na liście produktów');
    };
    rysuj();
  }

  // koniec katalogu: przeróbki → mapowanie EAN = SKU, potem następny katalog z kolejki albo podsumowanie
  async function koniecKatalogu(katId, katNazwa) {
    if (procesKlucz() === 'przerobki' && katId) {
      const zrobione = parseInt(lsGet('autoEanSkuOk_' + katId, '0')) || 0;
      if (Date.now() - zrobione > 3 * 3600000) {
        status('katalog przerobiony – ustawiam w parametrach EAN = SKU…');
        lsSet('autoZadanieEanSku', JSON.stringify({ kat: katId, nazwa: katNazwa, t: Date.now() }));
        await czekaj(1500);
        location.href = adresMapowan(katId);
        return;
      }
    }
    const k = kolejka();
    if (k && k.lista[k.idx] && k.lista[k.idx].id === katId && k.idx + 1 < k.lista.length) {
      // podsumowanie tego katalogu na telefon i dalej
      let sesja = null; try { sesja = JSON.parse(localStorage.getItem(L_SESJA) || 'null'); } catch {}
      const wpisy = lsJson(L_RAPORT).filter(w => !sesja || (w.nr || 0) > sesja.odNr);
      const suma = x => wpisy.reduce((a, w) => a + (Number(w[x]) || 0), 0);
      k.idx++;
      lsSet(L_KOLEJKA, JSON.stringify(k));
      lsSet('autoKatalogDocelowy', k.lista[k.idx].id);
      lsDel(L_SESJA);
      if (procesKlucz() === 'finalne') lsSet(L_GRUPA, startGrupy(k.lista[k.idx].id, k.lista[k.idx].nazwa));
      powiadom('✅ Katalog ' + k.idx + '/' + k.lista.length + ' gotowy', katNazwa + '\nWystawione ' + suma('dobre') + ' · błędne ' + suma('bledne') + '\n➡ Następny: ' + k.lista[k.idx].nazwa, { priorytet: 3, tagi: ['card_index_dividers'], akcje: [['📊 Status', 'status'], ['⏹ Stop', 'stop']] });
      status('➡ następny katalog z kolejki: ' + k.lista[k.idx].nazwa);
      lsSet(L_ETAP, 'katalog');
      await czekaj(2000);
      if (location.pathname.startsWith('/inventory_products')) return wezPaczke();
      location.href = '/inventory_products';
      return;
    }
    if (k && k.lista[k.idx] && k.lista[k.idx].id === katId) { powiadom('🏁 Kolejka katalogów skończona', k.lista.length + ' katalogów – ' + PROCES.nazwa, { priorytet: 4, tagi: ['checkered_flag'] }); lsDel(L_KOLEJKA); lsDel('autoKatalogDocelowy'); }
    lsDel(L_ETAP);
    if (!location.pathname.startsWith('/inventory_products')) { lsSet('autoPokazKoniec', '1'); location.href = '/inventory_products'; return; }
    status('BRAK NOWYCH PRODUKTÓW – koniec');
    pikaj(4);
    pokazZakonczone();
  }

  // na stronie parametrów: dodaj mapowanie EAN = „Wstaw SKU” (jeśli go nie ma)
  async function mapowanieEanSku(z) {
    status('EAN = SKU: sprawdzam parametry katalogu ' + (z.nazwa || z.kat) + '…');
    await czekajNa(() => [...document.querySelectorAll('button')].some(b => /Dodaj parametr/.test(b.textContent) && b.offsetParent), 60000);
    await czekaj(2500);
    const toEAN = t => /^(EAN|GTIN)(\s*\((GTIN|EAN)\))?$/i.test(String(t || '').replace(/\s+/g, ' ').trim());
    const wiersz = () => [...document.querySelectorAll('tr.paramMappingRow')].find(r => toEAN((r.querySelector('td[id^="cellServiceParam_"] a') || r.querySelector('td[id^="cellServiceParam_"]'))?.textContent));
    const typ = r => document.getElementById('initialValueActionType_' + r.id.replace('row_', ''))?.value;
    let wynik = '';
    const r0 = wiersz();
    if (r0) wynik = typ(r0) === '5' ? 'już jest' : 'jest inne mapowanie EAN (reguła ' + typ(r0) + ') – zostawiam';
    else {
      [...document.querySelectorAll('button')].find(b => /Dodaj parametr/.test(b.textContent) && b.offsetParent).click();
      const e = await czekajNa(() => document.getElementById('row_-1'), 8000);
      if (!e) wynik = 'brak edytora';
      else {
        myszka(e.querySelector('.select2-selection'), ['mousedown']); await czekaj(800);
        const sz = document.querySelector('.select2-container--open .select2-search__field');
        if (sz) { sz.value = 'EAN'; sz.dispatchEvent(new Event('input', { bubbles: true })); sz.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true })); }
        const op = await czekajNa(() => [...document.querySelectorAll('.select2-results__option')].find(x => toEAN(x.textContent)), 8000);
        if (!op) wynik = 'brak parametru EAN na liście';
        else {
          myszka(op, ['mouseover', 'mousedown', 'mouseup', 'click']); await czekaj(1500);
          const t = document.getElementById('editorActionType');
          if (!t || ![...t.options].some(x => x.value === '5')) wynik = 'brak reguły „Wstaw SKU”';
          else {
            ustawSelect(t, '5'); await czekaj(1200);
            const w = document.getElementById('editorActionWhen'); if (w) ustawSelect(w, 0);
            await czekaj(600);
            document.getElementById('btnSaveEdition')?.click();
            await czekaj(4000);
            wynik = 'zapisane';
          }
        }
      }
    }
    if (wynik === 'zapisane') {
      z.proby = (z.proby || 0) + 1;
      if (z.proby < 3) { lsSet('autoZadanieEanSku', JSON.stringify(z)); location.reload(); return; }   // po odświeżeniu sprawdzi, że jest (→ „już jest”)
      wynik = 'po 3 zapisach nie widzę mapowania EAN';
    }
    lsDel('autoZadanieEanSku');
    const ok = wynik === 'już jest';
    if (ok) lsSet('autoEanSkuOk_' + z.kat, String(Date.now()));
    else { lsSet('autoEanSkuOk_' + z.kat, String(Date.now())); powiadom('⚠️ EAN = SKU – sprawdź', (z.nazwa || z.kat) + ': ' + wynik, { priorytet: 4, tagi: ['warning'] }); }
    status((ok ? '✔ EAN = SKU ustawione' : '⚠ EAN = SKU: ' + wynik) + ' – ' + (z.nazwa || ''));
    await czekaj(2000);
    await koniecKatalogu(z.kat, z.nazwa || '');
  }

  // 🎯 „Zapamiętaj filtr EAN z ekranu”: ustawiasz filtr ręcznie w Base, klikasz – skrypt zapisuje kod pola i operatora
  async function zapamietajFiltrEan() {
    status('czytam filtry z ekranu…');
    const r = await bazaBase('zrzutFiltrow', {}, 30000);
    const w = r.wynik;
    if (!w) { alert('Nie udało się odczytać filtrów (' + (r.blad || 'brak odpowiedzi') + ').\nOdśwież stronę katalogu i spróbuj jeszcze raz.'); return; }
    const esc2 = t => String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const tekst = JSON.stringify(w, null, 1);
    const opZ = f => (f.op != null ? f.op : (f.operation != null ? f.operation : f.filterOperation));
    document.querySelectorAll('.am-ean-okno').forEach(x => x.remove());
    const o = document.createElement('div');
    o.className = 'am-ean-okno';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center';
    o.innerHTML = '<div style="background:#1e2a38;color:#fff;padding:20px;border-radius:12px;width:min(900px,96vw);max-height:92vh;overflow:auto;font:13px sans-serif">'
      + '<div style="font-size:17px;font-weight:bold;margin-bottom:6px">🎯 Zapamiętaj filtr „EAN · wartość nie pusta”</div>'
      + '<div style="opacity:.8;margin-bottom:10px">Ustaw ten filtr ręcznie w katalogu (filtrowanie zaawansowane), kliknij Filtruj, potem wróć tu i kliknij „to ten”. Skrypt zapamięta kod pola i operatora i będzie ustawiał filtr sam.</div>'
      + (w.dane && w.dane.length
          ? '<table style="width:100%;border-collapse:collapse">' + w.dane.map((f, i) =>
              '<tr><td style="padding:4px">' + (i + 1) + '.</td><td style="padding:4px"><b>' + esc2(f.field) + '</b></td><td style="padding:4px">' + esc2(opZ(f)) + '</td>'
              + '<td style="padding:4px;opacity:.75">' + esc2(JSON.stringify(f.val)).slice(0, 60) + '</td>'
              + '<td style="padding:4px"><button data-ean="' + i + '" style="background:#2e7d32;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer">to ten</button></td></tr>').join('') + '</table>'
          : '<div style="color:#ffb74d">Na ekranie nie ma ustawionych filtrów – ustaw filtr EAN w Base i kliknij 🎯 jeszcze raz.</div>')
      + '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">'
      + '<button id="am-ean-kopiuj" style="background:#6a1b9a;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">📋 Kopiuj zrzut dla Claude</button>'
      + '<button id="am-ean-zapomnij" style="background:#ef6c00;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">🗑 Zapomnij zapamiętany</button>'
      + '<button id="am-ean-zamknij" style="background:#555;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer">Zamknij</button></div>'
      + '<div style="margin-top:8px;opacity:.6;font-size:11px">zapamiętane: pole „' + esc2(localStorage.getItem('autoPoleEan') || '–') + '”, operator „' + esc2(localStorage.getItem('autoOpNiepusty') || '–') + '”</div></div>';
    document.body.appendChild(o);
    o.querySelectorAll('[data-ean]').forEach(b => b.onclick = () => {
      const f = w.dane[+b.dataset.ean], op = opZ(f);
      try { localStorage.setItem('autoPoleEan', String(f.field)); localStorage.setItem('autoOpNiepusty', String(op)); } catch (e) {}
      o.remove();
      status('zapamiętane: EAN = pole „' + f.field + '”, operator „' + op + '”');
      alert('Zapamiętane:\npole: ' + f.field + '\noperator: ' + op + '\n\nOd teraz skrypt ustawia filtr „EAN niepusty” sam.');
    });
    o.querySelector('#am-ean-zamknij').onclick = () => o.remove();
    o.querySelector('#am-ean-zapomnij').onclick = () => { localStorage.removeItem('autoPoleEan'); localStorage.removeItem('autoOpNiepusty'); o.remove(); status('zapomniane – skrypt będzie szukał operatora sam'); };
    o.querySelector('#am-ean-kopiuj').onclick = async () => {
      if (await kopiujTekst('ZRZUT FILTRÓW (ekran) ' + location.pathname + '\n' + tekst.slice(0, 12000))) alert('Skopiowane – wklej Claude');
      else prompt('Skopiuj i wklej Claude:', tekst.slice(0, 4000));
    };
  }

  async function wezPaczke() {
    przerwanoKatalog = false;
    if (!lsGet(L_SESJA)) {                              // początek sesji (do podsumowania na końcu)
      const r = lsJson(L_RAPORT);
      lsSet(L_SESJA, JSON.stringify({ start: Date.now(), odNr: r.length ? (r[r.length - 1].nr || r.length) : 0, proces: PROCES.nazwa }));
    }
    const stop = () => { if (przerwanoKatalog) { status('zatrzymano'); return true; } return false; };

    // katalog docelowy (ustawiany przez program z niewidzialnymi przeglądarkami) – kilka profili na jednym koncie Base
    // może przełączać katalog, więc przed każdą paczką upewnij się, że wybrany jest właściwy
    const katCel = lsGet('autoKatalogDocelowy');
    if (katCel) {
      const sel = await czekajNa(() => document.getElementById('inventory-option-catalog'), 60000);
      const opt = sel && [...sel.options].find(o => o.value === katCel || norm(o.text) === norm(katCel));
      if (!opt) {
        status('STOP: nie ma katalogu „' + katCel + '”');
        powiadom('⚠️ Stop – brak katalogu', 'Nie znalazłem katalogu „' + katCel + '”.', { priorytet: 5, tagi: ['warning'] });
        return;
      }
      if (sel.value !== opt.value) {
        status('przełączam katalog na „' + opt.text + '”…');
        const pierwszy = wierszeProduktow()[0]?.id;
        wstawDoStrony('(() => { const s = document.getElementById("inventory-option-catalog"); s.value = ' + JSON.stringify(opt.value) +
          '; if (window.jQuery) jQuery(s).trigger("change"); else s.dispatchEvent(new Event("change", { bubbles: true })); })();');
        await czekaj(3000);                              // jeśli Base przeładuje stronę, skrypt ruszy od nowa sam
        await czekajNa(() => wierszeProduktow().length > 0 && wierszeProduktow()[0].id !== pierwszy, 60000);
        await czekaj(2000);
        if (document.getElementById('inventory-option-catalog')?.value !== opt.value) {
          status('STOP: nie udało się przełączyć katalogu na „' + opt.text + '”');
          return;
        }
      }
    }

    // filtry procesu + liczba produktów na stronie
    const rozmiary = [50, 100, 200, 300, 500, 1000];
    const rozmiar = rozmiary.find(r => r >= paczka()) || 1000;
    const grupa = grupaFinalne();
    let filtry = grupa ? PROCES.filtry.map(g => g.concat([{ field: 'filter_tags', op: '=', tagi: grupa.tagi }])) : PROCES.filtry;
    // przeróbki „tylko bez oferty”: Marketplace (oferta) NIE zawiera dowolnego konta – bierze też to, co jest w spisie (np. paczki, które się nie wystawiły)
    const bezOferty = procesKlucz() === 'przerobki' && lsGet('autoBezOferty') === '1';
    if (bezOferty) filtry = filtry.map(g => g.concat([{ field: 'link_marketplace', op: 'NOT LIKE', val: 'any_marketplace_account' }]));
    // opcjonalnie: tylko produkty z EAN (EAN · wartość nie pusta) – kod pola i operatora szukany na stronie
    const zEan = lsGet('autoTylkoZEan') === '1';
    if (zEan) filtry = filtry.map(g => g.concat([{ field: 'ean', op: 'NOT EMPTY', niepuste: true }]));
    if (await czekajNa(() => wierszeProduktow().length > 0, 60000) && !stop()) {
      status('ustawiam filtry: ' + PROCES.nazwa + (grupa ? ' · grupa ' + grupa.nazwa + ' (' + grupa.tagi.join(', ') + ')' : '') + (zEan ? ' · tylko z EAN' : '') + '…');
      const pierwszy = wierszeProduktow()[0]?.id;
      let r = await bazaBase('ustawFiltry', { filtry, rozmiar }, 180000);
      if ((r.blad || !r.wynik || !r.wynik.ok) && !(r.wynik && r.wynik.brakTagow)) {   // Base czasem nie doczytał jeszcze list filtrów – druga próba
        console.log('[AutoMap] filtry – 1. próba nieudana:', r);
        status('filtry nie weszły – próbuję jeszcze raz…');
        await czekaj(5000);
        r = await bazaBase('ustawFiltry', { filtry, rozmiar }, 180000);
      }
      if (r.wynik && r.wynik.brakTagow) {
        status('STOP: w Base nie ma tagów ' + r.wynik.brakTagow.join(', '));
        powiadom('⚠️ Stop – brak tagów', 'W katalogu nie ma tagów: ' + r.wynik.brakTagow.join(', '), { priorytet: 5, tagi: ['warning'] });
        pikaj(3);
        return;
      }
      if (r.blad || !r.wynik || !r.wynik.ok) {
        status('STOP: nie udało się ustawić filtrów ' + PROCES.nazwa + (r.blad ? ' (' + r.blad + ')' : '') + (r.wynik && r.wynik.bladLadowania ? ' (Base: ' + r.wynik.bladLadowania + ')' : '') + (r.wynik && r.wynik.negacja ? ' – Base nie przyjął „nie zawiera dowolne konto” (wyłącz 🔁 albo wyślij zrzut filtrów Claude)' : '') + (r.wynik && r.wynik.niepuste ? ' – Base nie przyjął „EAN · wartość nie pusta” (wyłącz 🏷 z EAN w ⚙️ Kroki albo wyślij Claude log z konsoli [AutoMap] filtry)' : ''));
        powiadom('⚠️ Stop – filtry', 'Nie udało się ustawić filtrów ' + PROCES.nazwa + ' w katalogu.', { priorytet: 5, tagi: ['warning'] });
        console.log('[AutoMap] filtry:', r);
        try {                                            // zrzut do schowka – do wklejenia Claude
          const t = 'ZRZUT FILTRÓW AutoMap ' + ((typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '') + '\n'
            + 'proces: ' + PROCES.nazwa + ' · URL: ' + location.pathname + location.search + '\n'
            + JSON.stringify(r, null, 1).slice(0, 12000);
          if (await kopiujTekst(t)) status('zrzut filtrów skopiowany – wklej go Claude');
          else prompt('Skopiuj i wklej Claude:', t.replace(/\n/g, ' | ').slice(0, 4000));
        } catch (e) {}
        pikaj(3);
        return;                                        // bez pełnych filtrów nic nie wystawiamy
      }
      if (r.wynik && r.wynik.pominietoEan) {
        status('⚠ filtry bez „EAN niepusty” – ta wersja Base nie ma takiego operatora (reszta filtrów OK)');
        powiadom('⚠️ Filtr EAN pominięty', 'Base nie ma operatora „nie jest pusta” – paczka idzie bez filtra „tylko z EAN”.\n' + PROCES.nazwa, { priorytet: 4, tagi: ['warning'] });
      }
      // poczekaj aż tabela przeładuje się z nowymi filtrami
      await czekaj(1500);
      await czekajNa(() => wierszeProduktow().length > 0 && wierszeProduktow()[0].id !== pierwszy, 30000);
      await czekaj(1500);
    }
    if (stop()) return;
    status('czekam na listę produktów…');
    if (!await czekajNa(() => wierszeProduktow().length > 0 && typeof window.showListProductsModal === 'function', 60000)) {
      status('nie widzę produktów');
      return;
    }
    // poczekaj, aż tabela wczyta się cała (liczba wierszy przestaje rosnąć)
    { let poprz = -1, stab = 0; const st = Date.now();
      while (Date.now() - st < 120000) {
        const n = wierszeProduktow().length;
        status('wczytuję katalog: ' + n + ' produktów…');
        stab = (n === poprz) ? stab + 1 : 0; poprz = n;
        if (stab >= 3) break;
        await czekaj(1500);
      } }
    await czekaj(1000);

    const katSel = document.getElementById('inventory-option-catalog');
    const katId = katSel?.value || '';
    const katNazwa = katSel?.selectedOptions[0]?.text || '';
    lsSet(L_KATALOG, katId);

    // zbierz niewysłane (przechodząc po stronach, jeśli trzeba)
    let wybrane = [];
    const PACZKA = paczka();
    for (let strona = 0; strona < 50 && wybrane.length < PACZKA; strona++) {
      if (stop()) return;
      const s = bezOferty ? spisBezOferty(katId) : spis();   // „bez oferty” – spis nie blokuje, ale każdy produkt tylko raz na katalog
      const ids = wierszeProduktow().map(idZWiersza).filter(id => !s.has(id) && !wybrane.includes(id));
      wybrane.push(...ids.slice(0, PACZKA - wybrane.length));
      status('zebrano ' + wybrane.length + ' niewysłanych');
      if (wybrane.length >= PACZKA) break;

      const dalej = [...document.querySelectorAll('a.item-sm.sq-sm')]
        .find(a => a.querySelector('i.fa-chevron-right') && (a.getAttribute('onclick') || '').includes('table_setPage'));
      if (!dalej) break;
      const pierwszy = wierszeProduktow()[0]?.id;
      dalej.click();
      const zmiana = await czekajNa(() => wierszeProduktow().length > 0 && wierszeProduktow()[0].id !== pierwszy, 30000);
      if (!zmiana) break;
      await czekaj(2000);
    }

    if (!wybrane.length && grupa) {
      const i = GRUPY_FINALNE.indexOf(grupa);
      const nast = GRUPY_FINALNE[i + 1];
      if (nast) {                                       // ta grupa tagów skończona – następna
        lsSet(L_GRUPA, String(i + 1));
        status('grupa ' + grupa.nazwa + ' skończona – przechodzę do ' + nast.nazwa);
        powiadom('🏷 Grupa ' + grupa.nazwa + ' skończona', 'Przechodzę do grupy ' + nast.nazwa + ' (' + nast.tagi.join(', ') + ').', { priorytet: 3, tagi: ['label'] });
        odswiezPrzyciski();
        await czekaj(1500);
        return wezPaczke();
      }
      lsSet(L_GRUPA, startGrupy(katId, katNazwa));     // wszystkie grupy zrobione – wróć do ustawienia tego katalogu
    }
    if (!wybrane.length) {
      await koniecKatalogu(katId, katNazwa);
      return;
    }

    // bezpiecznik: połowa paczki taka sama jak poprzednio (a poprzednia się wystawiła) = pętla → stop
    let powtorzone = null;
    try {
      const ost = JSON.parse(lsGet('autoOstatniaPaczka') || 'null');
      if (ost && ost.kat === katId && Array.isArray(ost.ids) && ost.ids.length) {
        const pop = new Set(ost.ids.map(String));
        const wspolne = wybrane.filter(id => pop.has(String(id))).length;
        powtorzone = wspolne;
        if (!ost.nieWyszla && wspolne >= 0.5 * wybrane.length && bezOferty && !wezPaczke.__poprawka) {
          // tryb „bez oferty”: poprzednia paczka była już wystawiana → jej produkty na listę tego katalogu i bierzemy dalej
          dodajDoSpisuBezOferty(katId, ost.ids);
          status('pomijam ' + wspolne + ' produktów z poprzedniej paczki – biorę nowe…');
          wezPaczke.__poprawka = true;
          try { return await wezPaczke(); } finally { wezPaczke.__poprawka = false; }
        }
        if (!ost.nieWyszla && wspolne >= 0.5 * wybrane.length) {
          zatrzymajCykl('PĘTLA – TA SAMA PACZKA', katNazwa + ': ' + wspolne + ' z ' + wybrane.length + ' produktów było już w poprzedniej paczce. Zatrzymałem, żeby nie mielić w kółko (i nie robić duplikatów).');
          return;
        }
      }
    } catch {}

    // otwórz okno "Wystaw zaznaczone" z naszymi ID
    status('tworzę wystawianie dla ' + wybrane.length + ' produktów…');
    window.showListProductsModal(wybrane);
    const konta = await czekajNa(() => { const s = document.getElementById('list_allegro_accounts'); return s && s.offsetParent ? s : null; }, 20000);
    const tryb = document.getElementById('list_allegro_sell_type');
    if (!konta || !tryb) { status('nie otworzyło się okno wystawiania'); return; }
    await czekaj(800);

    // konto = ostatni wyraz nazwy katalogu, np. "ERO HURT PRZE 8 SekretnaAlkowa" -> SekretnaAlkowa
    const opcje = [...konta.options].filter(o => o.text.trim());
    const ostatni = katNazwa.trim().split(/\s+/).pop() || '';
    let konto = opcje.find(o => norm(o.text) === norm(ostatni));
    if (!konto) { // gdyby nazwa sklepu miała kilka wyrazów – najdłuższa nazwa konta na końcu nazwy katalogu
      konto = opcje.filter(o => norm(katNazwa).endsWith(' ' + norm(o.text)))
        .sort((a, b) => b.text.length - a.text.length)[0];
    }
    if (!konto) {
      lsDel(L_ETAP);
      status('STOP: brak konta "' + ostatni + '" z nazwy katalogu');
      pikaj(4);
      alert('AutoMap: nie znalazłem konta Allegro o nazwie "' + ostatni + '" (koniec nazwy katalogu "' + katNazwa + '"). Nic nie wystawiłem.');
      return;
    }
    if (ileDobrych(konto.text) >= limitDobrych()) {
      document.querySelector('#modal_list_products .close')?.click();
      zatrzymajCykl('LIMIT OFERT – ' + konto.text.trim(), 'Konto ' + konto.text.trim() + ' ma już ' + ileDobrych(konto.text).toLocaleString('pl-PL') + ' poprawnych ofert (limit ' + limitDobrych().toLocaleString('pl-PL') + ', ' + PROCES.nazwa + '). Nic nie wystawiłem. Licznik zmienisz w ⚙️ Kroki.');
      return;
    }
    ustawSelect(konta, konto.value);
    lsSet('autoOstatnieKonto', JSON.stringify({ id: konto.value, nazwa: konto.text.trim(), proces: procesKlucz() }));
    await czekaj(800);
    ustawSelect(tryb, TRYB_PRODUKTYZACJI);
    await czekaj(800);
    if (norm(konta.selectedOptions[0]?.text) !== norm(konto.text) || tryb.value !== TRYB_PRODUKTYZACJI) {
      status('nie udało się ustawić konta/trybu'); return;
    }

    const wykonaj = [...document.querySelectorAll('#modal_list_products input[type="button"], #modal_list_products button')]
      .find(b => /Wykonaj/i.test(b.value || b.textContent));
    if (!wykonaj) { status('brak przycisku Wykonaj'); return; }

    // paczka zapamiętana jako „w toku” – do spisu trafi CAŁA (500) w chwili kliknięcia WYSTAW
    lsSet(L_OCZEKUJACA, JSON.stringify({ ids: wybrane, proces: procesKlucz(), konto: konto.text, t: Date.now(), katId, bezOferty, powtorzone,
      katNazwa, grupa: grupa ? grupa.nazwa : '', cennik: grupa ? grupa.cennik : '' }));
    lsSet(L_POMIAR, JSON.stringify({ n: wybrane.length, start: Date.now(), konto: konto.text }));
    lsSet(L_ETAP, 'lista');
    status('konto ' + konto.text + ' – Wykonaj…');
    await czekaj(500);
    if (stop()) { lsDel(L_OCZEKUJACA); lsDel(L_ETAP); document.querySelector('#modal_list_products .close')?.click(); return; }
    if (jednaKarta()) {
      // Safari: nie pozwól Base otworzyć nowej karty – wystawianie otworzy się w tej samej
      lsDel(L_KATALOG_CZEKA);
      wstawDoStrony(`(() => {
        if (window.__amJednaKarta) return; window.__amJednaKarta = true;
        const o = window.open;
        window.open = function (u) {
          if (u && /marketplace_list_form/.test(String(u))) { setTimeout(() => { location.href = String(u).replace(/^http:/, 'https:'); }, 50); return null; }
          return o.apply(this, arguments);
        };
        // formularze i linki z target=_blank też w tej karcie
        const fs = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function () { if (this.target === '_blank') this.target = '_self'; return fs.apply(this, arguments); };
        document.addEventListener('submit', e => { if (e.target && e.target.target === '_blank') e.target.target = '_self'; }, true);
        document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[target="_blank"]'); if (a && /marketplace_list_form/.test(a.href)) a.target = '_self'; }, true);
      })();`);
      status('otwieram wystawianie w tej karcie…');
      wykonaj.click();
      await czekaj(15000);
      if (!location.pathname.startsWith('/inventory_products')) return;   // dalej działa już strona wystawiania
      // Base mimo wszystko otworzył nową kartę – dalej leci tamta karta. Ta się zamyka (jeśli przeglądarka pozwoli),
      // żeby przy każdej paczce nie przybywało kart.
      status('wystawianie otworzyło się w nowej karcie – zamykam tę');
      await czekaj(1000);
      window.close();
      await czekaj(2000);
      lsSet(L_KATALOG_CZEKA, String(Date.now()));
      czekajNaSygnal();
      return;
    }
    wykonaj.click();

    // Base otwiera wystawianie w nowej karcie (jeśli przeglądarka pozwala na wyskakujące okna).
    // Jeśli po kilku sekundach dalej jesteśmy w katalogu – ta karta zostaje i czeka na kolejną paczkę.
    await czekaj(6000);
    if (location.pathname.startsWith('/inventory_products')) {
      lsSet(L_KATALOG_CZEKA, String(Date.now()));
      czekajNaSygnal();
    }
  }

  function czekajNaSygnal() {
    status('wystawianie trwa w nowej karcie – ta czeka na kolejną paczkę');
    const start = lsGet(L_SYGNAL, '0');
    const obsluz = () => {
      if (lsGet(L_SYGNAL, '0') === start) return false;
      window.removeEventListener('storage', onStorage);
      clearInterval(timer);
      lsDel(L_KATALOG_CZEKA);
      if (cyklWlaczony() && lsGet(L_ETAP) === 'katalog') {
        status('kolejna paczka – odświeżam katalog…');
        setTimeout(() => location.reload(), 1500);     // świeża lista bez już wysłanych
      } else {
        status('wystawianie zakończone');
      }
      return true;
    };
    const onStorage = e => { if (e.key === L_SYGNAL) obsluz(); };
    window.addEventListener('storage', onStorage);
    const timer = setInterval(obsluz, 5000);           // zapas, gdyby zdarzenie nie doszło
  }

  // =========================================================
  // ======================== START ==========================
  // =========================================================
  sluchajKomend();
  if (NA_WYSTAWIANIU) startWystawiania();
  else if (NA_MAPOWANIACH) stronaMapowan();
  else if (STRONA.includes('list_integrations.php')) stronaIntegracji();
  else if (STRONA.includes('allegro_auctions.php')) stronaOfert();
  else if (NA_KATALOGU) {
    setTimeout(() => { const s = document.getElementById('inventory-option-catalog'); if (s) lsSet('autoKatalogiLista', JSON.stringify([...s.options].filter(o => o.value && o.text.trim()).map(o => ({ id: o.value, nazwa: o.text.trim() })))); }, 5000);
    if (lsGet('autoPokazKoniec') === '1') { lsDel('autoPokazKoniec'); status('BRAK NOWYCH PRODUKTÓW – koniec'); pikaj(4); pokazZakonczone(); }
    else if (cyklWlaczony() && lsGet(L_ETAP) === 'katalog') wezPaczke();
    else status('stoi – „Weź paczkę” albo włącz cykl');
  } else {
    panelUI.style.display = cyklWlaczony() ? 'flex' : 'none';
    status(cyklWlaczony() ? 'cykl ON – etap: ' + (lsGet(L_ETAP) || '-') : 'stoi');
  }
})();