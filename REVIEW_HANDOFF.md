# zäme · Review Task 010A

Der lokale Branch `feature/m6-barcode-lookup-core` baut auf `b229f9354c73332b0da8f0c82bdfdd6795bcb02d` auf. F06 liefert einen geprüften Barcode und eine editierbare Vorbelegung. Task 010B bindet beides in die gemeinsame F05-Erfassung ein. [Schnittstellen und Lebenszyklus](docs/TASK_010B_VERTRAG.md) · [Physisches Testblatt für TT05](docs/TASK_010A_GERAETETEST.md)

## Reproduktion

Im vollständigen Checkout des Branches mit Node 24 und npm 11 zuerst `npm ci` ausführen. `npm run test -- src/features/barcode` prüft die Module. `npm run test:scanner:browser` startet Vite auf **127.0.0.1:5210**, erzeugt im temporären Verzeichnis eine Y4M-Datei mit einem EAN-13-Strichmuster und startet Playwright Chromium mit dieser Datei als Kamera. Der Lauf schliesst Browser und Server und entfernt die Datei. Bei fehlendem Testbrowser zuerst `npx playwright install chromium` ausführen. Der Lauf benötigt weder Supabase noch Anmeldedaten.

Für die manuelle Prüfung `npm run dev -- --host 127.0.0.1 --port 5210 --strictPort` starten und `http://127.0.0.1:5210/dev/scanner.html` öffnen. Ein Klick auf «Kamera starten» öffnet die Kamera. «Manuell erfassen» übernimmt einen bereits erkannten Code. Name und Code sind bearbeitbar. Das ZIP ist ein Review-Auszug der geänderten Dateien. Zum Wiederholen der Prüfungen den vollständigen Checkout verwenden. Die ZIP-Kommentardaten von `git archive` enthalten den Implementierungscommit.

## Ausgeführte Prüfungen am 27.11.2026

| Prüfung                                                     | Ergebnis                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                    | 281 Pakete installiert, npm-Audit meldete 0 bekannte Schwachstellen. npm meldete eine Deprecation der vorhandenen ESLint-Version.                                                                                                                              |
| `npm run lint`, `npm run typecheck`, `npm run format:check` | Bestanden.                                                                                                                                                                                                                                                     |
| `npm run test -- src/features/barcode`                      | 50 bestanden, 3 Dateien. Validator, Lebenszyklus mit gemockter Kamera/Decoder, HTTP-Zustände mit gemocktem Fetch. Darunter verzögerte Erlaubnis nach Abbruch, Unmount, Sitzung, Hintergrund, doppelte Starts, Sperre bei 429 und Request-Abbruch nach 5000 ms. |
| `npm run test`                                              | 85 bestanden, 10 Dateien. Die 50 neuen Prüfungen sind in den 85 enthalten.                                                                                                                                                                                     |
| `npm run test:scanner:browser`                              | Chromium 159.0.8154.6 unter Windows. Zwei optische Lesungen derselben generierten Videofixture `0034000470693`. Je ein GET, Originalcode, editierbares Feld und beendete Medientracks geprüft. HTTP-Ergebnisse im Browserprüflauf simuliert.                   |
| Browserkontext                                              | Reales Chromium meldete auf Loopback einen sicheren Kontext. Auf einem lokal beantworteten HTTP-Testursprung ausserhalb von Loopback waren `isSecureContext === false` und `navigator.mediaDevices?.getUserMedia` undefiniert.                                 |
| `npm run build`, Produktionsprüfung                         | Build bestanden. Die App erzeugt ein JS-Bundle von 510,55 kB (149,04 kB gzip). Vite meldet die Warnschwelle von 500 kB. Im App-Modulgraphen sind **0** Module aus Scanner, ZXing und Prüfstand. In `dist` liegen App-HTML, JS, CSS, Logo und Manifest.         |
| `git diff --check` und Prüfung des gestagten Diffs          | Bestanden.                                                                                                                                                                                                                                                     |
| Physisches Android Chrome                                   | **NOT RUN**. Kein bedienbares Testtelefon in dieser Sitzung.                                                                                                                                                                                                   |
| Physisches iOS Safari                                       | **NOT RUN**. Kein bedienbares Testtelefon in dieser Sitzung.                                                                                                                                                                                                   |

Die Videofixture prüft einen idealen Barcode mit senkrechten Strichen. Fokus, Objektivwahl, Reflexionen, echte Systemdialoge und Kamerafreigabe am Telefon benötigen das Gerätetestblatt. Die Ziele 18/20 Decodes und 14/20 richtige Produktnamen haben noch keinen physischen Messwert. Die Zeit bis zur bestätigten Erfassung folgt nach Integration.

## Live-Abfrage bei Open Food Facts

Am 27.11.2026 (Europe/Zurich) wurde `/api/v3/product/{code}.json?fields=product_name_de,product_name` auf `world.openfoodfacts.org` kontrolliert gelesen. Der CLI-Test verwendete die Projektkennung `zaeme/0.1.0` mit öffentlicher Repository-URL als Kontakt und fünf Sekunden Frist. Der zweite Test lief aus dem echten Lookup-Modul im Chromium-Loopback-Ursprung. Beide Browserantworten erlaubten CORS mit `Access-Control-Allow-Origin: *`.

| Gültige EAN     | HTTP und fachliche Antwort                                                               | curl    | Chromium-Modul   |
| --------------- | ---------------------------------------------------------------------------------------- | ------- | ---------------- |
| `3017620422003` | 200, passender Code, `success / product_found`, deutscher und allgemeiner Name «Nutella» | 0,683 s | `found`, 319 ms  |
| `2999999876544` | 404, passender Code, `failure / product_not_found`                                       | 0,324 s | `unknown`, 50 ms |

Ein zusätzlicher früher CLI-Probeabruf mit falscher Prüfziffer lieferte 404. Er zählt nicht zur gültigen Stichprobe. Insgesamt drei CLI-GETs und zwei Browser-GETs. Weder ein Live-Timeout noch ein HTTP 429 wurde provoziert. Beide Zustände sind automatisiert mit HTTP-Mocks geprüft. Der Browser setzt seine eigene Kennung. Eine anwendungsspezifische Kennung auf Anbieter-Seite ist für diesen Browserlauf ungeprüft. [Produktdaten von Open Food Facts](https://world.openfoodfacts.org/product/3017620422003) · [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) · [API und Nutzungsvorgaben](https://openfoodfacts.github.io/openfoodfacts-server/api/)

## Abhängigkeiten und Grösse

Node 24.14.1, npm 11.21.3, TypeScript 5.9.3, Vite 8.3.8 und Playwright 1.65.1. Ein neuer direkter Laufzeitbaustein, `@zxing/library` 0.23.0 (Apache-2.0, Node ≥24). Die Sperrdatei ergänzt `ts-custom-error` 3.3.1 (MIT) und optional `@zxing/text-encoding` 0.9.0 (Unlicense oder Apache-2.0). Paketentscheid und Upstream-Wartungsmodus sind im [Entscheidungsprotokoll](docs/DECISIONS.md) festgehalten.

Separater minifizierter Vite-Messbuild im Speicher mit Scanner und Lookup als benannten Einstiegen und erhaltenen Exporten. Jeweils Dateigrösse / gzip in Bytes. Scanner 3675 / 1722, Lookup 1909 / 1013, gemeinsame EAN-Prüfung 260 / 223, dynamischer Decoder 53825 / 14158. Die konkrete Aufteilung kann sich beim Einbinden in F05 ändern. Der aktuelle App-Einstieg importiert keinen dieser Chunks.
