# Task 009B · Übergabe an Task 011B

Der lokale Abnahmelauf für Einkauf, Warnfrist und Synchronisation ist bestanden. Drei Personen teilten einen Testhaushalt. Die vierte Person blieb in einem eigenen Haushalt. Unter den stabilen lokalen Prüfbedingungen lagen alle gemessenen sichtbaren Aktualisierungen innerhalb von drei Sekunden. 49 Beobachtungen ab bestätigter Serverantwort ergaben einen Median von 761 ms und ein Maximum von 1295 ms. Die zwei Netzrückkehrmessungen dauerten 925 und 340 ms.

## Git und Lieferumfang

| Stand                                | Commit                                     |
| ------------------------------------ | ------------------------------------------ |
| Task 008                             | `03389b3513a32432702179db5e1accdcf737bca5` |
| Basis mit gemergtem PR #4 auf `main` | `a17f15d9c3f4e532be204136782adc5f36bf5b2b` |
| Verifiziertes Backend 009A           | `d2459cb8071935f65a59fefdb3eb1db6fc7b44a5` |
| Lokaler Merge mit beiden Eltern      | `b48e0bba46a901fb65fa95c8f3f0865d2e2b7605` |

Der Worktree liegt unter `C:/Users/Anika Aepli/source/repos/zaeme-m245-task009b`. Der Branch heisst `feature/m5-shopping-realtime-integration`. Sein Abschlusscommit trägt den Betreff `feat: integrate shopping realtime synchronization and household settings`. Das Git-Archiv enthält dessen Hash im ZIP-Kommentar. Es umfasst die geänderten Dateien gegenüber der oben angegebenen Hauptbranchbasis. Es gab keinen Push und keinen Merge nach `main`.

Einkauf verwendet die vier Einkaufs-RPCs, die Warnfrist verwendet `set_warning_days`. Im Produktdetail übernimmt ein Formular den Namen. Erst Speichern erstellt den Wunsch. Abhaken und Wiederöffnen senden den gewünschten Zustand und die erwartete Version. Nach Antwortverlust bleibt der Auftrag an seine ursprünglichen Parameter und die Operations-ID gebunden. Die Migrationen stammen aus 009A. Die Datenbanktypen wurden aus allen sechs Migrationen neu erzeugt. Die Laufzeitabhängigkeiten und die Lockdatei blieben unverändert.

## Lokale Verifikation

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run test` und `npm run build` bestanden. Vitest meldete 104 Tests in elf Dateien. Der Produktionsbuild meldete den JavaScript-Chunk mit 557,90 kB und 162,28 kB gzip.
- `db:start`, `db:upgrade:check` und `db:upgrade:shopping` prüften die frische Installation und beide Upgradepfade. `db:test`, `db:test:api`, `db:test:shopping` und `db:test:realtime` bestanden mit 307 pgTAP-Prüfungen sowie 22, 6 und 1 Node-Testeinträgen. `db:types` und `db:types:check` belegten die Übereinstimmung mit der laufenden Datenbank.
- `test:browser` bestand alle 34 Szenarien des kombinierten Laufs. `test:browser:shopping` prüfte die sieben Einkaufs- und Synchronisationsszenarien zusätzlich mit einem separat angelegten Haushalt. Die lokalen Testkonten wurden nach jedem Lauf bereinigt.
- Beide Einkaufszustände wurden über die Grenze von 100 Einträgen hinaus geprüft. Die Browser prüften das Bestätigen und Abbrechen, identische Wiederholung nach Antwortverlust, konkurrierende Versionen vor sowie nach Signaleingang, Tokenrotation, Netzrückkehr und die Abgrenzung zum fremden Haushalt. Der kombinierte Lauf prüfte zudem Entzug ohne manuellen Fokuswechsel, Kanalabbau, Wiederbeitritt mit neuer Generation sowie verspätete Antworten beim Kontowechsel.
- Die Layoutprüfung verwendete 320, 375, 390, 430 und 1280 CSS-Pixel sowie 100 und 200 Prozent Schriftgrösse. Sie mass mindestens 44 × 44 CSS-Pixel für sichtbare Bedienelemente. [Einkauf](review/task009b/einkauf.png) · [Warnfrist](review/task009b/warnfrist.png)

## Sichtbare Synchronisation

Node mass mit einer monotonen Uhr vom Eintreffen der HTTP-Antwort beim schreibenden Browser bis zur bestätigten sichtbaren Änderung beim Empfänger. Der Test prüfte zusätzlich die erfolgreiche RPC-Quittung. Bei mehreren Empfängern zählt jede beobachtete Ansicht einzeln. Bei der Netzrückkehr beginnt die Messung mit dem Einschalten des Netzwerks im Browserkontext. Die Zuordnung der Messpunkte zu den Aktionen ist im [Browsertest](../scripts/database/browser-shopping.mjs) und für den [Entzug](../scripts/database/browser-inventory.mjs) hinterlegt.

| Beobachtung                             | Anzahl | Median (ms) | Maximum (ms) |
| --------------------------------------- | -----: | ----------: | -----------: |
| Vorrat anlegen                          |      4 |      1023,5 |         1256 |
| Vorrat bearbeiten                       |      2 |       784,5 |          799 |
| Teilverbrauch                           |      2 |         763 |          763 |
| Reservieren                             |      2 |      1044,5 |         1295 |
| Reservierung freigeben                  |      2 |         819 |          850 |
| Warnfrist 0                             |      2 |         689 |          740 |
| Warnfrist 7                             |      4 |         705 |         1191 |
| Warnfrist 30                            |      2 |         435 |          663 |
| Warnfrist 3                             |      4 |       729,5 |          745 |
| Anzeigename                             |      2 |         772 |          783 |
| Einkauf anlegen                         |      4 |         770 |          784 |
| Abhaken                                 |      4 |      1201,5 |         1225 |
| Wieder öffnen                           |      4 |       718,5 |         1241 |
| Einkauf bearbeiten                      |      2 |       971,5 |         1228 |
| Einkauf entfernen                       |      2 |         722 |          734 |
| Netzrückkehr                            |      2 |       632,5 |          925 |
| Vorratscharge löschen                   |      2 |       185,5 |          200 |
| Reservierung ändern nach Folgeaufträgen |      2 |       531,5 |          796 |
| Vollverbrauch                           |      2 |       544,5 |          823 |
| Mitgliedschaftsentzug                   |      1 |         735 |          735 |

Die Zahlen stammen aus dem [Einzellauf](review/task009b/messungen-einzellauf.json), dem [kombinierten Lauf](review/task009b/messungen.json) und der [Entzugsmessung](review/task009b/entzug.json). Der Client mit emulierter Netztrennung lief in einem eigenen Chromium-Prozess. Der Test verlangte echte WebSocket-Updates in zwei berechtigten Browsern. Die Performanceprüfung mit über 1000 Vorratschargen lief nach den Latenzmessungen. Ein früherer Lauf erreichte dabei das lokale Realtime-Nachrichtenlimit. Die Revisionsnachprüfung fängt ausgelassene Meldungen auf. Die zeitweise gemeinsame Netzsimulation in einem Chromium-Prozess überschritt in zwei Diagnoseversuchen das Dreisekundenziel. Einzelheiten stehen im [Prüfbericht](TEST_REPORT.md).

## Wiederholung und offene Abnahmen

Im 009B-Worktree unter PowerShell `$env:ZAEME_TEST_STACK='task012'` setzen. `npm ci`, `npm run db:start` und die oben aufgeführten npm-Skripte ausführen. `$env:ZAEME_009B_REVIEW='1'` schreibt Messungen und Screenshots ins Reviewverzeichnis. Sonst schreibt der Browserlauf nach `test-results/task009b`. Die Browser beziehen ihre öffentliche Konfiguration aus dem ausgewählten lokalen Stack.

Für Task 011B stehen Hosted- und Geräteabnahme aus. Zwei reale Geräte am gehosteten Haushalt anmelden, Einkauf und Vorrat gemeinsam ändern und die Sichtbarkeit einschliesslich Netzwechsel messen. Auf kleinen Displays die Softwaretastatur, Safe Area und Bedienung mit VoiceOver oder TalkBack prüfen. Kamera, Produktsuche und physische PWA-Installation haben eigene Abnahmen. Für G01–G08 sind reale Teilnehmende erforderlich.
