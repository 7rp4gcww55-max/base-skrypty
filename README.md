# base-skrypty

Skrypty Tampermonkey do Base (BaseLinker). Aktualizują się same z tego repo.

## Instalacja (raz w każdym profilu przeglądarki)

Otwórz link, Tampermonkey pokaże okno instalacji → **Zainstaluj** / **Aktualizuj**:

- AutoMap (auto-mapowanie, wystawianie): https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-automap.user.js
- Strażnik: https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-automap-straznik.user.js
- Nowe sklepy: https://raw.githubusercontent.com/7rp4gcww55-max/base-skrypty/main/base-nowe-sklepy.user.js

## Narzędzia w przeglądarce

- PRZERABIACZ-4000 (nowe EAN-y + tytuły, bank zużytych EAN-ów): https://7rp4gcww55-max.github.io/base-skrypty/przerabiacz/

Bank EAN-ów zapisuje się w pamięci przeglądarki pod tym adresem. Adres jest stały, więc aktualizacje
narzędzia nie kasują banku. Nie używaj Safari — kasuje pamięć stron po ~7 dniach bez wejścia.
Co jakiś czas rób „Zrób kopię zapasową (.json)”.

## Aktualizacje

Tampermonkey sprawdza nowe wersje sam (ustawienie „Aktualizacje skryptów” → interwał).
Od razu: ikona Tampermonkey → **Sprawdź aktualizacje skryptów**.
