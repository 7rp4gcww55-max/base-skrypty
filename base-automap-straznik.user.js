// ==UserScript==
// @name         Base AutoMap – strażnik (render, wystawianie, mapowania, Cloudflare)
// @version      2026.10.17-1
// @match        https://*.baselinker.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-automap-straznik.user.js
// @downloadURL  https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-automap-straznik.user.js
// ==/UserScript==

// Działa OBOK głównego skryptu AutoMap (osobny skrypt w Tampermonkey).
// Aktualizuje się sam z GitHuba (repo base-skrypty) – nic nie wklejaj ręcznie.
//
// WYSTAWIANIE (marketplace_list_form):
//  • strona się nie wyrysowała (puste wiersze / kręciołek w „Ustawienia wspólne aukcji”) → odśwież, AutoMap leci dalej
//  • wysyłanie ofert stoi X min → odśwież i sam kliknij WYSTAW jeszcze raz
//  • NIGDY nie odświeża, gdy produkty wgrywają się do formularza (po 50) ani w trakcie operacji masowej
// PARAMETRY / MAPOWANIA (allegro_link_parameters):
//  • strona się nie wczytała → odśwież (zapas – główny skrypt też to robi po poprawce stronaMapowan)
// CLOUDFLARE („czy jesteś człowiekiem”) – na każdej stronie Base:
//  • NIE klika (to zabezpieczenie przed botami) – baner + alarm na telefon, czeka na Ciebie.
//    Po przejściu strona przeładowuje się sama i AutoMap rusza od miejsca, w którym stanął.
//
// Licznik prób liczy tylko odświeżenia POD RZĄD bez skutku. Ruszyło = licznik od zera,
// więc może tak robić w kółko, aż paczka się wystawi. MAX_Z_RZEDU nieudanych pod rząd = alarm.

(() => {
  if (window.__amStraznikRender) return;
  window.__amStraznikRender = true;
  if (location.protocol === 'http:') return;             // główny skrypt sam przekierowuje na https

  // ===== USTAWIENIA =====
  const PANEL_SEK = 60;        // „Ustawienia wspólne aukcji” kręcą się tyle s bez pól = zawieszone
  const PRODUKTY_SEK = 90;     // ani jednego pola produktu tyle s = zawieszone
  const WYSYLANIE_MIN = 5;     // licznik wysyłania stoi tyle minut = wystawianie zawieszone
  const MAPOWANIA_SEK = 120;   // strona parametrów nie wczytana tyle s = zawieszona
  const CLOUDFLARE_MIN = 10;   // Cloudflare wisi tyle minut → odśwież (max 3 razy), dalej tylko czeka
  const MAX_Z_RZEDU = 5;       // tyle odświeżeń POD RZĄD bez skutku, potem alarm
  const CO_ILE_MS = 5000;      // jak często sprawdzać

  const NA_WYST = location.pathname.includes('marketplace_list_form.php');
  const NA_MAP = location.pathname.includes('allegro_link_parameters.php');
  const LID = new URLSearchParams(location.search).get('listing_id') || 'x';
  const K_REND = 'am_' + LID + '_odswiezRender';   // {n} – odświeżenia renderu z rzędu
  const K_WYS = 'am_' + LID + '_odswiezWysyl';     // {n} – odświeżenia wysyłania z rzędu
  const K_KLIK = 'am_' + LID + '_klikWystaw';      // czas – po odświeżeniu kliknij WYSTAW
  const K_MAP = 'am_map_odswiez';                  // {n} – odświeżenia strony parametrów z rzędu
  const K_CF = 'am_cf_odswiez';                    // {n} – odświeżenia przy Cloudflare
  const L_CF = 'autoCloudflare';                   // {od} – trwa weryfikacja Cloudflare
  const K_SKIP = 'am_' + LID + '_skip';
  const K_POWODY = 'am_' + LID + '_powody';
  const K_ZNANA = 'am_' + LID + '_ileProduktow';   // AutoMap zapisuje to dopiero, gdy wczyta CAŁĄ paczkę

  const czytaj = k => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } };
  const widoczny = el => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const klasa = el => String((el.getAttribute && el.getAttribute('class')) || '');

  // ---- powiadomienia / log 📺 / baner ----
  const ntfy = (tytul, tresc, prio) => {
    const temat = localStorage.getItem('autoNtfyTemat');
    if (localStorage.getItem('autoNtfyOn') !== '1' || !temat) return;
    const ua = navigator.userAgent;
    const nazwa = (localStorage.getItem('autoNazwaPrzegl') || '').trim() ||
      (/Edg\//.test(ua) ? 'Edge' : /Chrome|Chromium/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Przeglądarka');
    fetch('https://ntfy.sh/', { method: 'POST', keepalive: true, body: JSON.stringify({
      topic: temat, title: nazwa + ' | ' + tytul, message: tresc, priority: prio,
      tags: [prio >= 5 ? 'rotating_light' : 'arrows_counterclockwise'] }) }).catch(() => {});
  };
  const doLogu = m => {
    try {
      const log = JSON.parse(localStorage.getItem('autoLiveLog') || '[]');
      log.push({ t: Date.now(), c: (NA_WYST ? 'W ' + LID : NA_MAP ? 'M' : 'S'), m });
      localStorage.setItem('autoLiveLog', JSON.stringify(log.slice(-3000)));
    } catch {}
  };
  const baner = (tekst, kolor) => {
    let b = document.getElementById('am-render');
    if (!b) {
      b = document.createElement('div');
      b.id = 'am-render';
      b.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999999;color:#fff;font:bold 14px sans-serif;padding:10px 16px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.5);max-width:90vw;text-align:center';
      (document.body || document.documentElement).appendChild(b);
    }
    b.style.background = kolor;
    b.textContent = tekst;
  };
  const schowajBaner = () => document.getElementById('am-render')?.remove();

  // kroki, które AutoMap pominął przez pustą stronę („brak pola”), wracają do zrobienia
  const przywrocKroki = () => {
    try {
      const pow = JSON.parse(sessionStorage.getItem(K_POWODY) || '{}');
      const doPowtorki = Object.keys(pow).filter(n => /brak pola|brak przycisku mapowania|nie otworzyło się okno/i.test(String(pow[n])));
      if (!doPowtorki.length) return;
      sessionStorage.setItem(K_SKIP, JSON.stringify((czytaj(K_SKIP) || []).filter(n => !doPowtorki.includes(n))));
      doPowtorki.forEach(n => delete pow[n]);
      sessionStorage.setItem(K_POWODY, JSON.stringify(pow));
    } catch {}
  };

  // ---- tempo: ten sam odstęp między wczytaniami stron co w AutoMap (wspólny znacznik w localStorage) ----
  const TEMPO_ODSTEP_S = 20, TEMPO_LOSOWO_S = 15;
  async function odswiezSpokojnie() {
    const odstep = (TEMPO_ODSTEP_S + Math.random() * TEMPO_LOSOWO_S) * 1000;
    for (;;) {
      const ost = parseInt(localStorage.getItem('autoOstatnieWczytanie')) || 0;
      const zostalo = ost + odstep - Date.now();
      if (zostalo <= 0) break;
      await new Promise(r => setTimeout(r, Math.min(zostalo, 2000)));
    }
    try { localStorage.setItem('autoOstatnieWczytanie', String(Date.now())); } catch {}
    location.reload();
  }

  // ---- wspólne odświeżenie z licznikiem prób pod rząd ----
  let odliczam = false, stop = false;
  function przeladuj(klucz, powod, przed) {
    if (odliczam || stop) return;
    const z = czytaj(klucz) || { n: 0 };
    if (z.n >= MAX_Z_RZEDU) {                          // tyle razy pod rząd nic nie dało – alarm i stop
      stop = true;
      baner('🛑 AutoMap: ' + powod + ' – ' + z.n + ' odświeżeń pod rząd nie pomogło, zajrzyj (może restart przeglądarki)', '#b71c1c');
      if (!z.alarm) {
        z.alarm = true;
        sessionStorage.setItem(klucz, JSON.stringify(z));
        doLogu('🛑 ' + powod + ' – ' + z.n + ' odświeżeń pod rząd bez skutku, stop');
        ntfy('🛑 AutoMap stoi', powod + '\n' + z.n + ' odświeżeń pod rząd nie pomogło. Zajrzyj do przeglądarki.', 5);
      }
      return;
    }
    odliczam = true;
    z.n++;
    sessionStorage.setItem(klucz, JSON.stringify(z));
    if (przed) przed();
    const opis = powod + ' – odświeżam (próba ' + z.n + '/' + MAX_Z_RZEDU + ' pod rząd)';
    console.log('[AutoMap strażnik] ' + opis);
    doLogu('🔄 ' + opis);
    ntfy('🔄 ' + powod, 'Odświeżam (próba ' + z.n + '/' + MAX_Z_RZEDU + ' pod rząd).', 3);
    let sek = 5;
    const tik = () => baner('🔄 AutoMap: ' + opis + ' za ' + sek + ' s', '#ef6c00');
    tik();
    const t = setInterval(() => { sek--; tik(); if (sek <= 0) { clearInterval(t); odswiezSpokojnie(); } }, 1000);
  }

  // =====================================================================
  // CLOUDFLARE – nie klikamy, tylko alarm i czekanie na Ciebie
  // =====================================================================
  const tekstCF = /Verify you are human|Potwierdź, że jesteś człowiekiem|Sprawdź, czy jesteś człowiekiem|czy jesteś człowiekiem|checking your browser|Sprawdzanie przeglądarki/i;
  const jestCloudflare = (zTekstem) =>
    /just a moment|chwileczk|attention required|jeszcze chwil/i.test(document.title) ||
    !!document.querySelector('#challenge-form, #challenge-stage, #challenge-running, #cf-challenge-running, .cf-turnstile, iframe[src*="challenges.cloudflare.com"]') ||
    !!window._cf_chl_opt ||
    (zTekstem && document.body && document.getElementsByTagName('*').length < 400 && tekstCF.test(document.body.textContent.slice(0, 5000)));

  let cfOd = null;
  function obsluzCloudflare() {
    let w = null;
    try { w = JSON.parse(localStorage.getItem(L_CF) || 'null'); } catch {}
    if (!w || Date.now() - w.od > 6 * 3600000) {
      w = { od: Date.now() };
      localStorage.setItem(L_CF, JSON.stringify(w));
      doLogu('🛡 Cloudflare pyta, czy jesteś człowiekiem – czekam na potwierdzenie');
      ntfy('🛡 Cloudflare – potrzebne kliknięcie',
        'Base pokazał „Czy jesteś człowiekiem”. Podejdź do komputera i potwierdź.\nPo przejściu AutoMap rusza sam od miejsca, w którym stanął.', 5);
    }
    if (!cfOd) cfOd = Date.now();
    const min = Math.floor((Date.now() - w.od) / 60000);
    baner('🛡 Cloudflare: potwierdź, że jesteś człowiekiem. AutoMap czeka (' + min + ' min) i ruszy sam po przejściu.', '#6a1b9a');
    // wisi długo na tej samej stronie → zwykłe odświeżenie (max 3 razy), potem tylko czekamy
    if (Date.now() - cfOd > CLOUDFLARE_MIN * 60000) {
      const z = czytaj(K_CF) || { n: 0 };
      if (z.n < 3) {
        z.n++; sessionStorage.setItem(K_CF, JSON.stringify(z));
        doLogu('🛡 Cloudflare wisi ' + CLOUDFLARE_MIN + ' min – odświeżam (' + z.n + '/3)');
        cfOd = Date.now() + 3600000;   // nie powtarzaj w tym samym oknie
        odswiezSpokojnie();
      }
    }
  }
  function poCloudflare() {                            // normalna strona po weryfikacji
    let w = null;
    try { w = JSON.parse(localStorage.getItem(L_CF) || 'null'); } catch {}
    if (!w) return;
    localStorage.removeItem(L_CF);
    sessionStorage.removeItem(K_CF);
    if (NA_WYST) przywrocKroki();                      // kroki pominięte, gdy zamiast strony była weryfikacja
    const min = Math.round((Date.now() - w.od) / 60000);
    doLogu('✅ Cloudflare przeszedł (' + min + ' min) – lecę dalej');
    ntfy('✅ Cloudflare przeszedł', 'Weryfikacja trwała ok. ' + min + ' min. AutoMap leci dalej.', 3);
  }

  // =====================================================================
  // WYSTAWIANIE – 1) RENDER
  // =====================================================================
  const aktywnyWyst = () =>
    sessionStorage.getItem('am_' + LID + '_run') === '1' ||
    localStorage.getItem('autoCykl') === '1' ||
    !!sessionStorage.getItem('am_' + LID + '_odhacz') ||
    sessionStorage.getItem('am_' + LID + '_final') === '1';
  const wgrywaProdukty = () => !sessionStorage.getItem(K_ZNANA);   // produkty jeszcze wchodzą do formularza – NIE odświeżać

  let naglowek = null;
  const znajdzNaglowek = () => {
    if (naglowek && naglowek.isConnected) return naglowek;
    naglowek = document.evaluate("//*[normalize-space(text())='Ustawienia wspólne aukcji']", document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    return naglowek;
  };
  const panel = () => {
    const h = znajdzNaglowek();
    if (!h) return null;
    const wys = h.getBoundingClientRect().height || 20;
    let p = h;
    for (let i = 0; i < 8 && p.parentElement && p.parentElement !== document.body; i++) {
      p = p.parentElement;
      if (p.getBoundingClientRect().height > wys * 3) break;
    }
    return p;
  };
  const kreciSie = p => [...p.querySelectorAll('*')].some(e => {
    if (!widoczny(e)) return false;
    const cs = getComputedStyle(e);
    return (cs.animationName && cs.animationName !== 'none') || /spin|loader|loading|preload/i.test(klasa(e));
  });
  const polaWPanelu = p => [...p.querySelectorAll('select, input:not([type="hidden"]), textarea, .select2')].filter(widoczny).length;
  const operacjaMasowa = () => {
    const $ = window.jQuery;
    const b = document.getElementById('run_massive_action_button');
    return !!(($ && $('#run_massive_action_button').data('status') === 'processing') || (b && b.querySelector('.fa-spinner')));
  };
  const przyciskPrzerwij = () => [...document.querySelectorAll('.modal button')].find(x => widoczny(x) && /Przerwij/i.test(x.textContent));

  let panelZleOd = null, prodZleOd = null, renderOk = false;
  function sprawdzRender() {
    if (!aktywnyWyst() || wgrywaProdukty() || operacjaMasowa() || document.getElementById('automap-gotowe') || window.__baseAutoMap === 'PRZERWA') {
      panelZleOd = prodZleOd = null;
      return;
    }
    const teraz = Date.now();
    const mnoz = document.hidden ? 3 : 1;              // karta w tle – przeglądarka spowalnia, dajmy więcej czasu
    const p = panel();
    const panelZle = !!(p && kreciSie(p) && polaWPanelu(p) === 0);
    const prodZle = !document.querySelector('.lfi_param');
    panelZleOd = panelZle ? (panelZleOd || teraz) : null;
    prodZleOd = prodZle ? (prodZleOd || teraz) : null;
    if (!panelZle && !prodZle) {                       // wyrysowało się – licznik prób od zera
      if (!renderOk) { renderOk = true; sessionStorage.removeItem(K_REND); if (!odliczam) schowajBaner(); }
      return;
    }
    if (panelZleOd && teraz - panelZleOd > PANEL_SEK * 1000 * mnoz) {
      przeladuj(K_REND, 'strona się nie wyrysowała („Ustawienia wspólne aukcji” wiszą ' + Math.round((teraz - panelZleOd) / 1000) + ' s)', przywrocKroki);
    } else if (prodZleOd && teraz - prodZleOd > PRODUKTY_SEK * 1000 * mnoz) {
      przeladuj(K_REND, 'produkty się nie wyrysowały (' + Math.round((teraz - prodZleOd) / 1000) + ' s)', przywrocKroki);
    }
  }

  // =====================================================================
  // WYSTAWIANIE – 2) WYSYŁANIE OFERT
  // =====================================================================
  let wysPodpis = null, wysZmiana = 0, wysRuszylo = false;
  const podpisPostepu = btnPrzerwij => {
    const okno = btnPrzerwij.closest('.modal');
    const t = (okno ? okno.innerText : '') + ' ' + ((document.body.innerText.match(/Postęp:[^\n]*/) || [''])[0]);
    const liczby = t.match(/\d+\s*\/\s*\d+|\d+\s*%/g);
    let s = liczby ? liczby.join('|') : t.replace(/\s+/g, ' ').slice(0, 400);
    try {                                              // liczniki z danych Base, które AutoMap pisze w 📺
      const live = JSON.parse(localStorage.getItem('autoLive') || '{}');
      if (live.lid === LID && /^wystawiam/.test(live.tekst || '')) s += '#' + String(live.tekst).replace(/\s*–\s*⚠️ STOI.*$/, '');
    } catch {}
    return s;
  };
  function sprawdzWystawianie() {                      // true = trwa wysyłanie (render wtedy nie jest oceniany)
    const b = przyciskPrzerwij();
    if (!b) { wysPodpis = null; return false; }
    const teraz = Date.now();
    const p = podpisPostepu(b);
    if (p !== wysPodpis) {
      if (wysPodpis !== null && !wysRuszylo) {         // ruszyło – licznik prób od zera
        wysRuszylo = true;
        sessionStorage.removeItem(K_WYS);
        if (!odliczam) schowajBaner();
      }
      wysPodpis = p; wysZmiana = teraz;
      return true;
    }
    const minut = (teraz - wysZmiana) / 60000;
    if (minut >= WYSYLANIE_MIN) {
      przeladuj(K_WYS, 'wystawianie stoi od ' + Math.round(minut) + ' min', () => {
        // po odświeżeniu AutoMap pokaże okno GOTOWE (bez powtarzania kroków), a strażnik sam kliknie WYSTAW
        sessionStorage.setItem('am_' + LID + '_final', '1');
        sessionStorage.setItem(K_KLIK, String(Date.now()));
      });
    }
    return true;
  }
  function klikWystawPoOdswiezeniu() {
    const t = parseInt(sessionStorage.getItem(K_KLIK)) || 0;
    if (!t) return;
    if (Date.now() - t > 30 * 60000) { sessionStorage.removeItem(K_KLIK); return; }
    const b = document.querySelector('#automap-gotowe #am-wystaw');
    if (!b) return;
    sessionStorage.removeItem(K_KLIK);
    baner('🔁 AutoMap: ponawiam wystawianie…', '#2e7d32');
    doLogu('🔁 ponawiam wystawianie po odświeżeniu');
    setTimeout(() => { if (b.isConnected) b.click(); schowajBaner(); }, 3000);
  }

  // =====================================================================
  // PARAMETRY / MAPOWANIA – strona się nie wczytała
  // =====================================================================
  const aktywnyMap = () => {
    const etap = localStorage.getItem('autoCyklEtap');
    if (localStorage.getItem('autoCykl') === '1' && (etap === 'mapowania' || etap === 'mapowania2')) return true;
    try { const z = JSON.parse(localStorage.getItem('autoZadanieEanSku') || 'null'); return !!(z && Date.now() - z.t < 30 * 60000); } catch { return false; }
  };
  const mapowaniaWczytane = () => !!document.querySelector('tr.paramMappingRow') ||
    [...document.querySelectorAll('button')].some(b => /Dodaj parametr/.test(b.textContent) && widoczny(b));
  let mapZleOd = null, mapOk = false;
  function sprawdzMapowania() {
    if (!aktywnyMap()) { mapZleOd = null; return; }
    if (mapowaniaWczytane()) {
      mapZleOd = null;
      if (!mapOk) { mapOk = true; sessionStorage.removeItem(K_MAP); if (!odliczam) schowajBaner(); }
      return;
    }
    mapZleOd = mapZleOd || Date.now();
    const sek = (Date.now() - mapZleOd) / 1000;
    if (sek > MAPOWANIA_SEK * (document.hidden ? 2 : 1)) przeladuj(K_MAP, 'strona parametrów się nie wczytała (' + Math.round(sek) + ' s)');
  }

  // =====================================================================
  if (!jestCloudflare(true)) poCloudflare();
  setInterval(() => {
    try {
      if (stop) return;
      if (jestCloudflare(true)) { obsluzCloudflare(); return; }
      if (NA_WYST) {
        klikWystawPoOdswiezeniu();
        if (odliczam) return;
        if (sprawdzWystawianie()) { panelZleOd = prodZleOd = null; return; }
        sprawdzRender();
      } else if (NA_MAP) {
        if (!odliczam) sprawdzMapowania();
      }
    } catch (e) { console.log('[AutoMap strażnik] błąd', e); }
  }, CO_ILE_MS);
  // strona Cloudflare z samym tekstem (bez znanych elementów) – sprawdź też tekst na starcie
  setTimeout(() => { if (jestCloudflare(true)) obsluzCloudflare(); }, 1500);
})();
