# TT05 · Physische Prüfung von F06

**Stand bei Übergabe:** Android Chrome **NOT RUN**, iPhone Safari **NOT RUN**. Dieses Blatt für jede Plattform einmal kopieren. Für vergleichbare Ergebnisse dieselben 20 gut lesbaren EAN-13 auf Schweizer Lebensmittelverpackungen verwenden. Vor dem ersten Versuch Produkte und aufgedruckte Codes in fester Reihenfolge eintragen, einschliesslich eines Codes mit führender Null. Misserfolge als Versuche zählen.

Gerät / Modell ______ · Betriebssystem ______ · Browser / Version ______ · Datum ______ · Revision ______ · HTTPS-Ursprung ______ · Netz / Beleuchtung ______

1. Mit 011A einen kontrollierten HTTPS-Testursprung für das Testgerät bereitstellen. Nur den isolierten Scanner oder später die geschützt integrierte Testversion ausliefern. Supabase bleibt lokal abgeschirmt. Im normalen Browser ohne vorgängige Kamerafreigabe öffnen.
2. Sicherstellen, dass die Kamera vor «Kamera starten» aus ist. Erstfreigabe, gewähltes Objektiv und Inline-Vorschau notieren. Rückkamera durch kurzes Abdecken bestätigen. Pro Versuch dieselbe Beleuchtung verwenden, Barcode mittig mit senkrechten Strichen ausrichten und ab Start maximal 15 Sekunden lesen lassen. Dies ist das vereinbarte Messfenster dieses Blatts.
3. Einen Decode nur werten, wenn alle 13 angezeigten Ziffern der Packung entsprechen. Als Produktnamen-Treffer nur einen zum Artikel passenden Namen aus der tatsächlichen API werten. Unbekannt, unvollständig, falscher Name, Rate Limit, Timeout und Netzfehler getrennt notieren. Ohne Decode «keine Abfrage» eintragen. Mindestens fünf Sekunden Abstand zwischen Netzwerkabfragen einhalten und bei 429 pausieren.
4. Nach jedem Versuch prüfen, dass die Kamera freigegeben wurde. Auf dem Prüfstand Barcode und Name bearbeiten. Für jeden neuen Versuch bewusst starten. Bei integriertem F05 erst nach Bestätigung speichern.

| Versuch | EAN laut Packung / Artikel | Decode (Wert / Fehler) | OFF (Name / Zustand) | Zeit bis Decode (s) | Kamera frei / Bemerkung |
| ------- | -------------------------- | ---------------------- | -------------------- | ------------------- | ----------------------- |
| 1       |                            |                        |                      |                     |                         |
| 2       |                            |                        |                      |                     |                         |
| 3       |                            |                        |                      |                     |                         |
| 4       |                            |                        |                      |                     |                         |
| 5       |                            |                        |                      |                     |                         |
| 6       |                            |                        |                      |                     |                         |
| 7       |                            |                        |                      |                     |                         |
| 8       |                            |                        |                      |                     |                         |
| 9       |                            |                        |                      |                     |                         |
| 10      |                            |                        |                      |                     |                         |
| 11      |                            |                        |                      |                     |                         |
| 12      |                            |                        |                      |                     |                         |
| 13      |                            |                        |                      |                     |                         |
| 14      |                            |                        |                      |                     |                         |
| 15      |                            |                        |                      |                     |                         |
| 16      |                            |                        |                      |                     |                         |
| 17      |                            |                        |                      |                     |                         |
| 18      |                            |                        |                      |                     |                         |
| 19      |                            |                        |                      |                     |                         |
| 20      |                            |                        |                      |                     |                         |

**Auswertung pro Gerät:** korrekte Decodes ____ / 20 (Ziel ≥18). Passende Produktnamen ____ / 20 (Ziel ≥14). Der Nenner umfasst alle 20 Versuche. Der Median ≤20 s von Start bis bestätigter Erfassung gehört zum integrierten Ablauf G04. Im isolierten Prüfstand wird er nicht erhoben.

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
