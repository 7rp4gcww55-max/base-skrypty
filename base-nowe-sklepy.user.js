// ==UserScript==
// @name         Base NOWE SKLEPY – hurtownia → Wysyłam z Allegro, Allegro, katalogi, importy, waga
// @version      1.15
// @match        https://*.baselinker.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-nowe-sklepy.user.js
// @downloadURL  https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-nowe-sklepy.user.js
// ==/UserScript==
//
// Panel „📂 Nowe sklepy” (prawy dolny róg Base):
//  1) wybierasz hurtownię, wpisujesz konta Allegro → skrypt proponuje nr PRZE, zdjęcie i mnożnik (zasady: bez zdj. 1,
//     mnożnik ≥ 0,06 od zajętych, to samo zdjęcie tylko przy mnożniku różnym o ≥ 0,3), czas wysyłki z hurtowni (zmienisz)
//  2) Start → sam po kolei: dodaje „Wysyłam z Allegro” (HURTOWNIA AUTOMATIC PRZE-nr Sklep) i ją wypełnia,
//     integracja Allegro (zdjęcie, mnożnik, czas wysyłki…), katalog, import z hurtowni (jeden po drugim), waga z mnożnikiem.
//  Warunki zwrotów / gwarancje / producenta / cennik dostaw – NIE rusza.
//  „🏭 Hurtownie” – dane każdej hurtowni (kurier, magazyn, źródło importu, czas wysyłki), można dodać nową.

(() => {
  if (window.top !== window.self) return;
  if (window.__baseNoweSklepy2) return; window.__baseNoweSklepy2 = true;
  const W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;

  const DOMYSLNE = {"h": {"MOLOS": {"magazyn": "MOLOS V2", "import": "hurtownia", "zrodlo": "Hurtownia MOLOS V2", "kurier": {"osoba": "MOLOS", "firma": "MOLOS sp. z o.o.", "ulica": "Świerkowa 52", "kod": "05-850", "miasto": "Wieruchów", "telefon": "+48606480359", "email": "biuro@molos.com.pl"}, "aliasy": [], "czasWysylki": "24h", "zawszePaczkomat": false}, "F-TOYS": {"magazyn": "F-Toys", "import": "hurtownia", "zrodlo": "Hurtownia F-Toys", "kurier": {"osoba": "Plug & Play sp. z o.o.", "firma": "Plug & Play sp. z o.o.", "ulica": "Warszawska 4", "kod": "96-515", "miasto": "Seroki-Parcela", "telefon": "+48791996677", "email": "ftoys@ftoys.pl"}, "aliasy": [], "czasWysylki": "24h", "zawszePaczkomat": true}, "PRZEMYSŁOWA": {"magazyn": "Hurtownia Przemysłowa", "import": "baseconnect", "zrodlo": "Hurtownia Przemysłowa", "kurier": {"osoba": "Global Service Group Paweł Kapustka", "firma": "Global Service Group Paweł Kapustka", "ulica": "Urszuli 17", "kod": "65-147", "miasto": "Zielona Góra", "telefon": "+48683817000", "email": "kontakt@hurtowniaprzemyslowa.pl"}, "aliasy": ["PRZEMYSLOWA", "HURTOWNIA PRZEMYSŁOWA"], "czasWysylki": "48h", "zawszePaczkomat": false}, "BIZANTI": {"magazyn": "HURT BISANTI", "import": "baseconnect", "zrodlo": "BISANTI", "kurier": {"osoba": "PHU GERMAN", "firma": "PHU GERMAN", "ulica": "Bielska 103", "kod": "43-400", "miasto": "Cieszyn", "telefon": "+48577033555", "email": "info@bisanti.pl"}, "aliasy": ["BISANTI"], "czasWysylki": "24h", "zawszePaczkomat": false}, "LEAN": {"magazyn": "LEAN TOYS", "import": "hurtownia", "zrodlo": "Hurtownia LEAN TOYS", "kurier": {"osoba": "Magazyn LeanToys", "firma": "F.H. LEAN", "ulica": "Obrońców Poczty Gdańskiej 95", "kod": "42-400", "miasto": "Zawiercie", "telefon": "+48884877700", "email": "zamowienia@leantoys.pl"}, "aliasy": [], "czasWysylki": "24h", "zawszePaczkomat": false, "uzyte": [{"sklep": "LEAN-1", "mnoznik": 1.51, "zdjecie": 3}, {"sklep": "LEAN-3", "mnoznik": 1.74, "zdjecie": 4}, {"sklep": "LEAN-4", "mnoznik": 1.93, "zdjecie": 5}, {"sklep": "LEAN-5", "mnoznik": 1.21, "zdjecie": 6}], "maxZdjecie": 11}, "VILDE": {"magazyn": "Vilde", "import": "baseconnect", "zrodlo": "Vilde", "kurier": {"osoba": "Grupa Orion Sp. z o.o.", "firma": "Grupa Orion Sp. z o.o.", "ulica": "Wiejska 49", "kod": "41-253", "miasto": "Czeladź", "telefon": "+48322014082", "email": "info@vilde.pl"}, "aliasy": [], "czasWysylki": "24h", "zawszePaczkomat": false, "uzyte": [{"sklep": "stolipol", "mnoznik": 1.64, "zdjecie": 4}, {"sklep": "BengerV", "mnoznik": 1.31, "zdjecie": 5}, {"sklep": "milan", "mnoznik": 1.86, "zdjecie": 6}, {"sklep": "PierwszaPotrzeba", "mnoznik": 2.12, "zdjecie": 2}, {"sklep": "NaszSklepik", "mnoznik": 2.43, "zdjecie": 7}, {"sklep": "Nelior", "mnoznik": 2.81, "zdjecie": 8}, {"sklep": "KubkiGarnki", "mnoznik": 1.75, "zdjecie": 9}, {"sklep": "sususklep", "mnoznik": 1.21, "zdjecie": 10}, {"sklep": "gosposiav", "mnoznik": 1.5, "zdjecie": 11}], "maxZdjecie": 11}, "JUMI": {"magazyn": "JUMI", "import": "baseconnect", "zrodlo": "JUMI", "kurier": {"osoba": "JUMI", "firma": "JUMI", "ulica": "Myśliwska 34A", "kod": "95-200", "miasto": "Pabianice", "telefon": "+48422254800", "email": "Info@jumi.com.pl"}, "aliasy": [], "czasWysylki": "48h", "zawszePaczkomat": false}, "GERMAN": {"magazyn": "GERMAN HURT", "import": "baseconnect", "zrodlo": "GERMAN HURT", "kurier": {"osoba": "GERMAN Sp. z o.o.", "firma": "GERMAN Sp. z o.o.", "ulica": "Kwiatów Polnych 11", "kod": "22-400", "miasto": "Zamość", "telefon": "+48500564777", "email": "sklep@german.com.pl"}, "aliasy": [], "czasWysylki": "24h", "zawszePaczkomat": false}, "K2": {"magazyn": "K2distribution", "import": "baseconnect", "zrodlo": "K2distribution", "kurier": {"osoba": "Magazyn K2distribution", "firma": "Magazyn K2distribution", "ulica": "H. Sienkiewicza 46 / D12", "kod": "41-800", "miasto": "Zabrze", "telefon": "+48885777091", "email": "b2b@k2distribution.eu"}, "aliasy": [], "czasWysylki": "3d", "zawszePaczkomat": false}, "ERO HUR": {"magazyn": "EroHurtownia.pl", "import": "baseconnect", "zrodlo": "EroHurtownia.pl", "kurier": {"osoba": "HOLDING Sp. z o.o.", "firma": "HOLDING Sp. z o.o.", "ulica": "Świeradowska 47", "kod": "02-662", "miasto": "Warszawa", "telefon": "+48223905858", "email": "biuro@holdinghandlowy.pl"}, "aliasy": ["ERO HURT", "EROHURT", "HOLDING"], "czasWysylki": "24h", "zawszePaczkomat": true}, "BIO KOMINKI": {"magazyn": "Bio Kominki", "import": "baseconnect", "zrodlo": "Bio Kominki", "kurier": {"osoba": "BIO KOMINKI GTM", "firma": "BIO KOMINKI GTM", "ulica": "DWORCOWA 56", "kod": "76-004", "miasto": "Sianów", "telefon": "+48570980028", "email": "producent@biokominkigmt.pl"}, "aliasy": ["BIOKOMINKI"], "czasWysylki": "24h", "zawszePaczkomat": false}, "FURNITEX": {"magazyn": "FURNITEX", "import": "baseconnect", "zrodlo": "FURNITEX", "kurier": {"osoba": "Radosław Roszak", "firma": "FURNITEX Radosław Roszak & Adrian Roszak", "ulica": "Przemysłowa 85", "kod": "62-510", "miasto": "Konin", "telefon": "+48608357848", "email": "adrian.roszak@furnitex.pl"}, "aliasy": [], "czasWysylki": "24h", "zawszePaczkomat": false}, "ERO PLACE": {"magazyn": "BaseLinker Connect Eroplace.pl", "import": "baseconnect", "zrodlo": "BaseLinker Connect Eroplace.pl", "kurier": {"osoba": "ERO PLACE 2.0", "firma": "ERO PLACE 2.0", "ulica": "ul. Brzezina 18", "kod": "44-177", "miasto": "Chudów", "telefon": "+48669230967", "email": "hurtownia@eroplace.pl"}, "aliasy": [], "czasWysylki": "3d", "zawszePaczkomat": true}, "EROTIZO": {"magazyn": "Erotizo", "zrodlo": "Hurtownia Erotizo", "import": "hurtownia", "aliasy": ["EROTIZO.PL"], "kurier": {"osoba": "EROTIZO.PL", "firma": "EROTIZO.PL", "ulica": "Energetyków 23a lok. 94b", "kod": "20-468", "miasto": "Lublin", "telefon": "", "email": "kontakt@erotizo.pl"}, "czasWysylki": "3d", "zawszePaczkomat": true}, "STAVIORI": {"magazyn": "Staviori", "zrodlo": "Staviori", "import": "baseconnect", "aliasy": [], "kurier": {"osoba": "STAVIORI", "firma": "STAVIORI", "ulica": "Jeleniogórska 16", "kod": "60-179", "miasto": "POZNAŃ", "telefon": "+48500744070", "email": "b2b@staviori.pl"}, "czasWysylki": "24h", "zawszePaczkomat": false}, "HOME DESIGN": {"magazyn": "Home Design", "zrodlo": "Home Design", "import": "baseconnect", "aliasy": [], "kurier": {"osoba": "Home Design Sylwia Stefańska Sp.k", "firma": "Home Design Sylwia Stefańska Sp.k", "ulica": "Piłsudskiego 72", "kod": "10-450", "miasto": "Olsztyn", "telefon": "+48223574246", "email": "sklep@ubieramy-meble.pl"}, "czasWysylki": "24h", "zawszePaczkomat": false}, "SKLEP TECHNICZNY": {"magazyn": "Skleptechniczny", "zrodlo": "Skleptechniczny", "import": "baseconnect", "aliasy": ["KASTOR", "SKLEPTECHNICZNY"], "kurier": {"osoba": "FIRMA KASTOR WACŁAW WIECHA", "firma": "FIRMA KASTOR WACŁAW WIECHA", "ulica": "Solidarności 10", "kod": "32-800", "miasto": "Brzeska", "telefon": "+48668010255", "email": "skleptechniczny@skleptechniczny.pl"}, "czasWysylki": "24h", "zawszePaczkomat": false}}, "hist": [{"sklep": "IntimoStyl", "hurtownia": "F-TOYS", "nr": 1, "mnoznik": null, "zdjecie": null}, {"sklep": "VelveaShop", "hurtownia": "F-TOYS", "nr": 1, "mnoznik": 1.45, "zdjecie": 5}, {"sklep": "RubyNightPL", "hurtownia": "F-TOYS", "nr": 2, "mnoznik": 1.35, "zdjecie": 2}, {"sklep": "DiscretoPL", "hurtownia": "F-TOYS", "nr": 3, "mnoznik": 2.31, "zdjecie": 3}, {"sklep": "NocnyButik", "hurtownia": "ERO HUR", "nr": 1, "mnoznik": null, "zdjecie": null}, {"sklep": "ProfiPrzemysl", "hurtownia": "GERMAN", "nr": 1, "mnoznik": null, "zdjecie": null}, {"sklep": "DomowyKlimat", "hurtownia": "VILDE", "nr": 1, "mnoznik": 1.4, "zdjecie": 3}, {"sklep": "HomeStylPL", "hurtownia": "VILDE", "nr": 2, "mnoznik": 1.57, "zdjecie": 7}, {"sklep": "KuchniaDeco", "hurtownia": "VILDE", "nr": 3, "mnoznik": 1.98, "zdjecie": 10}, {"sklep": "WnetrzaPlus", "hurtownia": "VILDE", "nr": 4, "mnoznik": 2.27, "zdjecie": 5}, {"sklep": "CozyDom", "hurtownia": "VILDE", "nr": 5, "mnoznik": 1.15, "zdjecie": 8}, {"sklep": "PorzadekWDomuPL", "hurtownia": "VILDE", "nr": 6, "mnoznik": 2.62, "zdjecie": 9}, {"sklep": "KlockoweCentrum", "hurtownia": "LEAN", "nr": 1, "mnoznik": 1.33, "zdjecie": 2}, {"sklep": "PlacZabawPL", "hurtownia": "LEAN", "nr": 2, "mnoznik": 1.86, "zdjecie": 2}, {"sklep": "MisiowyKacik", "hurtownia": "LEAN", "nr": 3, "mnoznik": 1.12, "zdjecie": 3}, {"sklep": "ToyBazarPL", "hurtownia": "LEAN", "nr": 4, "mnoznik": 1.4, "zdjecie": 4}, {"sklep": "KreatywnyMaluch", "hurtownia": "LEAN", "nr": 5, "mnoznik": 1.62, "zdjecie": 5}, {"sklep": "ZabawkiTuTek", "hurtownia": "LEAN", "nr": 6, "mnoznik": 1.68, "zdjecie": 6}, {"sklep": "BajkowyStore", "hurtownia": "LEAN", "nr": 7, "mnoznik": 1.27, "zdjecie": 5}, {"sklep": "RadosnaJutka", "hurtownia": "LEAN", "nr": 8, "mnoznik": 1.06, "zdjecie": 4}]};
  const NADAWCA = { sender_name: 'TENEMONT SP. Z O.O.', sender_person: 'TENEMONT SP. Z O.O.', sender_address: 'Jana Brzechwy 2', sender_zipcode: '60-195', sender_city: 'POZNAŃ', sender_phone: '+48885777091', sender_email: 'tenemontsklep@gmail.com' };
  const WZA_WYBORY = { sender_country_code: 'Polska', pickup_country_code: 'Polska', printout_type: 'PDF', printout_format: 'A6', package_description: 'Login kupującego', reference_number: 'ID zamówienia',
    clean_reference_number: 'Tak', trim_long_address: 'Utnij powyżej limitu znaków dla danego przewoźnika', package_type: 'Paczka',
    cod_amount_type: 'Przyjmij kwotę zamówienia wraz z kosztami wysyłki (domyślnie)', insurance_amount_type: 'Stała wartość ubezpieczenia z pola poniżej', insurance_amount_type_cod: 'Stała wartość ubezpieczenia z pola poniżej' };
  const WZA_LICZBY = { insurance_constant_amount: '1.00', insurance_constant_amount_cod: '1.00' };
  const WZA_CHECK = { adapted_description_1: true };
  const BEZPIECZENSTWO = "Bezpieczeństwo użytkowania:\nProdukt jest bezpieczny w użytkowaniu zgodnie z jego przeznaczeniem i instrukcją producenta. Przed rozpoczęciem pracy należy zapoznać się z opisem produktu i instrukcją obsługi.\n\nŚrodki ostrożności:\n\nNależy używać odpowiedniego ubrania ochronnego, np. rękawic, okularów ochronnych lub odzieży zabezpieczającej, jeśli jest to narzędzie ręczne lub elektryczne.\n\nNie stosować produktu w sposób niezgodny z jego przeznaczeniem (np. cięcie materiałów twardszych niż przewidziano w specyfikacji).\n\nZachować ostrożność podczas pracy z ostrymi lub ruchomymi elementami (np. nożyce do prętów, strugi elektryczne).\n\nNie pozostawiać produktu w zasięgu dzieci ani osób nieprzeszkolonych, chyba że produkt jest przeznaczony dla dzieci i posiada odpowiednią informację w opisie.\n\nPrzechowywanie:\n\nProdukt należy przechowywać w suchym i bezpiecznym miejscu, z dala od źródeł ciepła i wilgoci.\n\nNarzędzia elektryczne należy przechowywać po odłączeniu od zasilania, z wyjętym wtykiem z gniazdka.\n\nOdpowiedzialność:\nProducent i sprzedawca nie ponoszą odpowiedzialności za szkody wynikające z nieprawidłowego użytkowania produktu lub użytkowania go niezgodnie z instrukcją.\n\nPodsumowanie:\nStosując się do powyższych zaleceń, produkt jest bezpieczny i zapewnia optymalne warunki pracy zgodnie z jego przeznaczeniem.";
  const STATUSY = { 473586: 'W realizacji', 473665: 'Do wysłania', 473587: 'Wysłane', 473666: 'Odebrana', 473667: 'Odebrana', 473588: 'Anulowane', 473589: 'Wstrzymane' };
  const PARAM_WAGA = 'Waga produktu z opakowaniem jednostkowym';
  const KROKI = ['dodajWza', 'wza', 'allegro', 'warunki', 'katalog', 'waga', 'finalAllegro', 'finalEan', 'import'];
  const OPIS = { dodajWza: 'dodanie Wysyłam z Allegro', wza: 'Wysyłam z Allegro – dane', allegro: 'integracja Allegro', warunki: 'cenniki dostaw i warunki', katalog: 'katalog', import: 'import z hurtowni', waga: 'parametry: waga z mnożnikiem', finalAllegro: 'finalne: integracja (szablon, zdjęcia)', finalEan: 'finalne: mapowanie EAN = SKU' };
  const WYBOR = [['wza', 'Wysyłam z Allegro'], ['allegro', 'Integracja Allegro (zdjęcie, mnożnik, czas…)'], ['warunki', 'Cenniki dostaw i warunki (zwroty, reklamacje, gwarancja, producent)'], ['katalog', 'Katalog'], ['waga', 'Parametry: waga z mnożnikiem'], ['import', 'Import produktów z hurtowni'],
    ['finalAllegro', 'FINALNE: integracja Allegro – szablon UNIWERSALNY, wszystkie zdjęcia z magazynu, kolejność zgodna z magazynem'], ['finalEan', 'FINALNE: parametry – mapowanie EAN = SKU']];
  const FINALNE = ['finalAllegro', 'finalEan'];
  const WARUNKI = [['cennik', 'cennik wysyłek (KURIER → PACZKOMAT)', 'link_delivery_schema'], ['zwroty', 'warunki zwrotów', 'return_policies_id'], ['reklamacje', 'reklamacje', 'implied_warranties_id'], ['gwarancja', 'gwarancja', 'warranties_id'], ['producent', 'dane producenta', 'link_responsible_producer']];
  const krokiZad = z => KROKI.filter(k => !z.kroki || z.kroki.includes(k));

  // ---------- pamięć ----------
  const L_H = 'nsHurtownie', L_HIST = 'nsHistoria', L_Z = 'nsZadanie2', L_LOG = 'nsLog', L_OST = 'nsOstatnie', L_OS = 'nsZmianaOsoby', L_OS_W = 'nsZmianaOsobyWynik';
  const czytaj = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
  const pisz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const hurtownie = () => { const h = czytaj(L_H, null); if (h) { if (h.LEAN && !localStorage.getItem('nsMigrLeanZdj11')) { if ((+h.LEAN.maxZdjecie || 6) < 11) h.LEAN.maxZdjecie = 11; pisz(L_H, h); localStorage.setItem('nsMigrLeanZdj11', '1'); } for (const [k, v] of Object.entries(DOMYSLNE.h)) if (!h[k]) h[k] = v; return h; } return JSON.parse(JSON.stringify(DOMYSLNE.h)); };
  const historia = () => { const x = czytaj(L_HIST, null); if (x) return x; return JSON.parse(JSON.stringify(DOMYSLNE.hist)); };
  const zad = () => czytaj(L_Z, null);
  const zapiszZad = z => pisz(L_Z, z);

  const czekaj = ms => new Promise(r => setTimeout(r, ms));
  const norm = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().toLowerCase();
  const nn = t => String(t || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]/g, '');
  const czekajNa = async (fn, t = 20000) => { for (let i = 0; i < t / 250; i++) { let x; try { x = fn(); } catch {} if (x) return x; await czekaj(250); } return null; };
  const $j = () => W.jQuery;
  const zmien = el => { const j = $j(); if (j) j(el).trigger('input').trigger('change'); else { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } };
  const widoczny = el => !!(el && (el.offsetParent || el.getClientRects().length));
  const telefon = t => { const c = String(t || '').replace(/\D/g, ''); return c ? '+48' + c.slice(-9) : ''; };
  const nazwaWza = (h, s) => `${String(h).toUpperCase()} AUTOMATIC PRZE-${s.nr} ${s.sklep}`;
  function czasTekst(v) {
    const t = String(v || '24h').trim().toLowerCase();
    const m = t.match(/^(\d+)\s*(h|godz\w*)$/); if (m) return m[1] + ' godzin';
    const d = t.match(/^(\d+)\s*(d|dni|dzie\w*)?$/); if (d) return d[1] + (d[1] === '1' ? ' dzień' : ' dni');
    return v;
  }
  function log(t) {
    const l = czytaj(L_LOG, []); l.push(new Date().toLocaleTimeString('pl-PL') + '  ' + t); pisz(L_LOG, l.slice(-300));
    console.log('[NoweSklepy]', t); rysujPanel();
  }
  function powiadom(tytul, tresc, prio = 3) {
    if (localStorage.getItem('autoNtfyOn') !== '1' || !localStorage.getItem('autoNtfyTemat')) return;
    fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({ topic: localStorage.getItem('autoNtfyTemat'), title: '📂 ' + tytul, message: tresc, priority: prio, tags: ['file_folder'] }) }).catch(() => {});
  }
  // okienka potwierdzeń Base – zawsze OK, żeby skrypt nie stawał
  function bezOkienek() { try { W.confirm = () => true; W.alert = m => log('okno: ' + m); } catch {} }

  // ---------- propozycja zdjęć i mnożników ----------
  function zajete(klucz, pomin = []) {
    const h = hurtownie()[klucz] || {};
    const z = (h.uzyte || []).map(u => ({ sklep: u.sklep, m: +u.mnoznik, z: +u.zdjecie }));
    for (const x of historia()) if (nn(x.hurtownia) === nn(klucz) && x.mnoznik && x.zdjecie && !pomin.includes(nn(x.sklep))) z.push({ sklep: x.sklep, m: +x.mnoznik, z: +x.zdjecie });
    return z;
  }
  // linie: "Sklep [PRZE-nr|nr] [mnożnik] [zdjęcie]" – np. "ProfiPrzemysl 1 1.45 3", "Sklep 1.45 3", "Sklep ×1.45/3", "Sklep" (samo konto)
  function parsujSklepy(txt) {
    const out = [];
    for (const linia of String(txt || '').split(/\n+/)) {
      const tok = linia.trim().split(/[\s;\t|]+/).filter(Boolean);
      if (!tok.length) continue;
      const nazwy = [], ints = [], r = {};
      for (const t of tok) {
        let m;
        if ((m = t.match(/^PRZE-?(\d+)$/i))) r.nr = +m[1];
        else if ((m = t.match(/^[x×*]?(\d+(?:[.,]\d+)?)\/(\d+)$/i))) { r.mnoznik = +m[1].replace(',', '.'); r.zdjecie = +m[2]; }
        else if ((m = t.match(/^[x×*](\d+(?:[.,]\d+)?)$/i)) || (m = t.match(/^(\d+[.,]\d+)$/))) r.mnoznik = +m[1].replace(',', '.');
        else if ((m = t.match(/^(?:zdj\.?|z)(\d+)$/i))) r.zdjecie = +m[1];
        else if (/^\d+$/.test(t)) ints.push(+t);
        else nazwy.push(t);
      }
      if (!nazwy.length) continue;
      if (r.zdjecie == null && ints.length) r.zdjecie = ints.pop();
      if (r.nr == null && ints.length) r.nr = ints.pop();
      const nazwa = nazwy.join(' ');
      if (r.mnoznik == null && r.zdjecie == null && r.nr == null && nazwa.includes(',')) { nazwa.split(',').map(x => x.trim()).filter(Boolean).forEach(x => out.push({ sklep: x })); continue; }
      out.push({ sklep: nazwa, ...r });
    }
    return out;
  }
  // wpisane: { nn(sklep): { nr, mnoznik, zdjecie } } – to, co wpisałeś, zostaje; reszta dobierana tak, żeby nie kolidowała
  function zaproponuj(klucz, sklepy, wpisane = {}) {
    const h = hurtownie()[klucz] || {};
    const maxZ = +h.maxZdjecie || 6, maxM = +h.maxMnoznik || 1.99, minM = +h.minMnoznik || 1.05;
    const hist = historia();
    const uzyte = zajete(klucz, sklepy.map(nn));
    let nr = hist.filter(x => nn(x.hurtownia) === nn(klucz)).reduce((m, x) => Math.max(m, +x.nr || 0), 0);
    for (const s of sklepy) { const w = wpisane[nn(s)]; if (w && +w.nr > nr) nr = +w.nr; }
    const stale = {};
    for (const s of sklepy) {
      const w = wpisane[nn(s)] || {}, jest = hist.find(x => nn(x.sklep) === nn(s) && nn(x.hurtownia) === nn(klucz));
      if (w.mnoznik != null && w.zdjecie != null) stale[nn(s)] = { m: +w.mnoznik, z: +w.zdjecie, wpisane: true };
      else if (w.mnoznik == null && w.zdjecie == null && jest && jest.mnoznik && jest.zdjecie) stale[nn(s)] = { m: +jest.mnoznik, z: +jest.zdjecie, zHistorii: true, czas: jest.czas };
    }
    for (const k in stale) uzyte.push({ m: stale[k].m, z: stale[k].z });
    return sklepy.map(s => {
      const w = wpisane[nn(s)] || {}, jest = hist.find(x => nn(x.sklep) === nn(s) && nn(x.hurtownia) === nn(klucz)), st = stale[nn(s)];
      const numer = w.nr != null ? +w.nr : jest && +jest.nr ? +jest.nr : ++nr;
      if (st) return { sklep: s, nr: numer, mnoznik: st.m.toFixed(2), zdjecie: st.z, czas: (st.zHistorii && st.czas) || h.czasWysylki || '24h', zHistorii: !!st.zHistorii, wpisane: !!st.wpisane };
      let best = null;
      const mOd = w.mnoznik != null ? Math.round(+w.mnoznik * 100) : Math.round(minM * 100), mDo = w.mnoznik != null ? mOd : Math.round(maxM * 100);
      for (let m = mOd; m <= mDo; m++) {
        const mm = m / 100, odl = uzyte.length ? Math.min(...uzyte.map(u => Math.abs(u.m - mm))) : 9;
        if (w.mnoznik == null && odl < 0.06 - 1e-9) continue;
        for (let z = w.zdjecie != null ? +w.zdjecie : 2; z <= (w.zdjecie != null ? +w.zdjecie : maxZ); z++) {
          if (w.zdjecie == null && w.mnoznik == null && uzyte.some(u => u.z === z && Math.abs(u.m - mm) < 0.3 - 1e-9)) continue;
          const kol = uzyte.some(u => u.z === z && Math.abs(u.m - mm) < 0.3 - 1e-9) ? 5 : 0;
          const ocena = Math.min(odl, 0.2) * 10 - uzyte.filter(u => u.z === z).length - Math.abs(mm - (minM + maxM) / 2) * 0.5 - kol;
          if (!best || ocena > best.ocena) best = { m: mm, z, ocena };
        }
      }
      const r = { sklep: s, nr: numer, czas: h.czasWysylki || '24h', wpisane: w.mnoznik != null || w.zdjecie != null };
      if (best) { uzyte.push({ m: best.m, z: best.z }); r.mnoznik = best.m.toFixed(2); r.zdjecie = best.z; } else { r.mnoznik = ''; r.zdjecie = ''; }
      return r;
    });
  }
  function sprawdzZasady(klucz, w) {
    const b = [];
    const inne = zajete(klucz, w.map(x => nn(x.sklep)));
    const wszystkie = [...inne.map(u => ({ sklep: u.sklep, m: u.m, z: u.z, stare: true })), ...w.map(x => ({ sklep: x.sklep, m: +x.mnoznik, z: +x.zdjecie }))];
    for (const x of w) { if (+x.zdjecie === 1) b.push(x.sklep + ': zdjęcie nr 1'); if (!(+x.mnoznik > 0) || !(+x.zdjecie > 0)) b.push(x.sklep + ': brak zdjęcia/mnożnika'); }
    for (let i = 0; i < wszystkie.length; i++) for (let j = i + 1; j < wszystkie.length; j++) {
      const a = wszystkie[i], c = wszystkie[j]; if (a.stare && c.stare) continue;
      const d = Math.abs(a.m - c.m);
      if (d < 0.06 - 1e-9) b.push(a.sklep + ' i ' + c.sklep + ': mnożniki za blisko (' + a.m + ' / ' + c.m + ')');
      if (a.z === c.z && d < 0.3 - 1e-9) b.push(a.sklep + ' i ' + c.sklep + ': to samo zdjęcie ' + a.z + ' przy podobnym mnożniku');
    }
    return b;
  }
  function brakiHurtowni(h) {
    const k = (h && h.kurier) || {}, b = [];
    for (const [p, n] of [['firma', 'firma'], ['osoba', 'imię i nazwisko'], ['ulica', 'ulica'], ['kod', 'kod'], ['miasto', 'miasto'], ['telefon', 'telefon'], ['email', 'e-mail']]) if (!k[p]) b.push(n);
    if (!h.czasWysylki || h.czasWysylki === '?') b.push('czas wysyłki');
    if (!h.magazyn) b.push('magazyn w Base');
    return b;
  }

  // =====================================================================
  // PANEL
  // =====================================================================
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:12px;bottom:56px;z-index:9999998;background:#1e2a38;color:#fff;font:12px/1.4 -apple-system,sans-serif;padding:8px 10px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.5);width:340px';
  document.body.appendChild(panel);
  let logOtwarty = false;
  function rysujPanel() {
    const z = zad();
    const btn = (id, t, k) => `<button id="${id}" style="background:${k};color:#fff;border:0;border-radius:6px;padding:5px 8px;font:bold 12px sans-serif;cursor:pointer">${t}</button>`;
    let stan = 'gotowy';
    const zmOs = czytaj(L_OS, null);
    const ost = !z && czytaj(L_OST, null);
    if (ost) { const r = wynik(ost); stan = 'gotowy · ostatnio ' + ost.hurtownia + ': ' + r.ok + '/' + r.wszystkie + ' ✔' + (r.zle ? ' · <span style="color:#ff8a87">' + r.zle + ' nie przeszło</span>' : '') + (ost.zatrzymane ? ' (zatrzymane)' : ''); }
    if (z) { const n = nastepny(z); const K = krokiZad(z); const zr = z.sklepy.reduce((a, s) => a + K.filter(k => s.ok[k] === true).length, 0); stan = (z.pauza ? '⏸ pauza · ' : '▶ ') + z.hurtownia + ' · ' + zr + '/' + z.sklepy.length * K.length + (n ? ' · teraz: ' + OPIS[n.typ] + ' ' + n.s.sklep : ' · koniec'); }
    const l = czytaj(L_LOG, []);
    panel.innerHTML = `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
      <b id="ns-uchwyt" title="Przeciągnij, żeby przesunąć · 2× klik = wróć na miejsce" style="margin-right:auto;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none">⠿ 📂 Nowe sklepy</b>
      ${btn('ns-nowe', '+ Nowe', '#2e7d32')}${btn('ns-hurt', '🏭', '#455a64')}${btn('ns-osoba', '👤', '#5d4037')}${z ? btn('ns-pauza', z.pauza ? '▶' : '⏸', '#ef6c00') + btn('ns-stop', '⏹ Stop', '#c62828') : ''}${btn('ns-log', logOtwarty ? '▾' : '▸', '#37474f')}</div>
      <div style="margin-top:5px;opacity:.9;word-break:break-word">${stan}</div>
      ${zmOs ? '<div style="margin-top:5px;padding:5px;background:#3e2723;border-radius:6px">👤 Osoba kontaktowa WzA: ' + Math.min(zmOs.i, zmOs.lista.length) + '/' + zmOs.lista.length + (zmOs.lista[zmOs.i] ? ' · teraz: ' + esc(zmOs.lista[zmOs.i].nazwa.slice(0, 40)) : '') + ' ' + btn('ns-osoba-stop', '⏹', '#c62828') + '</div>' : ''}
      ${ost ? '<div style="margin-top:5px;display:flex;gap:5px">' + btn('ns-pods', '📋 Podsumowanie', '#1565c0') + (wynik(ost).zle ? btn('ns-powt', '🔁 Powtórz nieudane', '#6a1b9a') : '') + '</div>' : ''}
      ${z ? '<div style="opacity:.6;font-size:11px;margin-top:3px">' + krokiZad(z).map((k, i) => (i + 1) + '=' + OPIS[k]).join(' · ') + '</div>' : ''}
      ${z ? '<div style="margin-top:5px;max-height:120px;overflow:auto">' + z.sklepy.map(s => '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + s.sklep + ' ' + krokiZad(z).map(k => s.ok[k] === true ? '✅' : s.ok[k] ? '❌' : '·').join('') + '</div>').join('') + '</div>' : ''}
      ${logOtwarty ? '<div style="margin-top:6px;max-height:220px;overflow:auto;background:#0f1720;border-radius:6px;padding:6px;font:11px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap">' + l.slice(-120).reverse().map(x => x.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))).join('\n') + '</div>' : ''}`;
    panel.querySelector('#ns-nowe').onclick = oknoNowe;
    panel.querySelector('#ns-hurt').onclick = oknoHurtownie;
    panel.querySelector('#ns-osoba').onclick = () => { const w = czytaj(L_OS_W, null); if (w && !czytaj(L_OS, null) && confirm('Pokazać wynik ostatniej zmiany osoby kontaktowej?\n(Anuluj = zacznij nową zmianę)')) return oknoOsobaWynik(); startZmianaOsoby(); };
    const os = panel.querySelector('#ns-osoba-stop'); if (os) os.onclick = () => { const j = czytaj(L_OS, null); if (j) { j.stop = true; pisz(L_OS, j); log('👤 zatrzymuję zmianę osoby…'); } };
    panel.querySelector('#ns-log').onclick = () => { logOtwarty = !logOtwarty; rysujPanel(); };
    const pd = panel.querySelector('#ns-pods'); if (pd) pd.onclick = () => oknoPodsumowanie();
    const pw = panel.querySelector('#ns-powt'); if (pw) pw.onclick = () => powtorz(czytaj(L_OST, null), 'nieudane');
    const p = panel.querySelector('#ns-pauza'); if (p) p.onclick = () => { const z = zad(); z.pauza = !z.pauza; zapiszZad(z); rysujPanel(); if (!z.pauza) setTimeout(() => location.reload(), 300); };
    const s = panel.querySelector('#ns-stop'); if (s) s.onclick = () => { if (confirm('ZATRZYMAĆ bota? (to, co zrobione, zostaje w Base)')) { const zz = zad(); if (zz) pisz(L_OST, { ...zz, koniec: Date.now(), zatrzymane: true }); localStorage.removeItem(L_Z); log('⏹ zatrzymane ręcznie'); setTimeout(() => location.reload(), 200); } };
    if (panel.style.top && panel.style.top !== 'auto') requestAnimationFrame(() => ustawPozycje(parseFloat(panel.style.left) || 0, parseFloat(panel.style.top) || 0));
  }

  // ---- przesuwanie panelu (chwyć za „⠿ 📂 Nowe sklepy”) + zapamiętanie miejsca w tym profilu ----
  const L_POZ_NS = 'nsPanelPozycja';
  function ustawPozycje(x, y) {
    const r = panel.getBoundingClientRect();
    x = Math.min(Math.max(0, x), window.innerWidth - Math.min(r.width, window.innerWidth));
    y = Math.min(Math.max(0, y), window.innerHeight - Math.min(r.height, window.innerHeight));
    panel.style.left = x + 'px'; panel.style.top = y + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  }
  try { const poz = JSON.parse(localStorage.getItem(L_POZ_NS) || 'null'); if (poz) requestAnimationFrame(() => ustawPozycje(poz.x, poz.y)); } catch {}
  let ciagnie = null;
  panel.addEventListener('pointerdown', e => {
    if (!e.target.closest || !e.target.closest('#ns-uchwyt')) return;
    const r = panel.getBoundingClientRect();
    ciagnie = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    try { panel.setPointerCapture(e.pointerId); } catch {}
    const u = panel.querySelector('#ns-uchwyt'); if (u) u.style.cursor = 'grabbing';
    e.preventDefault();
  });
  panel.addEventListener('pointermove', e => { if (ciagnie) ustawPozycje(e.clientX - ciagnie.dx, e.clientY - ciagnie.dy); });
  const puscPanel = () => {
    if (!ciagnie) return;
    ciagnie = null;
    const u = panel.querySelector('#ns-uchwyt'); if (u) u.style.cursor = 'grab';
    const r = panel.getBoundingClientRect();
    try { localStorage.setItem(L_POZ_NS, JSON.stringify({ x: r.left, y: r.top })); } catch {}
  };
  panel.addEventListener('pointerup', puscPanel);
  panel.addEventListener('pointercancel', puscPanel);
  panel.addEventListener('dblclick', e => {
    if (!e.target.closest || !e.target.closest('#ns-uchwyt')) return;
    try { localStorage.removeItem(L_POZ_NS); } catch {}
    panel.style.left = 'auto'; panel.style.top = 'auto'; panel.style.right = '12px'; panel.style.bottom = '56px';
  });
  window.addEventListener('resize', () => { if (panel.style.top && panel.style.top !== 'auto') ustawPozycje(parseFloat(panel.style.left) || 0, parseFloat(panel.style.top) || 0); });

  const nakladka = html => {
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    o.innerHTML = `<div style="background:#1e2a38;color:#fff;padding:18px;border-radius:12px;width:min(1100px,96vw);max-height:92vh;overflow:auto;font:13px sans-serif">${html}</div>`;
    document.body.appendChild(o); return o;
  };
  const pole = 'background:#0f1720;color:#fff;border:1px solid #37474f;border-radius:6px;padding:5px 7px;font:13px sans-serif';
  const przycisk = k => `background:${k};color:#fff;border:0;border-radius:6px;padding:7px 12px;font:bold 13px sans-serif;cursor:pointer`;
  const CZASY = [['24h', '24 godziny'], ['48h', '48 godzin'], ['3d', '3 dni'], ['4d', '4 dni'], ['5d', '5 dni'], ['7d', '7 dni']];
  const selCzas = (v, attr = '') => { const o = CZASY.some(c => c[0] === v) ? CZASY : [...CZASY, [v, v]]; return `<select ${attr} style="${pole}">${o.map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`; };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- podsumowanie / powtórka ----------
  const stanKroku = (s, k) => s.ok[k] === true ? 'ok' : s.ok[k] ? 'blad' : 'brak';
  function wynik(z) {
    const K = krokiZad(z); let ok = 0, zle = 0;
    for (const s of z.sklepy) for (const k of K) { if (stanKroku(s, k) === 'ok') ok++; else zle++; }
    return { ok, zle, wszystkie: z.sklepy.length * K.length, K };
  }
  function powtorz(z, tryb, sklepy) {
    if (!z) return alert('Brak ostatniego zadania');
    if (zad() && !confirm('Jest zadanie w toku. Zastąpić je powtórką?')) return;
    const K = krokiZad(z), wyb = sklepy ? new Set(sklepy.map(nn)) : null;
    const lista = z.sklepy.filter(s => (!wyb || wyb.has(nn(s.sklep))) && (tryb === 'wszystko' || K.some(k => stanKroku(s, k) !== 'ok')));
    if (!lista.length) return alert('Nie ma czego powtarzać – wszystko przeszło ✔');
    const nowe = lista.map(s => {
      const ok = {}; if (tryb !== 'wszystko') for (const k of K) if (s.ok[k] === true) ok[k] = true;
      const war = z.warunki || [];
      return { ...s, ok, proby: {}, odswC: ok.warunki ? s.odswC : !war.includes('cennik'), odswP: ok.warunki ? s.odswP : !war.includes('producent') };
    });
    const opis = nowe.map(s => s.sklep + ': ' + K.filter(k => !s.ok[k]).map(k => OPIS[k]).join(', ')).join('\n');
    if (!confirm('Powtórzyć (' + z.hurtownia + ')?\n\n' + opis)) return;
    document.querySelectorAll('.ns-pods-okno').forEach(x => x.remove());
    pisz(L_LOG, []);
    zapiszZad({ hurtownia: z.hurtownia, kroki: z.kroki, warunki: z.warunki, tylkoZnajdzKatalog: z.tylkoZnajdzKatalog, start: Date.now(), powtorka: true, sklepy: nowe });
    log('🔁 POWTÓRKA ' + z.hurtownia + ' (' + (tryb === 'wszystko' ? 'wszystko' : 'nieudane') + '): ' + nowe.map(s => s.sklep).join(', '));
    powiadom('Powtórka nowych sklepów', z.hurtownia + ': ' + nowe.map(s => s.sklep).join(', '));
    rysujPanel(); setTimeout(silnik, 500);
  }
  function oknoPodsumowanie() {
    const z = czytaj(L_OST, null); if (!z) return alert('Brak podsumowania – żadne zadanie jeszcze się nie skończyło');
    document.querySelectorAll('.ns-pods-okno').forEach(x => x.remove());
    const r = wynik(z), K = r.K;
    const czas = z.start && z.koniec ? Math.round((z.koniec - z.start) / 60000) + ' min' : '';
    const ikona = (s, k) => { const st = stanKroku(s, k); return st === 'ok' ? '✅' : st === 'blad' ? '<span title="' + esc(s.ok[k]) + '">❌</span>' : '<span title="nie zrobione (wcześniejszy krok nie przeszedł albo zadanie przerwane)">⏸</span>'; };
    const bledy = z.sklepy.flatMap(s => K.filter(k => stanKroku(s, k) !== 'ok').map(k => ({ sklep: s.sklep, krok: OPIS[k], powod: stanKroku(s, k) === 'blad' ? s.ok[k] : 'nie zrobione (wcześniejszy krok nie przeszedł albo zadanie przerwane)' })));
    const o = nakladka(`<div style="font-size:17px;font-weight:bold;margin-bottom:6px">📋 Podsumowanie – ${esc(z.hurtownia)}${z.zatrzymane ? ' <span style="color:#ffb74d">(zatrzymane ręcznie)</span>' : ''}${z.powtorka ? ' <span style="opacity:.6">(powtórka)</span>' : ''}</div>
      <div style="margin-bottom:10px;opacity:.85">${z.koniec ? new Date(z.koniec).toLocaleString('pl-PL') : ''}${czas ? ' · trwało ' + czas : ''} · sklepów: ${z.sklepy.length} · kroków OK: <b style="color:#7ee2a8">${r.ok}</b>/${r.wszystkie}${r.zle ? ' · nie przeszło: <b style="color:#ff8a87">' + r.zle + '</b>' : ' · <b style="color:#7ee2a8">wszystko ✔</b>'}</div>
      <table style="width:100%;border-collapse:collapse"><tr style="opacity:.7;text-align:left"><th><input type="checkbox" id="p-wsz"></th><th>Sklep</th><th>Nazwa</th><th>×/zdj.</th>${K.map(k => '<th style="font-size:11px;text-align:center;max-width:90px">' + esc(OPIS[k]) + '</th>').join('')}</tr>
        ${z.sklepy.map(s => { const zly = K.some(k => stanKroku(s, k) !== 'ok'); return `<tr style="border-top:1px solid #2c3e50${zly ? ';background:rgba(255,82,82,.08)' : ''}"><td><input type="checkbox" class="p-s" value="${esc(s.sklep)}" ${zly ? 'checked' : ''}></td><td><b>${esc(s.sklep)}</b></td><td style="opacity:.75;font-size:12px">${esc(nazwaWza(z.hurtownia, s))}</td><td style="opacity:.75">${s.mnoznik}/${s.zdjecie}</td>${K.map(k => '<td style="text-align:center">' + ikona(s, k) + '</td>').join('')}</tr>`; }).join('')}</table>
      ${bledy.length ? '<div style="margin-top:12px"><b style="color:#ff8a87">Co nie przeszło:</b><div style="margin-top:4px;max-height:200px;overflow:auto;background:#0f1720;border-radius:6px;padding:8px;font:12px/1.5 ui-monospace,Menlo,monospace">' + bledy.map(b => '<div><b>' + esc(b.sklep) + '</b> – ' + esc(b.krok) + ': <span style="color:#ffab91">' + esc(b.powod) + '</span></div>').join('') + '</div></div>' : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
        <button id="p-log" style="${przycisk('#37474f')}">📜 Log</button>
        <button id="p-kopiuj" style="${przycisk('#37474f')}">📋 Kopiuj</button>
        ${bledy.length ? `<button id="p-nieudane" style="${przycisk('#6a1b9a')}">🔁 Powtórz nieudane (zaznaczone)</button>` : ''}
        <button id="p-wszystko" style="${przycisk('#455a64')}">🔁 Powtórz wszystko (zaznaczone)</button>
        <button id="p-zamknij" style="${przycisk('#555')}">Zamknij</button></div>`);
    o.classList.add('ns-pods-okno');
    const zazn = () => [...o.querySelectorAll('.p-s:checked')].map(c => c.value);
    o.querySelector('#p-wsz').onchange = e => o.querySelectorAll('.p-s').forEach(c => c.checked = e.target.checked);
    o.querySelector('#p-zamknij').onclick = () => o.remove();
    o.querySelector('#p-log').onclick = () => { o.remove(); logOtwarty = true; rysujPanel(); };
    o.querySelector('#p-kopiuj').onclick = () => {
      const t = 'Nowe sklepy – ' + z.hurtownia + ' – ' + r.ok + '/' + r.wszystkie + ' OK\n' + z.sklepy.map(s => s.sklep + ' (×' + s.mnoznik + '/' + s.zdjecie + '): ' + K.map(k => (stanKroku(s, k) === 'ok' ? '✔ ' : '✖ ') + OPIS[k]).join(', ')).join('\n') + (bledy.length ? '\n\nNie przeszło:\n' + bledy.map(b => b.sklep + ' – ' + b.krok + ': ' + b.powod).join('\n') : '');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => alert('Skopiowane'), () => prompt('Skopiuj:', t));
    };
    const nb = o.querySelector('#p-nieudane'); if (nb) nb.onclick = () => { const z1 = zazn(); if (!z1.length) return alert('Zaznacz sklepy'); powtorz(z, 'nieudane', z1); };
    o.querySelector('#p-wszystko').onclick = () => { const z1 = zazn(); if (!z1.length) return alert('Zaznacz sklepy'); powtorz(z, 'wszystko', z1); };
  }

  function oknoNowe() {
    if (zad() && !confirm('Jest zadanie w toku. Zacząć nowe (stare przestanie)?')) return;
    const H = hurtownie();
    const o = nakladka(`<div style="font-size:17px;font-weight:bold;margin-bottom:10px">📂 Nowe sklepy – nazwa zawsze: HURTOWNIA AUTOMATIC PRZE-nr Sklep</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <div>Hurtownia<br><select id="n-h" style="${pole}">${Object.keys(H).map(k => `<option>${esc(k)}</option>`).join('')}</select>
          <div style="margin-top:8px">Czas wysyłki (dla wszystkich)<br><span id="n-czas-box"></span></div>
          <div style="margin-top:10px"><b>Co zrobić</b> <a href="#" id="n-wsz" style="color:#90caf9;font-size:12px">przeróbka – wszystko</a> · <a href="#" id="n-fin" style="color:#90caf9;font-size:12px">przygotuj do finalnego</a> · <a href="#" id="n-nic" style="color:#90caf9;font-size:12px">nic</a>
            ${WYBOR.map(([k, t]) => `<label style="display:block;margin-top:3px;max-width:330px${FINALNE.includes(k) ? ';color:#90caf9' : ''}"><input type="checkbox" class="n-krok" value="${k}" ${FINALNE.includes(k) ? '' : 'checked'}> ${k === 'warunki' ? 'Cenniki dostaw i warunki:' : t}</label>${k === 'warunki' ? '<div style="margin-left:22px">' + WARUNKI.map(([w, wt]) => `<label style="display:block;font-size:12px"><input type="checkbox" class="n-war" value="${w}" checked> ${wt}</label>`).join('') + '</div>' : ''}`).join('')}</div></div>
        <div>Sklepy tej hurtowni (zaznacz) <a href="#" id="n-ist-wsz" style="color:#90caf9;font-size:12px">wszystkie</a><br><div id="n-ist" style="${pole};width:240px;height:150px;overflow:auto"></div>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap"><button id="n-ist-usun" style="${przycisk('#b71c1c')};padding:3px 8px;font-size:12px">🗑 Usuń zaznaczone</button>
            <button id="n-ist-przen" style="${przycisk('#455a64')};padding:3px 8px;font-size:12px">↪ Przenieś do…</button></div>
          <div style="margin-top:8px">Nowe konta Allegro (jedno w linii)<br><span style="font-size:11px;opacity:.7">można od razu dać swoje: Sklep mnożnik zdjęcie</span><br><textarea id="n-s" style="${pole};width:240px;height:90px" placeholder="NowySklep&#10;InnySklep 1.45 3"></textarea></div>
          <div style="margin-top:8px">Wcześniej zrobione sklepy (do bazy)<br><span style="font-size:11px;opacity:.7">Sklep [nr] mnożnik zdjęcie – jedno w linii</span><br><textarea id="n-stare" style="${pole};width:240px;height:70px" placeholder="ProfiPrzemysl 1 1.45 3&#10;StarySklep 1.80 4"></textarea>
            <br><button id="n-stare-zap" style="${przycisk('#6a1b9a')};margin-top:4px">💾 Dopisz do bazy</button></div></div>
        <div style="flex:1;min-width:260px"><div id="n-info" style="opacity:.85"></div>
          <button id="n-prop" style="${przycisk('#1565c0')};margin-top:8px">① Zaproponuj nr, zdjęcia i mnożniki</button></div>
      </div>
      <div id="n-tab" style="margin-top:12px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button id="n-anuluj" style="${przycisk('#555')}">Anuluj</button><button id="n-start" style="${przycisk('#2e7d32')};display:none">② Start</button></div>`);
    let wiersze = [];
    const hSel = o.querySelector('#n-h');
    const info = () => {
      const k = hSel.value, h = H[k], br = brakiHurtowni(h), z = zajete(k);
      o.querySelector('#n-czas-box').innerHTML = selCzas(h.czasWysylki || '24h', 'id="n-czas"');
      o.querySelector('#n-info').innerHTML = (br.length ? '<span style="color:#ff8a87">⚠ Brakuje danych hurtowni: ' + esc(br.join(', ')) + ' – uzupełnij w 🏭</span><br>' : '<span style="color:#7ee2a8">✔ dane hurtowni kompletne</span><br>') +
        'Magazyn: ' + esc(h.magazyn || '—') + ' · import: ' + esc(h.import) + ' (' + esc(h.zrodlo || h.magazyn || '—') + ')<br>' +
        'Max zdjęć: ' + (h.maxZdjecie || 6) + ' · max mnożnik: ' + (h.maxMnoznik || 1.99) + '<br>Zajęte: ' + (z.map(u => esc(u.sklep) + ' ×' + u.m.toFixed(2) + '/' + u.z).join(', ') || 'brak');
    };
    const istniejace = () => {
      const lista = historia().filter(x => nn(x.hurtownia) === nn(hSel.value)).sort((a, b) => (+a.nr || 0) - (+b.nr || 0));
      o.querySelector('#n-ist').innerHTML = lista.length ? lista.map(x => `<label style="display:block"><input type="checkbox" class="n-ist" value="${esc(x.sklep)}"> ${+x.nr ? 'PRZE-' + x.nr : '(bez nr)'} ${esc(x.sklep)}${x.mnoznik ? ' <span style="opacity:.6">×' + (+x.mnoznik).toFixed(2) + '/' + x.zdjecie + '</span>' : ''}</label>`).join('') : '<span style="opacity:.6">brak</span>';
    };
    hSel.onchange = () => { info(); istniejace(); }; info(); istniejace();
    o.querySelector('#n-wsz').onclick = e => { e.preventDefault(); o.querySelectorAll('.n-krok').forEach(c => c.checked = !FINALNE.includes(c.value)); };
    o.querySelector('#n-fin').onclick = e => { e.preventDefault(); o.querySelectorAll('.n-krok').forEach(c => c.checked = FINALNE.includes(c.value)); };
    o.querySelector('#n-nic').onclick = e => { e.preventDefault(); o.querySelectorAll('.n-krok').forEach(c => c.checked = false); };
    const rysuj = () => {
      o.querySelector('#n-tab').innerHTML = `<table style="width:100%;border-collapse:collapse"><tr style="opacity:.7;text-align:left"><th>Sklep</th><th>Nr</th><th>Nazwa integracji / katalogu</th><th>Zdjęcie</th><th>Mnożnik</th><th>Czas wysyłki</th></tr>
        ${wiersze.map((w, i) => `<tr><td><b>${esc(w.sklep)}</b>${w.zHistorii ? ' <span style="opacity:.6">(z historii)</span>' : w.wpisane ? ' <span style="color:#ce93d8">(wpisane)</span>' : ''}</td>
          <td><input data-i="${i}" data-p="nr" value="${w.nr}" style="${pole};width:55px"></td>
          <td style="opacity:.8">${esc(nazwaWza(hSel.value, w))}</td>
          <td><input data-i="${i}" data-p="zdjecie" value="${w.zdjecie}" style="${pole};width:55px"></td>
          <td><input data-i="${i}" data-p="mnoznik" value="${w.mnoznik}" style="${pole};width:70px"></td>
          <td>${selCzas(w.czas, 'data-i="' + i + '" data-p="czas"')}</td></tr>`).join('')}</table><div id="n-bledy" style="color:#ff8a87;margin-top:6px"></div>`;
      o.querySelectorAll('#n-tab [data-i]').forEach(e => e.onchange = () => { const w = wiersze[+e.dataset.i]; w[e.dataset.p] = e.dataset.p === 'mnoznik' ? e.value.replace(',', '.') : e.dataset.p === 'czas' ? e.value : +e.value; rysuj(); });
      const b = sprawdzZasady(hSel.value, wiersze);
      o.querySelector('#n-bledy').innerHTML = b.map(esc).join('<br>');
      o.querySelector('#n-start').style.display = wiersze.length ? '' : 'none';
    };
    o.querySelector('#n-prop').onclick = () => {
      const nowe = parsujSklepy(o.querySelector('#n-s').value), wpisane = {};
      for (const x of nowe) { const { sklep, ...r } = x; if (Object.keys(r).length) wpisane[nn(sklep)] = r; }
      const s = [...new Map([...[...o.querySelectorAll('.n-ist:checked')].map(c => c.value), ...nowe.map(x => x.sklep)].map(x => [nn(x), x])).values()];
      if (!s.length) return alert('Zaznacz sklepy albo wpisz nowe konta Allegro');
      wiersze = zaproponuj(hSel.value, s, wpisane);
      const cz = o.querySelector('#n-czas').value; wiersze.forEach(w => { if (!w.zHistorii) w.czas = cz; });
      rysuj();
    };
    o.querySelector('#n-czas-box').addEventListener('change', e => { if (e.target.id === 'n-czas') { wiersze.forEach(w => w.czas = e.target.value); if (wiersze.length) rysuj(); } });
    o.querySelector('#n-anuluj').onclick = () => o.remove();
    const zaznaczone = () => [...o.querySelectorAll('.n-ist:checked')].map(c => c.value);
    o.querySelector('#n-ist-wsz').onclick = e => { e.preventDefault(); const c = [...o.querySelectorAll('.n-ist')], wsz = c.every(x => x.checked); c.forEach(x => x.checked = !wsz); };
    const poZmianie = () => { info(); istniejace(); if (wiersze.length) { const zost = new Set(historia().filter(x => nn(x.hurtownia) === nn(hSel.value)).map(x => nn(x.sklep))); wiersze = wiersze.filter(w => !w.zHistorii || zost.has(nn(w.sklep))); rysuj(); } };
    o.querySelector('#n-ist-usun').onclick = () => {
      const z = zaznaczone(), k = hSel.value;
      if (!z.length) return alert('Zaznacz sklepy na liście „Sklepy tej hurtowni”');
      if (!confirm('Usunąć z bazy (' + k + '):\n' + z.join('\n') + '\n\nUsuwa tylko wpis w skrypcie (nr, mnożnik, zdjęcie) – w Base nic nie rusza.')) return;
      const zs = new Set(z.map(nn));
      pisz(L_HIST, historia().filter(x => !(nn(x.hurtownia) === nn(k) && zs.has(nn(x.sklep)))));
      poZmianie();
    };
    o.querySelector('#n-ist-przen').onclick = () => {
      const z = zaznaczone(), k = hSel.value;
      if (!z.length) return alert('Zaznacz sklepy na liście „Sklepy tej hurtowni”');
      const inne = Object.keys(H).filter(x => x !== k);
      const odp = (prompt('Przenieść ' + z.length + ' sklep(y) z ' + k + ' do hurtowni:\n' + inne.map((x, i) => (i + 1) + ') ' + x).join('\n') + '\n\nWpisz numer albo nazwę:') || '').trim();
      if (!odp) return;
      const cel = /^\d+$/.test(odp) ? inne[+odp - 1] : inne.find(x => nn(x) === nn(odp));
      if (!cel) return alert('Nie ma takiej hurtowni: ' + odp);
      const zs = new Set(z.map(nn));
      const hist = historia().map(x => nn(x.hurtownia) === nn(k) && zs.has(nn(x.sklep)) ? { ...x, hurtownia: cel } : x);
      pisz(L_HIST, hist);
      poZmianie();
      alert('Przeniesione do ' + cel + ': ' + z.join(', ') + (z.length ? '\nNr PRZE zostały stare – popraw, jeśli trzeba (wpisz ponownie w „Wcześniej zrobione” w ' + cel + ').' : ''));
    };
    o.querySelector('#n-stare-zap').onclick = () => {
      const k = hSel.value, lista = parsujSklepy(o.querySelector('#n-stare').value);
      if (!lista.length) return alert('Wpisz sklepy: Sklep [nr] mnożnik zdjęcie');
      const zle = lista.filter(x => !(x.mnoznik > 0) || !(x.zdjecie > 0));
      if (zle.length) return alert('Brak mnożnika albo zdjęcia przy: ' + zle.map(x => x.sklep).join(', ') + '\nFormat: Sklep [nr] mnożnik zdjęcie, np. ProfiPrzemysl 1 1.45 3');
      if (!confirm('Dopisać do bazy (' + k + '):\n' + lista.map(x => (x.nr ? 'PRZE-' + x.nr + ' ' : '') + x.sklep + '  ×' + x.mnoznik.toFixed(2) + '  zdj.' + x.zdjecie).join('\n'))) return;
      const hist = historia();
      for (const x of lista) {
        const i = hist.findIndex(y => nn(y.sklep) === nn(x.sklep));
        const e = { sklep: x.sklep, hurtownia: k, mnoznik: x.mnoznik, zdjecie: x.zdjecie, ...(x.nr ? { nr: x.nr } : {}) };
        if (i >= 0) hist[i] = { ...hist[i], ...e }; else hist.push({ nr: null, ...e });
      }
      pisz(L_HIST, hist);
      o.querySelector('#n-stare').value = '';
      info(); istniejace();
      if (wiersze.length) { wiersze = zaproponuj(k, wiersze.map(w => w.sklep), Object.fromEntries(wiersze.filter(w => w.wpisane).map(w => [nn(w.sklep), { nr: w.nr, mnoznik: +w.mnoznik, zdjecie: +w.zdjecie }]))); rysuj(); }
    };
    o.querySelector('#n-start').onclick = () => {
      const k = hSel.value, h = H[k], br = brakiHurtowni(h), b = sprawdzZasady(k, wiersze);
      if (br.length) return alert('Uzupełnij dane hurtowni ' + k + ': ' + br.join(', '));
      const war = [...o.querySelectorAll('.n-war:checked')].map(c => c.value);
      let wyb = [...o.querySelectorAll('.n-krok:checked')].map(c => c.value);
      if (wyb.includes('warunki') && !war.length) wyb = wyb.filter(x => x !== 'warunki');
      if (!wyb.length) return alert('Zaznacz, co zrobić');
      const kroki = [...wyb];
      if (wyb.includes('wza')) kroki.push('dodajWza');
      const tylkoZnajdzKatalog = !wyb.includes('katalog') && ['waga', 'import', 'finalEan'].some(x => wyb.includes(x));
      if (tylkoZnajdzKatalog) kroki.push('katalog');
      if (b.length && wyb.some(x => x === 'allegro' || x === 'waga') && !confirm('Uwagi do zasad:\n' + b.join('\n') + '\n\nMimo to startować?')) return;
      if (!confirm('Start ' + wiersze.length + ' sklepów (' + k + '):\nKroki: ' + wyb.map(x => x === 'warunki' ? 'warunki (' + war.map(w => WARUNKI.find(y => y[0] === w)[1]).join(', ') + ')' : (WYBOR.find(y => y[0] === x) || [, x])[1]).join(', ') + '\n\n' + wiersze.map(w => nazwaWza(k, w) + '  ×' + w.mnoznik + '  zdj.' + w.zdjecie + '  ' + w.czas).join('\n'))) return;
      // zapisz w historii (rezerwacja zdjęć / mnożników)
      const hist = historia();
      for (const w of wiersze) {
        const i = hist.findIndex(x => nn(x.sklep) === nn(w.sklep));
        const e = { sklep: w.sklep, hurtownia: k, nr: +w.nr, mnoznik: +w.mnoznik, zdjecie: +w.zdjecie, czas: w.czas };
        if (i >= 0) hist[i] = { ...hist[i], ...e }; else hist.push(e);
      }
      pisz(L_HIST, hist);
      pisz(L_LOG, []);
      zapiszZad({ hurtownia: k, kroki, warunki: war, tylkoZnajdzKatalog, start: Date.now(),
        sklepy: wiersze.map(w => ({ sklep: w.sklep, nr: +w.nr, mnoznik: (+w.mnoznik).toFixed(2), zdjecie: +w.zdjecie, czas: w.czas, ok: {}, proby: {}, odswC: !war.includes('cennik'), odswP: !war.includes('producent') })) });
      log('START ' + k + ': ' + wiersze.map(w => w.sklep).join(', '));
      powiadom('Start nowych sklepów', k + ': ' + wiersze.map(w => w.sklep).join(', '));
      o.remove(); rysujPanel(); setTimeout(silnik, 500);
    };
  }

  function oknoHurtownie() {
    const H = hurtownie();
    const P = [['kurier', 'osoba', 'Imię i nazwisko', 150], ['kurier', 'firma', 'Firma', 160], ['kurier', 'ulica', 'Ulica', 140], ['kurier', 'kod', 'Kod', 65], ['kurier', 'miasto', 'Miasto', 100], ['kurier', 'telefon', 'Telefon', 110], ['kurier', 'email', 'E-mail', 160],
      [null, 'czasWysylki', 'Czas wysyłki', 0], [null, 'magazyn', 'Magazyn w Base', 140], [null, 'import', 'Import', 0], [null, 'typImportu', 'Typ importu', 0], [null, 'zrodlo', 'Źródło importu', 140], [null, 'maxZdjecie', 'Max zdjęć', 50], [null, 'maxMnoznik', 'Max mnożnik', 55], [null, 'uzyteTxt', 'Zajęte ręczne (sklep:mnożnik/zdjęcie)', 220]];
    const o = nakladka(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:17px;font-weight:bold">🏭 Hurtownie</div>
      <div><button id="h-dodaj" style="${przycisk('#455a64')}">+ Dodaj hurtownię</button> <button id="h-zamknij" style="${przycisk('#555')}">Anuluj</button> <button id="h-zapisz" style="${przycisk('#2e7d32')}">Zapisz</button></div></div>
      <div style="overflow:auto"><table id="h-tab" style="border-collapse:collapse;font-size:12px"></table></div>
      <div style="opacity:.7;margin-top:8px">Telefon zawsze z +48. Czas wysyłki: 24h / 48h / 3d (3 dni)… Import: „hurtownia” (Import z hurtowni) albo „baseconnect” (Import z Base Connect).</div>`);
    const rys = () => {
      o.querySelector('#h-tab').innerHTML = '<tr style="opacity:.7;text-align:left"><th>Hurtownia</th>' + P.map(p => '<th>' + p[2] + '</th>').join('') + '<th>Paczkomat</th><th>Braki</th></tr>' +
        Object.entries(H).map(([k, v]) => '<tr><td><b>' + esc(k) + '</b></td>' + P.map(([g, p, , w]) => {
          const val = p === 'uzyteTxt' ? (v.uzyte || []).map(u => (u.sklep ? u.sklep + ':' : '') + u.mnoznik + '/' + u.zdjecie).join(', ') : g ? (v[g] || {})[p] : v[p];
          if (p === 'czasWysylki') return '<td>' + selCzas(v.czasWysylki || '24h', 'data-h="' + esc(k) + '" data-p="czasWysylki"') + '</td>';
          if (p === 'typImportu') return `<td><select data-h="${esc(k)}" data-p="typImportu" style="${pole}">${[['nowe', 'Tylko nowe'], ['nowe_i_aktualizuj', 'Nowe + aktualizuj'], ['powiaz_i_nowe', 'Powiąż + utwórz nowe']].map(([a, b]) => `<option value="${a}" ${(v.typImportu || 'nowe') === a ? 'selected' : ''}>${b}</option>`).join('')}</select></td>`;
          if (p === 'import') return `<td><select data-h="${esc(k)}" data-p="import" style="${pole}"><option ${v.import !== 'baseconnect' ? 'selected' : ''}>hurtownia</option><option ${v.import === 'baseconnect' ? 'selected' : ''}>baseconnect</option></select></td>`;
          return `<td><input data-h="${esc(k)}" data-g="${g || ''}" data-p="${p}" value="${esc(val == null ? '' : val)}" style="${pole};width:${w}px"></td>`;
        }).join('') + `<td><input type="checkbox" data-h="${esc(k)}" data-p="zawszePaczkomat" ${v.zawszePaczkomat ? 'checked' : ''}></td><td style="color:#ffb74d">${esc(brakiHurtowni(v).join(', ') || '✔')}</td></tr>`).join('');
    };
    const zbierz = () => o.querySelectorAll('#h-tab [data-h]').forEach(i => {
      const h = H[i.dataset.h], p = i.dataset.p;
      if (i.type === 'checkbox') h[p] = i.checked;
      else if (i.dataset.g) { h.kurier = h.kurier || {}; h.kurier[p] = p === 'telefon' ? telefon(i.value) : i.value.trim(); }
      else if (p === 'uzyteTxt') h.uzyte = i.value.split(',').map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(?:(.+?):)?\s*([\d.,]+)\s*\/\s*(\d+)$/); return m ? { sklep: (m[1] || '').trim(), mnoznik: +m[2].replace(',', '.'), zdjecie: +m[3] } : null; }).filter(Boolean);
      else if (p === 'maxZdjecie' || p === 'maxMnoznik') { if (i.value.trim()) h[p] = +i.value.replace(',', '.'); else delete h[p]; }
      else h[p] = i.value.trim();
    });
    rys();
    o.querySelector('#h-dodaj').onclick = () => { zbierz(); const n = (prompt('Nazwa hurtowni (jak w nazwach: NAZWA AUTOMATIC PRZE-1 Sklep):') || '').trim().toUpperCase(); if (!n) return; if (H[n]) return alert('Już jest'); H[n] = { magazyn: '', import: 'hurtownia', zrodlo: '', kurier: {}, aliasy: [], czasWysylki: '24h', zawszePaczkomat: false, maxZdjecie: 6, maxMnoznik: 1.99 }; rys(); };
    o.querySelector('#h-zamknij').onclick = () => o.remove();
    o.querySelector('#h-zapisz').onclick = () => { zbierz(); pisz(L_H, H); o.remove(); log('zapisano dane hurtowni'); };
  }

  // =====================================================================
  // SILNIK – po kolei: dla każdego kroku wszystkie sklepy, potem następny krok
  // =====================================================================
  function nastepny(z) {
    for (const typ of krokiZad(z)) {
      for (const s of z.sklepy) if (s.ok[typ] === undefined || s.ok[typ] === null) {
        // kroki zależne: wza po dodaniu, waga po katalogu
        if (typ === 'wza' && s.ok.dodajWza !== true) continue;
        if ((typ === 'import' || typ === 'waga' || typ === 'finalEan') && s.ok.katalog !== true) continue;
        return { typ, s };
      }
    }
    return null;
  }
  const STRONA = { finalAllegro: '/list_integrations.php', dodajWza: '/list_integrations.php', wza: '/list_integrations.php', allegro: '/list_integrations.php', katalog: '/inventory_settings', import: '/inventory_import' };
  const naStronie = p => location.pathname === p || location.pathname === p + '.php' || location.pathname.replace(/\.php$/, '') === p.replace(/\.php$/, '');
  function idz(url) { setTimeout(() => { location.href = url; }, 1200); }

  let pracuje = false;
  async function silnik() {
    if (pracuje) return;
    const z = zad(); if (!z || z.pauza) return;
    const n = nastepny(z);
    if (!n) {
      const bledy = z.sklepy.flatMap(s => krokiZad(z).filter(k => s.ok[k] && s.ok[k] !== true).map(k => s.sklep + ' – ' + OPIS[k] + ': ' + s.ok[k]));
      log('🏁 KONIEC ' + z.hurtownia + (bledy.length ? ' – z błędami:\n   ' + bledy.join('\n   ') : ' – wszystko ✔'));
      powiadom('Nowe sklepy – koniec', z.hurtownia + ': ' + (bledy.length ? bledy.length + ' błędów (zobacz log w panelu)' : 'wszystko zrobione ✔'), bledy.length ? 4 : 3);
      pisz(L_OST, { ...z, koniec: Date.now() });
      localStorage.removeItem(L_Z); rysujPanel(); oknoPodsumowanie(); return;
    }
    const naParam = n.typ === 'waga' || n.typ === 'finalEan';
    const cel = naParam ? '/allegro_link_parameters.php?storage=' + encodeURIComponent('db|' + n.s.katId)
      : n.typ === 'warunki' ? (!n.s.odswC ? '/allegro_delivery.php' : !n.s.odswP ? '/allegro_responsible_producers.php' : '/list_integrations.php') : STRONA[n.typ];
    const celSciezka = cel.split('?')[0];
    if (!naStronie(celSciezka) || (naParam && !decodeURIComponent(location.search).includes('db|' + n.s.katId))) { log('→ ' + OPIS[n.typ] + ' ' + n.s.sklep + ': przechodzę na ' + celSciezka); idz(cel); return; }
    pracuje = true; bezOkienek();
    const z2 = zad(); const s = z2.sklepy.find(x => x.sklep === n.s.sklep);
    s.proby[n.typ] = (s.proby[n.typ] || 0) + 1; zapiszZad(z2);
    log('▶ ' + OPIS[n.typ] + ': ' + s.sklep + (s.proby[n.typ] > 1 ? ' (próba ' + s.proby[n.typ] + ')' : ''));
    let w;
    try { w = await KROK[n.typ](z2, s); } catch (e) { w = 'błąd: ' + (e && e.message || e); }
    const z3 = zad(); if (!z3) { pracuje = false; return; }
    const s3 = z3.sklepy.find(x => x.sklep === s.sklep);
    Object.assign(s3, { wzaId: s.wzaId || s3.wzaId, katId: s.katId || s3.katId, allegroId: s.allegroId || s3.allegroId, odswC: s.odswC || s3.odswC, odswP: s.odswP || s3.odswP });
    if (w === 'dalej') { s3.proby[n.typ]--; zapiszZad(z3); pracuje = false; setTimeout(silnik, 800); return; }
    if (w === 'ok') { s3.ok[n.typ] = true; log('   ✔ ' + OPIS[n.typ] + ' ' + s.sklep); }
    else if (w === 'czekaj') { s3.proby[n.typ]--; }
    else if (w === 'ponów' && s3.proby[n.typ] < 3) log('   ↻ ponawiam: ' + s.sklep);
    else { if (w === 'ponów') w = 'nie wyszło po 3 próbach'; s3.ok[n.typ] = String(w).slice(0, 200); log('   ❌ ' + OPIS[n.typ] + ' ' + s.sklep + ': ' + w); powiadom('Błąd: ' + s.sklep, OPIS[n.typ] + ': ' + w, 4);
      // bez integracji WzA / katalogu nie ma sensu robić dalszych kroków tego sklepu
      if (n.typ === 'dodajWza') s3.ok.wza = 'pominięte (brak integracji)';
      if (n.typ === 'katalog') { s3.ok.import = 'pominięte (brak katalogu)'; s3.ok.waga = 'pominięte (brak katalogu)'; } }
    zapiszZad(z3); pracuje = false;
    idz(w === 'czekaj' ? location.href : location.pathname + location.search);   // świeża strona przed następnym krokiem
  }

  // ---------- wspólne ----------
  function opcja(el, w) {
    if (w.includes('|')) { for (const x of w.split('|')) { const o = opcja(el, x); if (o) return o; } return null; }
    const opts = [...el.options];
    if (w.startsWith('$')) { const S = norm(w.slice(1)); return opts.find(o => o.value !== '' && norm(o.textContent).split(/[\s_]+/).pop().startsWith(S)); }
    const sens = opts.filter(o => o.value !== '' && !/^(brak |nie wybrano|--|wybierz)/i.test(o.textContent.trim()));
    if (w.startsWith('~')) return sens.find(o => norm(o.textContent).includes(norm(w.slice(1))));
    if (w.startsWith('*')) { if (sens.length === 1) return sens[0]; const f = norm(w.slice(1)).replace(/[^a-ząćęłńóśźż0-9]/g, ''); return f ? sens.find(o => norm(o.textContent).replace(/[^a-ząćęłńóśźż0-9]/g, '').includes(f.slice(0, 8))) : null; }
    return opts.find(o => norm(o.textContent) === norm(w)) || opts.find(o => norm(o.textContent).startsWith(norm(w)));
  }
  function ustawSelect(el, wartosc) { el.value = wartosc; zmien(el); }
  async function czekajNaFunkcje(nazwa) { return czekajNa(() => typeof W[nazwa] === 'function', 30000); }

  // lista „Wysyłam z Allegro … AUTOMATIC PRZE-…” na liście integracji
  function listaWza() {
    return [...document.querySelectorAll('tr')].map(tr => {
      const del = tr.querySelector('[onclick*="disableIntegration(\'allegrokurier\'"]'); if (!del) return null;
      const id = (del.getAttribute('onclick').match(/allegrokurier',\s*'(\d+)'/) || [])[1];
      const m = tr.textContent.replace(/\s+/g, ' ').match(/(\S.*?)\s+AUTOMATIC\s+PRZE-?\s*(\d+)\s+(\S+)/i);
      return id && m ? { id, hurtownia: m[1].replace(/^Allegro\.pl\s+/i, '').trim(), nr: m[2], sklep: m[3] } : null;
    }).filter(Boolean);
  }
  function kontaAllegro() {
    return [...document.querySelectorAll('tr')].map(tr => {
      const e = [...tr.querySelectorAll('[onclick]')].map(x => (x.getAttribute('onclick').match(/openIntegrationSettings\(["']allegro["'],\s*["'](\d+)/) || [])[1]).find(Boolean);
      const m = tr.textContent.replace(/\s+/g, ' ').trim().match(/^Allegro\s+(\S+)/);
      return e && m ? { id: e, sklep: m[1] } : null;
    }).filter(Boolean);
  }
  const znajdzWza = (z, s) => listaWza().find(w => nn(w.sklep) === nn(s.sklep) && String(w.nr) === String(s.nr) && nn(w.hurtownia) === nn(z.hurtownia)) || listaWza().find(w => nn(w.sklep) === nn(s.sklep) && nn(w.hurtownia) === nn(z.hurtownia));
  async function zamknijModal() { document.querySelectorAll('.modal.in [data-dismiss="modal"], .modal.show [data-dismiss="modal"]').forEach(b => b.click()); await czekaj(800); }

  const KROK = {};

  // 1) dodaj „Wysyłam z Allegro”
  KROK.dodajWza = async (z, s) => {
    if (!await czekajNaFunkcje('openIntegrationSettings')) return 'nie wczytała się lista integracji';
    await czekaj(1500);
    const jest = znajdzWza(z, s);
    if (jest) { s.wzaId = jest.id; return 'ok'; }
    if (s.proby.dodajWza > 1) return 'po dodaniu nie widzę integracji na liście';
    const nazwa = nazwaWza(z.hurtownia, s);
    if (typeof W.openNewIntegrationModal !== 'function') return 'brak funkcji openNewIntegrationModal';
    W.openNewIntegrationModal(); await czekaj(3000);
    const inp = [...document.querySelectorAll('.modal input')].find(i => widoczny(i) && /Wyszukaj/i.test(i.placeholder || ''));
    if (!inp) return 'brak wyszukiwarki integracji';
    inp.value = 'Wysyłam z Allegro'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    await czekaj(2000);
    const kafel = [...document.querySelectorAll('.modal img, .modal a, .modal div')].filter(e => widoczny(e) && /wysy|allegrokurier/i.test((e.getAttribute('alt') || '') + (e.getAttribute('title') || '') + (e.getAttribute('src') || '') + (e.getAttribute('onclick') || '') + (e.getAttribute('data-code') || '')));
    if (!kafel.length) return 'brak kafelka Wysyłam z Allegro';
    kafel[0].click(); await czekaj(3500);
    const n = document.getElementById('name_account'); if (!widoczny(n)) return 'brak formularza nowej integracji';
    n.value = nazwa; zmien(n);
    const sel = document.getElementById('allegro_account'); const o = sel && [...sel.options].find(o => norm(o.textContent) === norm(s.sklep));
    if (!o) return 'konta Allegro „' + s.sklep + '” nie ma w Base (podepnij je najpierw)';
    ustawSelect(sel, o.value); await czekaj(800);
    const b = [...document.querySelectorAll('.modal button')].find(b => widoczny(b) && /Zapisz/.test(b.textContent));
    if (!b) return 'brak przycisku Zapisz';
    b.click(); await czekaj(5000);
    log('   dodano „' + nazwa + '” – sprawdzam na liście');
    return 'ponów';                                    // po odświeżeniu: znajdzie ją na liście → ok
  };

  // 2) wypełnij „Wysyłam z Allegro”
  KROK.wza = async (z, s) => {
    if (!await czekajNaFunkcje('openIntegrationSettings')) return 'nie wczytała się lista integracji';
    await czekaj(1500);
    const w = znajdzWza(z, s); if (!w) return 'nie ma integracji Wysyłam z Allegro na liście';
    s.wzaId = w.id;
    const h = hurtownie()[z.hurtownia], k = h.kurier || {};
    const pola = Object.assign({}, NADAWCA, { pickup_name: k.osoba || k.firma, pickup_company: k.firma, pickup_street: k.ulica, pickup_zipcode: k.kod, pickup_city: k.miasto, pickup_phone: telefon(k.telefon), pickup_email: k.email }, WZA_LICZBY);
    const otworz = async () => { await zamknijModal(); W.openIntegrationSettings('allegrokurier', w.id); const ok = await czekajNa(() => { const e = document.getElementById('pickup_company'); return e && e.closest('form'); }, 30000); await czekaj(2000); return ok; };
    if (!await otworz()) return 'nie otworzyły się ustawienia integracji';
    const ids = [...Object.keys(pola), ...Object.keys(WZA_WYBORY), ...Object.keys(WZA_CHECK)];
    const forms = [...document.forms], grupy = {};
    for (const id of ids) { const el = document.getElementById(id); if (!el) continue; const i = forms.indexOf(el.closest('form')); (grupy[i] = grupy[i] || []).push(id); }
    const wpisz = tylko => {
      const b = [];
      for (const [id, v] of Object.entries(pola)) { if (!tylko.includes(id)) continue; const el = document.getElementById(id); if (!el) { b.push('brak ' + id); continue; }
        const an = W.AutoNumeric && W.AutoNumeric.getAutoNumericElement && W.AutoNumeric.getAutoNumericElement(el);
        if (an) an.set(v); else el.value = v == null ? '' : v; zmien(el); }
      for (const [id, t] of Object.entries(WZA_WYBORY)) { if (!tylko.includes(id)) continue; const el = document.getElementById(id); if (!el) { b.push('brak ' + id); continue; } const o = opcja(el, t); if (!o) { b.push(id + ': brak opcji ' + t); continue; } ustawSelect(el, o.value); }
      for (const [id, v] of Object.entries(WZA_CHECK)) { if (!tylko.includes(id)) continue; const el = document.getElementById(id); if (el && el.checked !== v) { el.checked = v; zmien(el); } }
      return b;
    };
    let nr = 0;
    for (const [fi, tylko] of Object.entries(grupy)) {
      if (nr++ > 0 && !await otworz()) return 'nie otworzyły się ustawienia (zakładka ' + nr + ')';
      const f = document.forms[+fi]; const pane = f && f.closest('.tab-pane, [role=tabpanel]');
      if (pane && pane.id) { const a = document.querySelector('a[href="#' + pane.id + '"], [data-target="#' + pane.id + '"], [data-bs-target="#' + pane.id + '"]'); if (a) a.click(); await czekaj(700); }
      const b = wpisz(tylko); if (b.length) log('   ⚠ ' + b.join('; '));
      const f2 = document.forms[+fi];
      const zap = f2 && [...f2.querySelectorAll('button, input[type=submit], input[type=button], a.btn')].find(x => /^\s*Zapisz\s*$/i.test(x.textContent || x.value));
      if (!zap) return 'brak przycisku Zapisz w zakładce ' + (pane ? pane.id : fi);
      zap.click(); await czekaj(4000);
    }
    // sprawdzenie
    if (!await otworz()) return 'nie otworzyły się ustawienia do sprawdzenia';
    const zle = [];
    for (const [id, v] of Object.entries(pola)) { const el = document.getElementById(id); const x = el ? el.value : '(brak)'; if (norm(x).replace(/[\s,]/g, '') !== norm(v).replace(/[\s,]/g, '') && parseFloat(String(x).replace(',', '.')) !== parseFloat(v)) zle.push(id + '=„' + x + '”'); }
    for (const [id, t] of Object.entries(WZA_WYBORY)) { const el = document.getElementById(id); const x = el && el.selectedOptions[0] ? el.selectedOptions[0].textContent : '(brak)'; if (!norm(x).startsWith(norm(t))) zle.push(id + '=„' + x.trim() + '”'); }
    await zamknijModal();
    return zle.length ? (s.proby.wza < 2 ? 'ponów' : 'po zapisie nie zgadza się: ' + zle.join('; ')) : 'ok';
  };

  // 3) integracja Allegro konta sklepu
  function sekcje(s, h) {
    return [
      { nazwa: 'Zamówienia', tab: 'account_modal_orders', kotwica: 'order_vat_source', radio: ['orders_get_2'], wybory: {
        order_products_thumbs_source: 'Tak, miniaturki produktów pobierane z katalogu Base.com', order_vat_source: 'Zgodna ze stawką podaną przy produkcie w magazynie',
        forwarding_invoice: 'Tak, przekazuj automatycznie faktury od razu po utworzeniu', invoice_forwarding_options: 'Przekazuj fakturę zawsze' } },
      { nazwa: 'Wystawianie i oferty', tab: 'account_modal_options', kotwica: 'gallery_images_sort', wybory: {
        gallery_images_sort: 'Na początku zdjęcie nr ' + s.zdjecie, gallery_images_use: 'Wstaw tylko pierwsze zdjęcie', title_auto_trim: 'Tak',
        handling_time: czasTekst(s.czas || h.czasWysylki), invoice_options: 'Faktura VAT', country_code: 'Polska', voivodeship_code: 'wielkopolskie', link_theme: 'OFERTY NOWY EAN',
        ...(BEZPIECZENSTWO ? { safety_information_type: 'Dodaj tekst' } : {}) },
        pola: { city: 'POZNAŃ', postcode: '60-195', price_mult: s.mnoznik, ...(BEZPIECZENSTWO ? { safety_information_extra_text: BEZPIECZENSTWO } : {}) } },
      { nazwa: 'Zwroty', tab: 'account_modal_returns', kotwica: 'download_returns', wybory: { download_returns: 'Pobieraj zwroty' } },
      { nazwa: 'Statusy zamówień', tab: 'account_modal_statuses', kotwica: 'orders_status_link', wybory: Object.assign({ orders_status_link: 'Tak' }, Object.fromEntries(Object.entries(STATUSY).map(([id, t]) => ['orders_status_link_data_' + id, t]))) },
      { nazwa: 'Ceny', tab: 'account_modal_sync_prices', kotwica: 'sync_prices_5', radio: ['sync_prices_5'], wybory: { if_zero: 'Zakończ ofertę', if_lower: 'Zmniejsz cenę w ofercie', if_bigger: 'Zwiększ cenę w ofercie do wysokości ceny w magazynie' }, pola: { end_limit_day: '4000' } },
      { nazwa: 'Stany', tab: 'account_modal_sync_quantity', kotwica: 'sync_quantity_4', radio: ['sync_quantity_4'], wybory: { if_zero: 'Zakończ ofertę', if_lower: 'Zmniejsz ilość dostępną w ofercie do wysokości stanu magazynowego', if_bigger: 'Zwiększ ilość dostępną w ofercie do wysokości stanu magazynowego' }, pola: { end_limit_day: '4000', max_quantity: '999999' } }
    ];
  }
  const sensowne = el => [...el.options].filter(o => o.value !== '' && !/^(brak |nie wybrano|--|wybierz)/i.test(o.textContent.trim()));
  async function czekajNaOpcje(sk, t = 12000) {   // listy warunków/producentów Base dociąga po otwarciu – poczekaj, aż się wypełnią
    const pane = document.getElementById(sk.tab); if (!pane) return;
    const sel = Object.keys(sk.wybory || {}).map(id => pane.querySelector('[id="' + id + '"]')).filter(Boolean);
    await czekajNa(() => sel.every(el => sensowne(el).length), t);
  }
  function sekcjaWStronie(sk, sprawdz) {
    const pane = document.getElementById(sk.tab); if (!pane) return { bledy: ['brak zakładki ' + sk.tab], zle: [] };
    const q = id => pane.querySelector('[id="' + id + '"]');
    const bledy = [], zle = [];
    for (const id of (sk.radio || [])) { const el = q(id); if (!el) { bledy.push('brak ' + id); continue; } if (sprawdz) { if (!el.checked) zle.push(id); } else if (!el.checked) { el.click(); zmien(el); } }
    for (const [id, w] of Object.entries(sk.wybory || {})) {
      const el = q(id); if (!el) { bledy.push('brak ' + id); continue; }
      const o = opcja(el, w); if (!o) { const jest = sensowne(el).map(x => x.textContent.trim()); bledy.push(id + ': brak opcji „' + w + '”' + (jest.length ? ' (są: ' + jest.slice(0, 4).join(' | ') + (jest.length > 4 ? ' …+' + (jest.length - 4) : '') + ')' : ' (lista pusta)')); continue; }
      if (sprawdz) { if (el.value !== o.value) zle.push(id + '=„' + ((el.selectedOptions[0] || {}).textContent || '') + '”'); } else if (el.value !== o.value) ustawSelect(el, o.value);
    }
    for (const [id, v] of Object.entries(sk.pola || {})) {
      const el = q(id); if (!el) { bledy.push('brak ' + id); continue; }
      if (sprawdz) { const a = norm(el.value).replace(/,/g, '.'), b = norm(v).replace(/,/g, '.'); if (a !== b && parseFloat(a) !== parseFloat(b)) zle.push(id + '=„' + String(el.value).slice(0, 30) + '”'); }
      else { el.value = v; const j = $j(); if (j) j(el).trigger('input').trigger('change').trigger('keyup'); else zmien(el); }
    }
    return { bledy, zle };
  }
  KROK.allegro = async (z, s) => {
    if (!await czekajNaFunkcje('openIntegrationSettings')) return 'nie wczytała się lista integracji';
    await czekaj(1500);
    const a = kontaAllegro().find(k => nn(k.sklep) === nn(s.sklep));
    if (!a) return 'nie ma integracji Allegro konta „' + s.sklep + '” w Base';
    s.allegroId = a.id;
    const h = hurtownie()[z.hurtownia];
    const S = sekcje(s, h);
    const otworz = async () => { await zamknijModal(); W.openIntegrationSettings('allegro', a.id); const ok = await czekajNa(() => document.getElementById('gallery_images_sort'), 30000); await czekaj(2500); return ok; };
    const pokaz = async sk => { const l = document.querySelector('a[href="#' + sk.tab + '"]'); if (l) l.click(); await czekajNa(() => { const p = document.getElementById(sk.tab); return p && p.querySelector('[id="' + sk.kotwica + '"]'); }, 30000); await czekaj(1200); };
    if (!await otworz()) return 'nie otworzyły się ustawienia konta Allegro';
    for (const sk of S) {
      await pokaz(sk);
      const r = sekcjaWStronie(sk, false);
      if (sk.tab === 'account_modal_options') { await czekaj(800); sekcjaWStronie({ ...sk, wybory: {}, radio: [] }, false); }
      if (r.bledy.length) log('   ⚠ ' + sk.nazwa + ': ' + r.bledy.join('; '));
      await czekaj(500);
      const b = document.getElementById(sk.tab)?.querySelector('.btn_form_save');
      if (!b) { log('   ⚠ brak Zapisz: ' + sk.nazwa); continue; }
      b.click(); await czekaj(3500);
    }
    if (!await otworz()) return 'nie otworzyły się ustawienia do sprawdzenia';
    const zle = [];
    for (const sk of S) { await pokaz(sk); zle.push(...sekcjaWStronie(sk, true).zle.map(x => sk.nazwa + ': ' + x)); }
    await zamknijModal();
    if (zle.length) return s.proby.allegro < 2 ? 'ponów' : 'po zapisie nie zgadza się: ' + zle.join('; ');
    log('   zdjęcie nr ' + s.zdjecie + ', mnożnik ×' + s.mnoznik + ', czas ' + czasTekst(s.czas || h.czasWysylki));
    return 'ok';
  };

  // 3b) cenniki dostaw i warunki: odśwież z Allegro (cenniki, producenci), potem wybierz w integracji konta
  async function odswiezZAllegro(przycisk, sklep) {
    const b = await czekajNa(() => [...document.querySelectorAll('button')].find(x => x.textContent.includes(przycisk) && widoczny(x)), 30000);
    if (!b) return 'brak przycisku „' + przycisk + '”';
    b.click();
    const szukaj = () => { const l = [...(b.parentElement || document).querySelectorAll('.dropdown-menu a')]; return l.find(a => norm(a.textContent) === norm(sklep)) || l.find(a => nn(a.textContent) === nn(sklep)) || l.find(a => nn(a.textContent).includes(nn(sklep))); };
    const a = await czekajNa(szukaj, 6000);
    if (!a) { document.body.click(); return 'brak konta ' + sklep + ' na liście (' + przycisk + ')'; }
    a.click(); await czekaj(9000);
    return 'ok';
  }
  KROK.warunki = async (z, s) => {
    const war = z.warunki || WARUNKI.map(w => w[0]);
    if ((!s.odswC && !war.includes('cennik')) || (!s.odswP && !war.includes('producent'))) { if (!war.includes('cennik')) s.odswC = true; if (!war.includes('producent')) s.odswP = true; return 'dalej'; }
    if (!s.odswC) { log('   cenniki z Allegro: ' + await odswiezZAllegro('Odśwież cenniki', s.sklep)); s.odswC = true; return 'dalej'; }
    if (!s.odswP) { log('   producenci z Allegro: ' + await odswiezZAllegro('Odśwież producentów', s.sklep)); s.odswP = true; return 'dalej'; }
    if (!await czekajNaFunkcje('openIntegrationSettings')) return 'nie wczytała się lista integracji';
    await czekaj(1500);
    const a = kontaAllegro().find(k => nn(k.sklep) === nn(s.sklep));
    if (!a) return 'nie ma integracji Allegro konta „' + s.sklep + '” w Base';
    const firma = ((hurtownie()[z.hurtownia] || {}).kurier || {}).firma || '';
    const sk = { nazwa: 'Warunki', tab: 'account_modal_options', kotwica: 'gallery_images_sort', wybory: {
      link_delivery_schema: '$KURIER|$PACZKOMAT|~KURIER|~PACZKOMAT', implied_warranties_id: '*' + firma, warranties_id: '*', return_policies_id: '*', link_responsible_producer: '*' + firma } };
    for (const [w, , pole] of WARUNKI) if (!war.includes(w)) delete sk.wybory[pole];
    log('   warunki: ' + war.join(', '));
    const otworz = async () => { await zamknijModal(); W.openIntegrationSettings('allegro', a.id); const ok = await czekajNa(() => document.getElementById('gallery_images_sort'), 30000); await czekaj(2500); return ok; };
    const pokaz = async () => { const l = document.querySelector('a[href="#' + sk.tab + '"]'); if (l) l.click(); await czekajNa(() => document.getElementById(sk.tab)?.querySelector('[id="' + sk.kotwica + '"]'), 30000); await czekaj(1200); };
    if (!await otworz()) return 'nie otworzyły się ustawienia konta Allegro';
    await pokaz(); await czekajNaOpcje(sk);
    const r = sekcjaWStronie(sk, false);
    if (r.bledy.length) log('   ⚠ ' + r.bledy.join('; '));
    const b = document.getElementById(sk.tab)?.querySelector('.btn_form_save'); if (!b) return 'brak Zapisz';
    b.click(); await czekaj(3500);
    if (!await otworz()) return 'nie otworzyły się ustawienia do sprawdzenia';
    await pokaz();
    const zle = sekcjaWStronie(sk, true).zle; await zamknijModal();
    const brak = r.bledy.filter(x => /brak opcji/.test(x));
    if (brak.length && s.proby.warunki < 2) {           // czegoś nie ma na liście → jeszcze raz pobierz z Allegro i spróbuj ponownie
      if (war.includes('cennik') || brak.some(x => /return_policies|warranties/.test(x))) s.odswC = false;
      if (war.includes('producent')) s.odswP = false;
      log('   ↻ brakuje opcji – odświeżam z Allegro i próbuję jeszcze raz: ' + brak.join('; '));
      return 'ponów';
    }
    if (zle.length) return s.proby.warunki < 2 ? 'ponów' : 'po zapisie nie zgadza się: ' + zle.join('; ');
    return brak.length ? 'nie ma w Base (po odświeżeniu z Allegro): ' + brak.join('; ') + ' – sprawdź, czy to konto ma te warunki/producenta w Allegro' : 'ok';
  };

  // 4) katalog
  const wierszeKat = () => [...document.querySelectorAll('[id^="row-options-"]')].map(b => ({ id: b.id.replace('row-options-', ''), tr: b.closest('tr') })).filter(w => w.tr);
  const znajdzKat = nazwa => wierszeKat().find(w => [...w.tr.cells].some(td => norm(td.innerText) === norm(nazwa)));
  KROK.katalog = async (z, s) => {
    const nazwa = nazwaWza(z.hurtownia, s), h = hurtownie()[z.hurtownia];
    await czekajNa(() => wierszeKat().length && typeof W.addNewInventory === 'function', 30000);
    const pager = document.getElementById('table_inventory_inventories_pager_rows_per_page');
    if (pager && pager.value !== '100000') { const przed = wierszeKat().length; ustawSelect(pager, '100000'); await czekajNa(() => wierszeKat().length > przed, 15000); await czekaj(1500); }
    const jest = znajdzKat(nazwa);
    if (jest) { s.katId = jest.id; return 'ok'; }
    // ten sam sklep tej hurtowni pod innym nr PRZE → bierz istniejący, nie dubluj
    const podobny = wierszeKat().find(w => [...w.tr.cells].some(td => { const t = norm(td.innerText); return t.startsWith(norm(z.hurtownia + ' automatic prze')) && nn(t).endsWith(nn(s.sklep)); }));
    if (podobny) { s.katId = podobny.id; log('   katalog pod innym nr: „' + [...podobny.tr.cells].map(td => td.innerText.trim()).find(t => nn(t).endsWith(nn(s.sklep))) + '” – biorę go'); return 'ok'; }
    if (z.tylkoZnajdzKatalog) log('   nie ma katalogu „' + nazwa + '” – zakładam');
    if (s.proby.katalog > 1) return 'po zapisie nie widzę katalogu „' + nazwa + '”';
    W.addNewInventory();
    const m = await czekajNa(() => { const x = document.getElementById('modal_inventory_inventory'); return widoczny(x) && x.querySelector('#name') ? x : null; }, 30000);
    if (!m) return 'nie otworzyło się okno „Dodaj katalog”';
    await czekaj(1200);
    m.querySelector('#name').value = nazwa; zmien(m.querySelector('#name'));
    const d = m.querySelector('#description'); if (d) { d.value = nazwa; zmien(d); }
    const mag = m.querySelector('#available_warehouses'); const o = mag && opcja(mag, h.magazyn);
    if (!o) return 'nie ma magazynu „' + h.magazyn + '” na liście (popraw w 🏭)';
    const j = $j(); j(mag).val([o.value]).trigger('change'); await czekaj(1200);
    const def = m.querySelector('#default_warehouse'); if (def) { const od = opcja(def, h.magazyn); if (od) ustawSelect(def, od.value); }
    const rez = m.querySelector('#reservations'); if (rez) { const or = opcja(rez, 'Nie'); if (or) ustawSelect(rez, or.value); }
    await czekaj(600);
    j('#modal_inventory_inventory form').submit();
    await czekajNa(() => !widoczny(document.getElementById('modal_inventory_inventory')), 30000);
    await czekaj(2500);
    return 'ponów';                                     // po odświeżeniu: znajdzie katalog → ok (i zapamięta jego ID)
  };

  // 5) import z hurtowni do katalogu (Base robi jeden import naraz – czekamy na wolne miejsce)
  KROK.import = async (z, s) => {
    const nazwa = nazwaWza(z.hurtownia, s), h = hurtownie()[z.hurtownia];
    await czekajNa(() => typeof W.addEditImport === 'function', 30000); await czekaj(3000);
    if (s.importStart) {                                   // już uruchomiony – czekaj, aż się skończy (sprawdza co 2 min)
      const minelo = Date.now() - s.importStart;
      const trwa = trwaImport();
      if ((trwa || minelo < 300000) && minelo < 8 * 3600000) { await odczekaj('import ' + s.sklep + (trwa ? ' trwa (' + trwa + ')' : ' uruchomiony – Base dopiero zaczyna')); return 'czekaj'; }
      const wynik = wynikImportu(nazwa);
      log('   📦 import ' + s.sklep + ' zakończony' + (wynik ? ': ' + wynik : '') + ' · trwał ok. ' + Math.round(minelo / 60000) + ' min');
      if (wynik && /^0 - Produkty dodane/.test(wynik) && /0 - Produkty zaktualizowane/.test(wynik)) return 'import skończył się z 0 produktów – zmień „Typ importu” w 🏭';
      return 'ok';
    }
    const trwa = trwaImport();
    if (trwa) { await odczekaj('trwa inny import (' + trwa + ')'); return 'czekaj'; }
    W.addEditImport(false, 0, h.import === 'baseconnect' ? 'blconnect' : 'warehouse', 'manual');
    const st = await czekajNa(() => { const e = document.getElementById('import_external_storage_storage'); return widoczny(e) ? e : null; }, 30000);
    if (!st) return 'nie otworzyło się okno importu';
    await czekaj(1200);
    const zr = h.zrodlo || h.magazyn;
    const oz = opcja(st, zr) || opcja(st, 'Hurtownia ' + zr) || [...st.options].find(o => nn(o.textContent).includes(nn(zr)));
    if (!oz) return 'w imporcie nie ma źródła „' + zr + '” (popraw w 🏭)';
    ustawSelect(st, oz.value);
    const typ = await czekajNa(() => { const e = document.getElementById('import_external_storage_type'); return e && widoczny(e) && e.options.length > 1 ? e : null; }, 30000);
    if (!typ) return 'brak typu importu';
    await czekaj(800);
    const TYPY = { nowe: 'Tylko pobierz nowe produkty', nowe_i_aktualizuj: 'Pobierz nowe produkty i zaktualizuj istniejące', powiaz_i_nowe: 'Produkty już częściowo istnieją' };
    const tt = TYPY[h.typImportu] || TYPY.nowe;
    const ot = opcja(typ, tt) || [...typ.options].find(o => norm(o.textContent).includes(norm(tt))); if (!ot) return 'brak typu „' + tt + '”'; ustawSelect(typ, ot.value);
    await czekaj(800);
    const kat = await czekajNa(() => { const e = document.getElementById('import_external_storage_inventory_id'); return e && e.options.length > 1 ? e : null; }, 30000);
    const ok = kat && opcja(kat, nazwa); if (!ok) return 'w imporcie nie ma katalogu „' + nazwa + '”';
    ustawSelect(kat, ok.value); await czekaj(500);
    for (const [id, t] of [['import_external_storage_price_synchro_option', 'Pobieraj ceny cyklicznie'], ['import_external_storage_quantity_option', 'Pobieraj stany cyklicznie']]) { const e = document.getElementById(id); const o = e && opcja(e, t); if (o) ustawSelect(e, o.value); }
    await czekaj(800);
    const b = [...document.querySelectorAll('.btn_import_start')].find(widoczny);
    if (!b && typeof W.inventoryImportStart !== 'function') return 'brak przycisku Uruchom import';
    { const z2 = zad(); const s2 = z2.sklepy.find(x => x.sklep === s.sklep); s2.importStart = Date.now(); zapiszZad(z2); }   // zapis PRZED startem – po przeładowaniu nie odpali drugi raz
    log('   typ importu: ' + ot.textContent.trim());
    if (b) b.click(); else W.inventoryImportStart();
    await czekaj(5000);
    log('   import uruchomiony – sprawdzam co 5 min, aż się skończy');
    return 'czekaj';
  };
  // wiersze listy importów: status = komórka z „Zakończony / Oczekujący / W trakcie…”
  const STATUSY_IMP = /Zakończ|Błąd|Anulow|Przerw|Niepowodz|Oczekuj|W trakcie|W toku|Trwa|W kolejce|Przetwarz|Uruchom|Pobieran|Zlecon/i;
  function wierszeImportow() {
    return [...document.querySelectorAll('table tbody tr')].slice(0, 10).map(tr => {
      const kom = [...tr.children].find(td => STATUSY_IMP.test(td.textContent.trim()) && td.textContent.trim().length < 40);
      return kom ? { status: kom.textContent.trim(), tekst: tr.textContent.replace(/\s+/g, ' ').trim() } : null;
    }).filter(Boolean);
  }
  function trwaImport() {
    const r = wierszeImportow().filter(x => !/Zakończ|Błąd|Anulow|Przerw|Niepowodz/i.test(x.status));
    return r.length ? r[0].status + ': ' + r[0].tekst.slice(0, 60) : '';
  }
  function wynikImportu(nazwa) {
    const w = wierszeImportow().find(x => norm(x.tekst).includes(norm(nazwa)));
    const m = w && w.tekst.match(/\d+\s*-\s*Produkty dodane.*?\d+\s*-\s*Produkty zaktualizowane/i);
    return m ? m[0].replace(/\s+/g, ' ') : (w ? w.status : '');
  }
  // czekanie 5 min z odliczaniem w panelu (bez odświeżania strony co chwilę)
  async function odczekaj(opis) {
    const do_ = Date.now() + 300000;
    log('   ⏳ ' + opis + ' – sprawdzę o ' + new Date(do_).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }));
    while (Date.now() < do_) {
      const z = zad(); if (!z || z.pauza) return;
      const el = panel.querySelector('div:nth-child(2)'); if (el) el.textContent = '⏳ ' + opis + ' · sprawdzę za ' + Math.ceil((do_ - Date.now()) / 60000) + ' min';
      await czekaj(15000);
    }
  }

  // 6) waga z mnożnikiem w Parametrach Allegro katalogu
  KROK.waga = async (z, s) => {
    if (!s.katId) return 'brak ID katalogu';
    await czekajNa(() => [...document.querySelectorAll('button')].some(b => /Dodaj parametr/.test(b.textContent) && widoczny(b)), 60000);
    await czekaj(2000);
    const stan = () => { const r = [...document.querySelectorAll('tr.paramMappingRow')].find(r => (r.querySelector('td[id^="cellServiceParam_"]')?.textContent || '').trim() === PARAM_WAGA); if (!r) return null; const id = r.id.replace('row_', ''); return { typ: document.getElementById('initialValueActionType_' + id)?.value, m: document.getElementById('initialMultiplierValue_' + id)?.value }; };
    const jest = stan();
    if (jest && jest.typ === '4' && Math.abs(parseFloat(jest.m) - parseFloat(s.mnoznik)) < 0.001) return 'ok';
    if (jest) return 'jest już inna reguła wagi (×' + jest.m + ') – popraw ręcznie';
    if (s.proby.waga > 2) return 'nie zapisało się';
    [...document.querySelectorAll('button')].find(b => /Dodaj parametr/.test(b.textContent) && widoczny(b)).click();
    const e = await czekajNa(() => document.getElementById('row_-1'), 8000); if (!e) return 'brak edytora';
    e.querySelector('.select2-selection').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await czekaj(800);
    const sz = document.querySelector('.select2-container--open .select2-search__field'); if (!sz) return 'brak wyszukiwarki parametru';
    sz.value = 'Waga produktu'; sz.dispatchEvent(new Event('input', { bubbles: true })); sz.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    const o = await czekajNa(() => [...document.querySelectorAll('.select2-results__option')].find(o => o.textContent.trim() === PARAM_WAGA), 8000);
    if (!o) return 'brak parametru „' + PARAM_WAGA + '”';
    for (const ev of ['mouseover', 'mousedown', 'mouseup']) o.dispatchEvent(new MouseEvent(ev, { bubbles: true })); o.click(); await czekaj(1500);
    const t = document.getElementById('editorActionType'); if (!t || ![...t.options].some(x => x.value === '4')) return 'brak reguły „Wstaw wagę”';
    ustawSelect(t, '4'); await czekaj(1500);
    const wh = document.getElementById('editorActionWhen'); if (wh) ustawSelect(wh, '0');
    document.getElementById('addNewValueMultiplierRow')?.click(); await czekaj(1000);
    const m = e.querySelector('input.editorMultiplierValue'); if (!m) return 'brak pola mnożnika';
    m.value = s.mnoznik; const j = $j(); j(m).trigger('input').trigger('change').trigger('keyup'); await czekaj(500);
    document.getElementById('btnSaveEdition').click(); await czekaj(4000);
    return 'ponów';                                         // po odświeżeniu sprawdzi, czy jest „Wstaw wagę ×mnożnik”
  };

  // FINALNE 1) integracja Allegro: szablon UNIWERSALNY, wszystkie zdjęcia z magazynu, kolejność zgodna z magazynem
  KROK.finalAllegro = async (z, s) => {
    if (!await czekajNaFunkcje('openIntegrationSettings')) return 'nie wczytała się lista integracji';
    await czekaj(1500);
    const a = kontaAllegro().find(k => nn(k.sklep) === nn(s.sklep));
    if (!a) return 'nie ma integracji Allegro konta „' + s.sklep + '” w Base';
    const sk = { nazwa: 'Finalne', tab: 'account_modal_options', kotwica: 'gallery_images_sort', wybory: {
      gallery_images_sort: 'Kolejność zdjęć zgodna z magazynem', gallery_images_use: 'Wstaw wszystkie dostępne zdjęcia z magazynu', link_theme: 'UNIWERSALNY-PO-PRZEROBIENIU-TYT|~UNIWERSALNY' } };
    const otworz = async () => { await zamknijModal(); W.openIntegrationSettings('allegro', a.id); const ok = await czekajNa(() => document.getElementById('gallery_images_sort'), 30000); await czekaj(2500); return ok; };
    const pokaz = async () => { const l = document.querySelector('a[href="#' + sk.tab + '"]'); if (l) l.click(); await czekajNa(() => document.getElementById(sk.tab)?.querySelector('[id="' + sk.kotwica + '"]'), 30000); await czekaj(1200); };
    if (!await otworz()) return 'nie otworzyły się ustawienia konta Allegro';
    await pokaz();
    const r = sekcjaWStronie(sk, false);
    if (r.bledy.length) return r.bledy.join('; ');
    const szab = document.getElementById('link_theme'); if (szab) log('   szablon: ' + ((szab.selectedOptions[0] || {}).textContent || '').trim());
    const b = document.getElementById(sk.tab)?.querySelector('.btn_form_save'); if (!b) return 'brak Zapisz';
    b.click(); await czekaj(3500);
    if (!await otworz()) return 'nie otworzyły się ustawienia do sprawdzenia';
    await pokaz();
    const zle = sekcjaWStronie(sk, true).zle; await zamknijModal();
    return zle.length ? (s.proby.finalAllegro < 2 ? 'ponów' : 'po zapisie nie zgadza się: ' + zle.join('; ')) : 'ok';
  };

  // FINALNE 2) parametry Allegro katalogu: mapowanie EAN = SKU (reguła „Wstaw SKU”)
  const toEAN = t => /^(EAN|GTIN)(\s*\((GTIN|EAN)\))?$/i.test(String(t || '').trim());
  KROK.finalEan = async (z, s) => {
    if (!s.katId) return 'brak ID katalogu';
    await czekajNa(() => [...document.querySelectorAll('button')].some(b => /Dodaj parametr/.test(b.textContent) && widoczny(b)), 60000);
    await czekaj(2000);
    const r = [...document.querySelectorAll('tr.paramMappingRow')].find(r => toEAN(r.querySelector('td[id^="cellServiceParam_"]')?.textContent));
    if (r) { const id = r.id.replace('row_', ''); const typ = document.getElementById('initialValueActionType_' + id)?.value; return typ === '5' ? 'ok' : 'jest już inne mapowanie EAN (reguła ' + typ + ') – popraw ręcznie'; }
    if (s.proby.finalEan > 2) return 'nie zapisało się';
    [...document.querySelectorAll('button')].find(b => /Dodaj parametr/.test(b.textContent) && widoczny(b)).click();
    const e = await czekajNa(() => document.getElementById('row_-1'), 8000); if (!e) return 'brak edytora';
    e.querySelector('.select2-selection').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await czekaj(800);
    const sz = document.querySelector('.select2-container--open .select2-search__field'); if (!sz) return 'brak wyszukiwarki parametru';
    sz.value = 'EAN'; sz.dispatchEvent(new Event('input', { bubbles: true })); sz.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    const o = await czekajNa(() => [...document.querySelectorAll('.select2-results__option')].find(o => toEAN(o.textContent)), 8000);
    if (!o) return 'brak parametru EAN na liście';
    for (const ev of ['mouseover', 'mousedown', 'mouseup']) o.dispatchEvent(new MouseEvent(ev, { bubbles: true })); o.click(); await czekaj(1500);
    const t = document.getElementById('editorActionType'); if (!t || ![...t.options].some(x => x.value === '5')) return 'brak reguły „Wstaw SKU”';
    ustawSelect(t, '5'); await czekaj(1200);
    const wh = document.getElementById('editorActionWhen'); if (wh) ustawSelect(wh, '0');
    await czekaj(600);
    document.getElementById('btnSaveEdition').click(); await czekaj(4000);
    return 'ponów';                                         // po odświeżeniu sprawdzi, czy jest EAN = Wstaw SKU
  };

  // =====================================================================
  // 👤 ZMIANA OSOBY KONTAKTOWEJ we wszystkich „Wysyłam z Allegro”: Marcel Teschner → TENEMONT SP. Z O.O.
  // =====================================================================
  const OSOBA_Z = 'Marcel Teschner', OSOBA_NA = NADAWCA.sender_person;
  function wszystkieWza() {
    const m = new Map();
    for (const tr of document.querySelectorAll('tr')) {
      const del = tr.querySelector('[onclick*="disableIntegration(\'allegrokurier\'"]'); if (!del) continue;
      const id = (del.getAttribute('onclick').match(/allegrokurier',\s*'(\d+)'/) || [])[1];
      if (id && !m.has(id)) m.set(id, { id, nazwa: tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) });
    }
    return [...m.values()];
  }
  async function startZmianaOsoby(lista) {
    if (zad()) return alert('Najpierw niech skończy zadanie Nowe sklepy (albo je zatrzymaj).');
    if (czytaj(L_OS, null)) return alert('Zmiana osoby już trwa – zobacz panel.');
    if (!naStronie('/list_integrations.php')) { localStorage.setItem('nsOsobaStart', '1'); log('👤 przechodzę na listę integracji…'); idz('/list_integrations.php'); return; }
    if (!await czekajNaFunkcje('openIntegrationSettings')) return alert('Nie wczytała się lista integracji');
    await czekaj(1000);
    lista = lista || wszystkieWza();
    if (!lista.length) return alert('Nie widzę żadnej integracji „Wysyłam z Allegro” na liście');
    if (!confirm('Zmienić osobę kontaktową nadawcy w integracjach „Wysyłam z Allegro”: ' + lista.length + '\n\n„' + OSOBA_Z + '” → „' + OSOBA_NA + '”\n\nZmienia TYLKO tam, gdzie jest „' + OSOBA_Z + '”. Inne (np. PRIMKS) zostawia i pokaże w podsumowaniu.\nStrony nie przełączaj w trakcie.')) return;
    pisz(L_OS, { lista, i: 0, wyniki: [], start: Date.now() });
    log('👤 START zmiany osoby kontaktowej: ' + lista.length + ' integracji');
    rysujPanel(); zmianaOsoby();
  }
  let osPracuje = false;
  async function zmianaOsoby() {
    if (osPracuje) return; osPracuje = true; bezOkienek();
    try {
      if (!await czekajNaFunkcje('openIntegrationSettings')) { log('👤 nie wczytała się lista integracji – odśwież stronę'); return; }
      await czekaj(1500);
      for (;;) {
        const j = czytaj(L_OS, null); if (!j) return;
        if (j.stop || j.i >= j.lista.length) break;
        const it = j.lista[j.i];
        let wyn;
        try { wyn = await zmienOsobeJednej(it); } catch (e) { wyn = { stan: 'blad', info: 'błąd: ' + (e && e.message || e) }; }
        const j2 = czytaj(L_OS, null); if (!j2) return;
        j2.wyniki.push({ ...it, ...wyn }); j2.i++; pisz(L_OS, j2);
        log('👤 ' + (wyn.stan === 'zmienione' ? '✔' : wyn.stan === 'blad' ? '❌' : '·') + ' ' + it.nazwa.slice(0, 50) + ' – ' + (wyn.info || wyn.stan));
      }
      const j = czytaj(L_OS, null); if (!j) return;
      await zamknijModal();
      pisz(L_OS_W, { ...j, koniec: Date.now() }); localStorage.removeItem(L_OS);
      const ile = st => j.wyniki.filter(w => w.stan === st).length;
      log('👤 KONIEC: zmienione ' + ile('zmienione') + ', już było ' + ile('juz') + ', inna osoba ' + ile('inna') + ', błędy ' + ile('blad') + (j.stop ? ' (zatrzymane)' : ''));
      powiadom('Osoba kontaktowa WzA – koniec', 'zmienione ' + ile('zmienione') + ', błędy ' + ile('blad'), ile('blad') ? 4 : 3);
      rysujPanel(); oknoOsobaWynik();
    } finally { osPracuje = false; }
  }
  async function zmienOsobeJednej(it) {
    const otworz = async () => { await zamknijModal(); W.openIntegrationSettings('allegrokurier', it.id); const ok = await czekajNa(() => document.getElementById('sender_person'), 30000); await czekaj(1500); return ok; };
    let el = await otworz();
    if (!el) return { stan: 'blad', info: 'nie otworzyły się ustawienia / brak pola osoby kontaktowej' };
    const bylo = el.value.trim();
    if (norm(bylo) === norm(OSOBA_NA)) { await zamknijModal(); return { stan: 'juz', info: 'już było ' + OSOBA_NA }; }
    if (norm(bylo) !== norm(OSOBA_Z)) { await zamknijModal(); return { stan: 'inna', info: 'inna osoba: „' + bylo + '” – nie ruszam' }; }
    const f = el.closest('form');
    const pane = f && f.closest('.tab-pane, [role=tabpanel]');
    if (pane && pane.id) { const a = document.querySelector('a[href="#' + pane.id + '"], [data-target="#' + pane.id + '"], [data-bs-target="#' + pane.id + '"]'); if (a) a.click(); await czekaj(700); }
    el = document.getElementById('sender_person');
    el.value = OSOBA_NA; zmien(el);
    const f2 = el.closest('form');
    const zap = f2 && [...f2.querySelectorAll('button, input[type=submit], input[type=button], a.btn')].find(x => /^\s*Zapisz\s*$/i.test(x.textContent || x.value));
    if (!zap) { await zamknijModal(); return { stan: 'blad', info: 'brak przycisku Zapisz' }; }
    zap.click(); await czekaj(4000);
    el = await otworz();
    const teraz = el ? el.value.trim() : '(brak)';
    await zamknijModal();
    return norm(teraz) === norm(OSOBA_NA) ? { stan: 'zmienione', info: OSOBA_Z + ' → ' + OSOBA_NA } : { stan: 'blad', info: 'po zapisie jest „' + teraz + '”' };
  }
  function oknoOsobaWynik() {
    const j = czytaj(L_OS_W, null); if (!j) return alert('Brak wyniku');
    document.querySelectorAll('.ns-os-okno').forEach(x => x.remove());
    const kol = { zmienione: ['✅', 'zmienione', '#7ee2a8'], juz: ['✔', 'już było', '#90caf9'], inna: ['➖', 'inna osoba – nie ruszone', '#ffb74d'], blad: ['❌', 'błąd', '#ff8a87'] };
    const ile = st => j.wyniki.filter(w => w.stan === st).length;
    const reszta = j.lista.length - j.wyniki.length;
    const o = nakladka(`<div style="font-size:17px;font-weight:bold;margin-bottom:6px">👤 Osoba kontaktowa „Wysyłam z Allegro” – podsumowanie${j.stop ? ' <span style="color:#ffb74d">(zatrzymane)</span>' : ''}</div>
      <div style="margin-bottom:10px">${Object.entries(kol).map(([k, [i, t, c]]) => '<span style="color:' + c + ';margin-right:14px">' + i + ' ' + t + ': <b>' + ile(k) + '</b></span>').join('')}${reszta ? '<span style="opacity:.7">· nie sprawdzone: ' + reszta + '</span>' : ''}</div>
      <div style="max-height:55vh;overflow:auto;background:#0f1720;border-radius:6px;padding:8px;font:12px/1.6 ui-monospace,Menlo,monospace">
        ${j.wyniki.slice().sort((a, b) => ['blad', 'inna', 'zmienione', 'juz'].indexOf(a.stan) - ['blad', 'inna', 'zmienione', 'juz'].indexOf(b.stan)).map(w => '<div>' + kol[w.stan][0] + ' ' + esc(w.nazwa) + ' <span style="color:' + kol[w.stan][2] + '">– ' + esc(w.info || '') + '</span></div>').join('')}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        ${ile('blad') || reszta ? `<button id="os-powt" style="${przycisk('#6a1b9a')}">🔁 Powtórz błędy${reszta ? ' + nie sprawdzone' : ''}</button>` : ''}
        <button id="os-zamknij" style="${przycisk('#555')}">Zamknij</button></div>`);
    o.classList.add('ns-os-okno');
    o.querySelector('#os-zamknij').onclick = () => o.remove();
    const pw = o.querySelector('#os-powt'); if (pw) pw.onclick = () => { const zrob = new Set(j.wyniki.map(w => w.id)); o.remove(); startZmianaOsoby([...j.wyniki.filter(w => w.stan === 'blad').map(({ id, nazwa }) => ({ id, nazwa })), ...j.lista.filter(x => !zrob.has(x.id))]); };
  }

  // ---------- start ----------
  rysujPanel();
  if (czytaj(L_OS, null) && naStronie('/list_integrations.php')) setTimeout(zmianaOsoby, 2500);
  else if (localStorage.getItem('nsOsobaStart') && naStronie('/list_integrations.php')) { localStorage.removeItem('nsOsobaStart'); setTimeout(() => startZmianaOsoby(), 2500); }
  if (zad() && !zad().pauza) setTimeout(silnik, 2500);
})();