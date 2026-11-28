# Task 010B · Scanner im gemeinsamen Vorrat

## Übergabe an 011B

Der Branch `feature/m6-scanner-integration` im Worktree `zaeme-m245-task010b` basiert auf dem mit GitHub abgeglichenen `main` bei `a17f15d9c3f4e532be204136782adc5f36bf5b2b`. Darin ist Task 008 mit `03389b3` enthalten. Der lokale Merge `b6b8885` verbindet diese Basis mit dem vollständigen 010A-Commit `835a7b4c26a2703e88dd66da983ec00661865ae3`. In Changelog, Projektstand und Entscheidungsprotokoll wurden die drei Dokumentationskonflikte einzeln aufgelöst. Das ZIP enthält den Diff-Dateisatz seit dieser Main-Basis. Der Git-Archivkommentar nennt die vollständige Implementierungs-SHA. Die finale Integration liegt bei 011B.

## Bedienung und Datenfluss

Auf Start oder über das zentrale «Hinzufügen» stehen «Lebensmittel scannen» und «Manuell hinzufügen» zur Wahl. Der bewusste Klick auf «Kamera starten» fordert die rückwärtige Kamera als Präferenz an. Der lokale EAN-13-Decoder beendet nach einem gültigen Code die Kamera. Der Browser fragt nur den Produktnamen ab. Bei einem Treffer können alle Vorschläge korrigiert werden. Ohne brauchbare Antwort oder nach manuellem Abbruch der Suche bleibt der Originalcode im Formular. Datum und Datumsart bleiben offen.

Erst «Zum Vorrat hinzufügen» verwendet den Schreibweg aus Task 008. Ein Doppelklick erzeugt eine Charge. Eine verlorene Quittung sperrt weitere Anlagen bis zur Klärung. Die identische Wiederholung verwendet dieselbe Operations-ID. «Weiter scannen» beginnt nach der Bestätigung einen neuen Versuch. Session, Mitgliedschaft, Routenwechsel, Unmount und Hintergrund begrenzen Kamera und Produktsuche. [Anschlussvertrag](TASK_010B_VERTRAG.md) · [Schreibvertrag](TASK_008_ANSCHLUSS.md)

## Lokale Prüfungen am 28. November 2026

Windows x64, Node 24.14.1, npm 11.21.3, Playwright 1.65.1, Chromium 159.0.8154.6. Der eigene Stack `zaeme-task010-local` bindet die API auf 127.0.0.1:56821 und PostgreSQL auf Port 56822. Die Browser verwenden den Loopback-Ursprung 127.0.0.1:5173. Alle Konten, Haushaltsnamen, Bilder und Produktangaben im App-Test sind synthetisch.

| Ausgeführter Befehl                                                      | Ergebnis                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci --offline --no-audit --no-fund`, `npm ls --depth=0`              | Lockdatei installiert, Abhängigkeitsbaum vollständig. ZXing 0.23.0 stammt aus 010A.                                                                                                                        |
| `npm run lint`, `npm run typecheck`, `npm run format:check`              | Bestanden.                                                                                                                                                                                                 |
| `npm run test`                                                           | 161 Tests in 15 Dateien. Darin acht neue Komponententests für Abbruch, Hintergrund, Sitzung, Unmount, fehlende Metadaten und Anfragelimit. Ein früher Typfehler im Testhelfer wurde für ES2022 korrigiert. |
| `npm run test:scanner:browser`                                           | Zwei echte optische Lesungen derselben synthetischen EAN `0034000470693`. Je ein kontrollierter Lookup und beendete Videospuren.                                                                           |
| `npm run db:start`, `npm run db:upgrade:check`, `npm run db:types:check` | Vier Migrationen, Upgrade mit bestehenden Haushaltsdaten und Typvergleich bestanden.                                                                                                                       |
| `npm run db:test`, `npm run db:test:api`                                 | 243 pgTAP-Prüfungen. 21 fachliche HTTP-Szenarien, 22 bestandene Node-Tests einschliesslich Rahmenprüfung.                                                                                                  |
| `npm run test:browser`                                                   | 33 benannte Gruppen einschliesslich sechs neuer Scangruppen, echter Anmeldung, Mailpit und SQL-Gegenprüfung. Testkonten nach dem Lauf bereinigt.                                                           |
| `npm run build`                                                          | 135 Module. Start-JS 547,32 kB, Scanansicht 8,35 kB, Decoder 53,82 kB. Vite meldet weiterhin die bestehende 500-kB-Warnschwelle. Lizenztexte in `dist/drittlizenzen.txt` geprüft.                          |

**Browserprüfung.** A prüft beide Einstiege, Ursprung und Fokus sowie die verspätete Übergabe eines echten Fixture-Streams nach Abbruch. B verweigert die Berechtigung im vollständigen Chromium und wechselt manuell. C prüft einen gelesenen Code, einen editierten Vorschlag, leeres Datum, beendete Tracks und Doppelklick. Vor dem Submit waren RPC-Zähler und SQL-Chargenzähler null. D erfasst dasselbe Produkt als bewusste zweite Charge, verliert eine bereits quittierte HTTP-Antwort und prüft die ursprüngliche ID beim Retry. E prüft Netzfehler, die tatsächliche Fünf-Sekunden-Frist und manuellen Suchabbruch. F prüft das Track-Ende nach Navigation und Logout bei laufender Suche. Die Sichtprüfung führte zu einer Korrektur beim Weiterscannen. Die Bestätigung der vorherigen Charge wird vor dem nächsten Versuch geräumt. Der Browserlauf nutzt kontrollierte OFF-Antworten. Die integrierte 008-Suite prüft weiterhin manuelle Anlage, Verbrauch und Reservierung.

Zwei frühe Läufe machten eine Einschränkung der Chromium-Headless-Shell sichtbar. Automatische Medienfreigabe überstimmte die Ablehnung. Ohne diese Option meldete die Shell für beide Entscheidungen einen nicht unterstützten Zugriff. Der vollständige Chromium-Browser lieferte bei derselben Fixture je nach ausdrücklich gesetzter Berechtigung einen Stream oder `NotAllowedError`.

**Startdownload.** Ein Vergleichsbuild von 008 mit denselben Vite-/React-Versionen und ohne umgebungsspezifische Werte ergab 543 465 Bytes Start-JavaScript, 157 185 Bytes mit Node-gzip. Der fertige 010B-Build ergab 547 329 / 158 510 Bytes. Der Zuwachs beträgt 3 864 / 1 325 Bytes. In der lokalen Produktionsvorschau beobachtete Chromium beim ersten Seitenaufruf genau ein angefordertes Skript, das Hauptbundle. Die Scanansicht wird beim Öffnen geladen, der Decoder nach Kamerafreigabe.

## Live-Anbieter und Quellen

Ein separater Chromium-Kontext rief das tatsächliche Lookup-Modul am 28.11.2026 über den lokalen Prüfstand ohne Anmeldung auf. Der Prüfclient verwendete die Kennung `zaeme/0.1.0` mit öffentlicher Repository-URL. `3017620422003` ergab `found` mit «Nutella» in 259 ms, `2999999876544` ergab `unknown` in 38 ms. Das sind zwei Einzelabfragen. Der frühere 010A-Nachweis enthält weitere getrennte CLI- und Browserproben. [Prüfprotokoll 010A](TASK_010A_PRUEFBERICHT.md)

Beim Namensvorschlag und am Produktdetail mit EAN verweist die App auf Open Food Facts und die ODbL. Der Request verzichtet auf Cookies, Referrer und Anmeldedaten. Die reguläre App verwendet den vom Browser gesetzten User-Agent. Vor öffentlichem Betrieb müssen 011A/011B die Anbieterkennung und die Nutzungsanmeldung klären oder den im Vertrag beschriebenen engen, identifizierten Produktzugriff bereitstellen. Die Live-Probe belegt den Zugriff des bezeichneten Prüfclients. [Anbietervorgaben](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) · [Datenlizenzen](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/)

## Wiederholen und visuell prüfen

Im vollständigen Branch mit Node 24 und npm 11 die Abhängigkeiten installieren. Für Datenbank- und App-Browserbefehle in PowerShell `$env:ZAEME_TEST_STACK='task010'` setzen. `npm run db:start` starten und vor dem App-Lauf Port 5173 freihalten. Der isolierte optische Prüfstand benötigt Port 5210. `npx playwright install chromium` installiert den vollständigen Browser und die Shell. Für neue Bildnachweise `$env:ZAEME_SCAN_SCREENSHOTS='1'` setzen und `npm run test:browser` ausführen. Abschliessend beendet `npm run db:stop` bei derselben Stackauswahl ausschliesslich diesen Stack.

Die Bildnachweise zeigen die tatsächliche App mit synthetischer Kamera. Die zwei Formularansichten verwenden eine höhere Aufnahmefläche für Barcode und Speicherschaltfläche. [Auswahl](review/task010b/auswahl.png) · [Aktive Kamera](review/task010b/kamera-fixture.png) · [Produktprüfung](review/task010b/produktpruefung.png) · [Unbekanntes Produkt](review/task010b/unbekannt.png) · [Verweigerte Kamera](review/task010b/kamera-gesperrt.png) · [Bestätigte Anlage](review/task010b/gespeichert.png)

## Releaseprüfungen

| Prüfung                                                                                                        | Stand       |
| -------------------------------------------------------------------------------------------------------------- | ----------- |
| Android Chrome auf physischem Gerät                                                                            | **NOT RUN** |
| iOS Safari auf physischem Gerät                                                                                | **NOT RUN** |
| Zeit und Erfolgsquoten mit Lebensmittelverpackungen, VoiceOver/TalkBack, Bildschirmtastatur und Browserleisten | **NOT RUN** |
| Nutzertest mit Haushalten                                                                                      | **NOT RUN** |

Der geprüfte 011A-Stand `a58b0d1` enthält noch keinen autorisierten HTTPS-Ursprung mit Deployment-ID und ausgeliefertem Commit. Für beide Plattformen fehlen bedienbare Testgeräte. Auf dem freigegebenen Build pro Plattform dasselbe 20er-Blatt vollständig erheben. Die Ziele sind mindestens 18/20 korrekte Decodes, 14/20 passende Produktnamen und ein Median von höchstens 20 Sekunden bis zur bestätigten Anlage bei bekannten Produkten. Die Geräteabnahme bleibt ein Release-Blocker. [Schritte, Messfelder und Abbruchfälle](TASK_010A_GERAETETEST.md) · [Anforderungsmatrix](IMPLEMENTATION_STATUS.md)
