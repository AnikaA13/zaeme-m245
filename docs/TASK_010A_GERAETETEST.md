# TT05 · Physische Prüfung von F06

**Stand nach lokaler Integration 010B:** Android Chrome **NOT RUN**, iPhone Safari **NOT RUN**. Dieses Blatt für jede Plattform einmal kopieren. Für vergleichbare Ergebnisse dieselben 20 gut lesbaren EAN-13 auf Schweizer Lebensmittelverpackungen verwenden. Vor dem ersten Versuch Produkte und aufgedruckte Codes in fester Reihenfolge eintragen, einschliesslich eines Codes mit führender Null. Misserfolge als Versuche zählen.

Gerät / Modell ______ · Betriebssystem ______ · Browser / Version ______ · Datum ______ · Revision ______ · HTTPS-Ursprung ______ · Netz / Beleuchtung ______

1. Mit 011A/011B den ausdrücklich autorisierten HTTPS-Testursprung, Deployment-ID und ausgelieferten Commit der integrierten App bestätigen. In einem synthetischen Testhaushalt anmelden. Der 011A-Nachweis enthält noch keine freigegebene URL. Supabase bleibt lokal abgeschirmt. Im normalen Browser ohne vorgängige Kamerafreigabe öffnen.
2. Sicherstellen, dass die Kamera vor «Kamera starten» aus ist. Erstfreigabe, gewähltes Objektiv und Inline-Vorschau notieren. Rückkamera durch kurzes Abdecken bestätigen. Pro Versuch dieselbe Beleuchtung verwenden, Barcode mittig mit senkrechten Strichen ausrichten und ab Start maximal 15 Sekunden lesen lassen. Dies ist das vereinbarte Messfenster dieses Blatts.
3. Einen Decode nur werten, wenn alle 13 angezeigten Ziffern der Packung entsprechen. Als Produktnamen-Treffer nur einen zum Artikel passenden Namen aus der tatsächlichen API werten. Unbekannt, unvollständig, falscher Name, Rate Limit, Timeout und Netzfehler getrennt notieren. Ohne Decode «keine Abfrage» eintragen. Mindestens fünf Sekunden Abstand zwischen Netzwerkabfragen einhalten und bei 429 pausieren.
4. Die Erfassung abwechselnd auf Start und über das zentrale Hinzufügen beginnen. Zeitmessung mit der ersten Aktion zum Scannen starten. Vorschlag prüfen, nötige Korrektur notieren, ohne Datum oder mit dem tatsächlich abgelesenen Datum ausdrücklich speichern. Zeit bei bestätigter Anlage stoppen. Bei einem Fehlschlag den manuellen Weg und seine Zeit separat notieren. Nach jedem Versuch Freigabe der Kamera und genau eine beabsichtigte Charge im Vorrat prüfen. Über «Weiter scannen» bewusst neu starten.

| Versuch | EAN laut Packung / Artikel | Decode (Wert / Fehler) | OFF (Name / Zustand) | Freigabe / Rückkamera | Korrektur / Fallback | Zeit bis Decode / bestätigtem Speichern (s) | Kamera frei / Bemerkung |
| ------- | -------------------------- | ---------------------- | -------------------- | --------------------- | -------------------- | ------------------------------------------- | ----------------------- |
| 1       |                            |                        |                      |                       |                      |                                             |                         |
| 2       |                            |                        |                      |                       |                      |                                             |                         |
| 3       |                            |                        |                      |                       |                      |                                             |                         |
| 4       |                            |                        |                      |                       |                      |                                             |                         |
| 5       |                            |                        |                      |                       |                      |                                             |                         |
| 6       |                            |                        |                      |                       |                      |                                             |                         |
| 7       |                            |                        |                      |                       |                      |                                             |                         |
| 8       |                            |                        |                      |                       |                      |                                             |                         |
| 9       |                            |                        |                      |                       |                      |                                             |                         |
| 10      |                            |                        |                      |                       |                      |                                             |                         |
| 11      |                            |                        |                      |                       |                      |                                             |                         |
| 12      |                            |                        |                      |                       |                      |                                             |                         |
| 13      |                            |                        |                      |                       |                      |                                             |                         |
| 14      |                            |                        |                      |                       |                      |                                             |                         |
| 15      |                            |                        |                      |                       |                      |                                             |                         |
| 16      |                            |                        |                      |                       |                      |                                             |                         |
| 17      |                            |                        |                      |                       |                      |                                             |                         |
| 18      |                            |                        |                      |                       |                      |                                             |                         |
| 19      |                            |                        |                      |                       |                      |                                             |                         |
| 20      |                            |                        |                      |                       |                      |                                             |                         |

**Auswertung pro Gerät:** korrekte Decodes ____ / 20 (Ziel ≥18). Passende Produktnamen ____ / 20 (Ziel ≥14). Der Nenner umfasst alle 20 Versuche. Median bei richtig erkannten bekannten Produkten von Start bis zur bestätigten Anlage ____ s (Ziel ≤20 s), Anzahl auswertbarer Zeiten ____. Abbrüche und manuelle Ersatzwege gesondert ausweisen. Ohne Messungen bleibt G04 offen.

## Weitere Beobachtungen je Gerät

| Handlung                                                                                             | Erwartung                                                                                       | Beobachtung |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------- |
| Berechtigung zurücksetzen, Start, Erlaubnis verweigern                                               | Verständliche Meldung, manuelle Eingabe möglich, kein erneuter Dialog ohne Klick                |             |
| Nach Start vor Antwort abbrechen, dann erlauben, sofern das System den Abbruch zulässt               | Verspätete Tracks enden, Ansicht bleibt geschlossen                                             |             |
| Abbrechen bei laufendem Video, zurück navigieren, anderen Tab öffnen, Gerät sperren und zurückkehren | Kameraindikator erlischt, Kamera-App kann übernehmen, kein automatischer Neustart               |             |
| Unbekanntes Produkt, unterbrochenes Netz, Wechsel zu «Manuell erfassen» während Lookup               | Gültige EAN bleibt editierbar, verspätete Antwort überschreibt keine Eingabe                    |             |
| Zweites Mal starten, Produktnamen korrigieren                                                        | Ein Treffer pro Start, Kamera danach frei, Daten erst nach Bestätigung im integrierten Formular |             |
| In 010B Sitzung/Mitgliedschaft im Scanner invalidieren                                               | Kamera endet, kein verspäteter Produktvorschlag im nächsten Konto                               |             |

Nur Barcode, Ergebnis und technische Beobachtungen protokollieren. Keine Bilder, Videos, Konten oder Sitzungsdaten beilegen.
