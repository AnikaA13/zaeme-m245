# zäme 0.1.0 · Technische Freigabeprüfung vom 28. November 2026

**READY FOR CODE MERGE, RELEASE BLOCKED.** Der Code ist bereits in main integriert. Die geschützte interne Preview funktioniert. Für die Einladung von Haushalten fehlen reale E-Mail-Zustellung, Geräteabnahme und der Entscheid der Projektgruppe über Teilnehmerzugang und Datenaufbewahrung.

| Freigabepunkt | Beleg |
| --- | --- |
| Quellstand und Auslieferung | `123d02b674759dfc2253827ab4af5a47710cbf43`, Baum `b4bdb0714987730045e2b3998a40c265babbf5ca`. Der zweite Elterncommit `3a81f5de0691072881fd35ce9edee59642898327` hat denselben Baum. |
| Interne HTTPS-App | [Geschützte zäme-Preview](https://zaeme-m245-182mg7h5p-zaeme1.vercel.app). Vercel bestätigt manuelles CLI-Deployment `dpl_ED1RcAtHu9HFSnCugeoEkx15egBo`, Umgebung Preview, Node 24.x, Vite, npm ci, npm run build, dist und api/product als Function. Anonyme HTTPS-Anfrage beantwortet mit 302 zur Vercel-Anmeldung. |
| Integration und CI | [PR #5](https://github.com/AnikaA13/zaeme-m245/pull/5) mit Merge `de72cf659b5f59c5cc923d2faeab42990bfb21d5` und Kandidat `0a2be630344ca0adc38611834ada5dd90aabb989`. [Qualität](https://github.com/AnikaA13/zaeme-m245/actions/runs/46137286711), [Datenbank und Browser](https://github.com/AnikaA13/zaeme-m245/actions/runs/46137286870) und [main](https://github.com/AnikaA13/zaeme-m245/actions/runs/46137719305) bestanden. |
| Korrektur und CI | [PR #6](https://github.com/AnikaA13/zaeme-m245/pull/6) behebt den auf der ersten Preview beobachteten HTTP-500-Modulfehler. [Qualität](https://github.com/AnikaA13/zaeme-m245/actions/runs/46138856859), [Datenbank und Browser](https://github.com/AnikaA13/zaeme-m245/actions/runs/46138856876) und [main](https://github.com/AnikaA13/zaeme-m245/actions/runs/46139339783) bestanden. Der separate Vercel-Buildversuch auf Windows scheiterte an fehlenden Symlink-Rechten. Der Anbieter-Build, der isolierte kompilierte Node-Test und die reale HTTPS-Funktion bestanden. |
| Supabase | zaeme / zaeme-m245, Ref rfvtspjxtaetytwbqaqd, London eu-west-2, PostgreSQL 17.12. Alle sechs versionierten Migrationen erfolgreich nach frischem Leerstands- und Dry-Run-Abgleich. 10/10 Tabellen mit RLS, 20 öffentliche RPCs für authenticated, null direkte Schreibgrants für App-Rollen. Realtime veröffentlicht nur UPDATE auf household_signals mit id und revision. |
| Schema und Rückwege | Alle fachlichen Typen und RPCs kompatibel. Der Hosted-Generator meldet Versionsmetadaten, andere leere ComputedFields-Marker und zehn vorsorglich nullable Sichtspalten. Die direkte Projektion der zehn NOT-NULL-Basisspalten ist im Katalog geprüft. Exponiertes Data-API-Schema public, Passwortminimum 8, Site URL exakt die Ersatz-Preview, Allowlist exakt /auth/callback und /auth/reset-password auf diesem Ursprung. |
| Schutz und Bereinigung | Vier synthetische App-Identitäten pro Vier-Browser-Lauf. Zwei getrennte Haushalte und echte authentifizierte Kontakte zum Hosted-Backend. Nach Tests null Konten, Profile, Haushalte, Mitglieder, Einladungen, Reservations-, Vorrats-, Einkaufsdaten und Operationsquittungen. Sechs vertragsgemäss dauerhaft belegte Signal-IDs mit Revision. Der kurzlebige interne Vercel-Prüflink wurde widerrufen. |

## Funktion und Abnahme

| Funktionen | Stand |
| --- | --- |
| F01 Authentifizierung und Wiederherstellung | Normale Anmeldung und Logout an Supabase auf HTTPS bestanden. Technische Konten wurden für diesen Test administrativ bestätigt. Lokaler Bestätigungs- und Recovery-Ablauf geprüft. Echte Bestätigungs- und Recovery-Mail **NOT RUN**. |
| F02 Haushalt, F03 Vorrat, F04 Synchronisation, F05 manuelle Erfassung | Auf der finalen HTTPS-Preview mit A, B und C im gemeinsamen Haushalt sowie D im getrennten Haushalt geprüft. Zwei tatsächliche Einladungsbeitritte, persistierter Vorrat, Neuverbindung und Entzug bestanden. |
| F06 Barcode und Lookup | Optische Erkennung eines synthetischen Kamerastreams in Chromium, Prüfung und ausdrückliche Speicherung auf HTTPS bestanden. Echte Produktantwort für Nutella HTTP 200 in 710 ms, unbekannte EAN HTTP 404 in 243 ms, ungültige Eingabe HTTP 400 in 636 ms. Bei der optisch gelesenen Testvideo-EAN lieferte die Oberfläche den Hinweis auf nicht geladene Produktinformationen. Der Name wurde manuell ergänzt und mit der erkannten EAN gespeichert. Der erfolgreiche Namensabruf für Nutella war eine separate HTTPS-Anfrage. Physische Packungen und Kameras **NOT RUN**. |
| F07 Bearbeiten, Verbrauchen und Löschen, F08 Ablauf, F10 Validierung, F17 eigene Reservation | Vollständige lokalen Regressionsfälle bestanden. Auf HTTPS wurden die reservierte Fremdmenge geschützt, eigene reservierte Ware verbraucht, Restmengen geprüft und nach Rechteentzug Reservationen freigegeben. |
| F09 Einkauf und F19 Warnfrist | Echte gemeinsame Einkaufszeile gespeichert und von C abgehakt. Persistenz, fremder Haushalt und Empfang durch B geprüft. Owner setzte sieben Tage. Mitglieder sahen geänderte Warnfrist bzw. Ablaufklassifikation. |
| F11 Navigation und F15 Installation | Alle fünf Ziele sind implementiert. Produktionsmanifest, Icon-Anfragen, sichere Routen, Offline-Hinweis und Online-Rückkehr geprüft. Auf HTTPS blieben Cache Storage und IndexedDB für die App nach Fachaktionen leer. Installieren, Standalone-Start, Update und Kamera auf Android/iOS **NOT RUN**. |

## Tests und Messwerte

- Lokal unter Windows 11 Pro, i5-1345U, Node 24.14.1 und npm 11.21.3. npm ci, Lint, Typprüfung, Formatierung, Tests und Build liefen erfolgreich. 166 Vitest-Fälle, 307 pgTAP-Prüfungen, 22 API-, 6 Einkaufs- und 1 WebSocket-Test. 40 kombinierte Browsergruppen, 7 separate Einkaufsgruppen, 2 optische Scannerfälle, PWA-Produktionsprüfung und 1 zusätzlicher Test des kompilierten Function-Einstiegs. Fresh-Install und beide Upgrades einschliesslich Datenerhalt und Typprüfung bestanden. Details und historische Fehlläufe stehen im TEST_REPORT.
- Am finalen HTTPS-Ursprung gemessene Zeit zwischen RPC-Antwort und sichtbarer Änderung in einer zweiten Sitzung in Millisekunden. Vorrat anlegen 1194, reservieren 1180, Einkauf anlegen 756, abhaken 706 und Warnfrist 102. Geprüft mit Desktop-Chromium. Die vorherige Loopback-Messung gegen denselben Hosted-Dienst ist separat ausgewiesen.
- Lokal mit 205 Vorratschargen 1304 ms bis zur vollständigen Anzeige und 55 ms für die Suche. Mit 1010 Chargen 2434 und 109 ms. Pagination und dringliche Sortierung geprüft. Das konservativ gepolsterte Maskable-Icon basiert auf dem unverzerrten Originalzeichen. Das Drei-Sekunden-Ziel wurde am dokumentierten Desktop erreicht. Hauptbundle 562,53 kB, gzip 163,90 kB. Scanansicht 8,28 kB und Decoder 53,82 kB werden separat geladen.
- Layout bei 320, 375, 390, 430, 1280 und 1440 CSS-Pixeln sowie 200 Prozent Textgrösse geprüft. Lokale Tastatur-, Fokus-, Navigations-, Kontrast- und Dialogfälle sowie 44-Pixel-Ziele dokumentiert. Physisches VoiceOver und TalkBack sind offen.
- Der finale HTTPS-Lauf erfasste 157 Browseranfragen an die App und 586 an das zugehörige Supabase-Projekt. Kein privilegierter Schlüssel in den geprüften App-Auth-/API-Headern. Weder eine unabhängige Sicherheitsprüfung noch eine vollständige WCAG-Abnahme wurde durchgeführt.

## Schritte vor der ersten Einladung

1. Einen für das Schulprojekt zugelassenen Absender und ein kontrolliertes Testpostfach festlegen. In Supabase beim Projekt zaeme-m245 unter Authentication → SMTP Settings «Enable Custom SMTP» öffnen. Den freigegebenen Absendernamen und die Absenderadresse sowie Host, Port, Benutzername und Passwort des Maildienstes eintragen und speichern. Die Zugangsdaten sind vertraulich und gehören ausschliesslich in das Anbieterformular. Als Rückmeldung genügen «SMTP gespeichert» und die Freigabe für genau eine Bestätigungs- und eine Recovery-Mail an das vereinbarte Testpostfach. Falls ein Schulabsender fehlt, zuerst bei der Schule nach einem zugelassenen Dienst fragen. [Supabase SMTP](https://supabase.com/dashboard/project/rfvtspjxtaetytwbqaqd/auth/smtp)
2. Registrierung und Bestätigungslink im ursprünglichen Browser prüfen. Danach «Passwort vergessen» verwenden, neues Passwort setzen und in einer frischen Sitzung prüfen. Erwartet werden Zustellung, korrekter HTTPS-Ursprung, bereinigte Callback-Adresse und funktionierende neue Anmeldung. Vorlagen, Absender und beide Zustellungen sind Teil dieser Freigabe.
3. Auf einem tatsächlichen Android-Gerät mit Chrome und einem iPhone mit Safari die interne Adresse mit berechtigtem Testzugang öffnen. Modell, OS, Browser, Netz, SHA und Datum festhalten. Auf beiden Geräten alle fünf Ziele, manuelle Eingabe, Kameraerlaubnis und Freigabe, unbekanntes Produkt, Speichern, Realtime und Logout prüfen. Pro Plattform 20 Packungsversuche nach dem Geräteblatt protokollieren. Ziel je Plattform mindestens 18 korrekte Decodes und 14 passende Namen, Median bis zum Speichern bekannter Produkte höchstens 20 Sekunden. Keine persönlichen Kamerabilder aufbewahren.
4. Android im Chrome-Menü «App installieren» bzw. «Zum Startbildschirm hinzufügen» wählen. Auf dem iPhone Safari → Teilen → «Zum Home-Bildschirm» verwenden. Namen und Symbol, Start über das Symbol, Sitzungswiederherstellung, Kamera, Offline-Hinweis, Netzrückkehr, Update und Logout auf beiden Geräten prüfen. Dazu 200 Prozent Text sowie TalkBack bzw. VoiceOver ausprobieren und konkrete Beobachtungen protokollieren.
5. Die Nutzung der Lebensmittelabfrage bei Open Food Facts mit «zäme», der Repository-Adresse und «Schulprojekt, lesende EAN-13-Namensabfrage» melden. Nachweis genügt, falls bereits eingereicht. Der lesende Zugriff benötigt keinen API-Schlüssel. [Nutzungsformular](https://docs.google.com/forms/d/e/1FAIpQLSdIE3D8qvjC_zRJw1W8OmuHhsWJ_NSckiiniAHlfaVwUZCziQ/viewform)
6. Vor der Einladung Testleitung, privaten Meldeweg, Zugangsweg und Löschtermin festlegen. Für Teilnehmende nach Freigabe die mitgeteilte HTTPS-Adresse öffnen, registrieren, E-Mail im selben Browser bestätigen, Haushalt erstellen und zwei Mitglieder privat einladen. Mit gewöhnlichen Testlebensmitteln beginnen. Fehler mit Aktion, Erwartung, sichtbarem Ergebnis, Uhrzeit und Gerät privat melden. Keine Passwörter, Einladungen oder sensiblen Haushaltsdaten in Meldungen aufnehmen. Nach Testende Einladungen widerrufen, Mitglieder austreten lassen und den verbleibenden Haushalt durch den Owner auflösen. Konten nur auf bestätigten Wunsch gezielt löschen.

## Repository und Archiv

Task 008 `03389b3` ist in der Basis `a17f15d` enthalten. Task 009B `f21ee83` enthält 009A `d2459cb`. Task 010B `a8d8e2b` enthält 010A `835a7b4`. Task 011A `a58b0d1` wurde mit den Integrationsmerges `6a2cf96`, `316edb0` und `39642bb` zusammengeführt. PWA `f248df0`, lokale Gesamtevidenz `1066454`, Scanner-CI-Korrektur `5910b34`, Hosted-Vertrag `cc7bd29`, PWA-Prüfkorrektur `0a2be63`, Function-Korrektur `3a81f5d`.

Die HTTPS-Aufnahme der Startseite zeigt den Ladezustand. Der vollständig geladene Startbildschirm ist in den lokalen Browserbelegen enthalten. Die ursprünglichen Logodateien, .env.local, frühere Review-Archive und Stash `68bebc941123e8993d8a72b80808b00ac06ef238` sind erhalten. Der andere lokale Task-005-Dienst blieb in Betrieb. Die geplante Abnahme am 1. Dezember ist ein Termin. Für die Benutzerziele G01–G08 gibt es noch keine Beobachtungen der Zielgruppe.


# zäme · Technische Übergabe zum Haushaltstest

**Teilnehmerfreigabe gesperrt.** Die integrierte App ist lokal mit synthetischen Haushalten geprüft. Für den geplanten 1. Dezember 2026 fehlen die Anwendung der sechs Hosted-Migrationen, das Preview-Deployment, reale Mailzustellung und die physische Abnahme auf Android und iPhone. Es gibt keine freigegebene Testadresse. Der Gruppenentscheid sowie G01–G08 bleiben offen.

| Quelle | Branch                                   | Commit  | Nachweis des damaligen Stands                                                                                  |
| ------ | ---------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| 008    | feature/m4-core-inventory-ux, PR #4      | 03389b3 | 103 Vitest, 243 pgTAP, 27 Browsergruppen                                                                       |
| 009A   | feature/m5-shopping-realtime-backend     | d2459cb | 35 Vitest, 307 pgTAP, 21 HTTP-Fachszenarien, fünf Einkaufsszenarien, ein WebSocket-Szenario, 17 Browsergruppen |
| 009B   | feature/m5-shopping-realtime-integration | f21ee83 | Merge b48e0bb enthält 009A, 104 Vitest, 34 Browsergruppen plus sieben separat                                  |
| 010A   | feature/m6-barcode-lookup-core           | 835a7b4 | 85 Vitest, davon 50 zum Scannerkern, optische Videofixture und einzelne Live-Abfragen                          |
| 010B   | feature/m6-scanner-integration           | a8d8e2b | Merge b6b8885 enthält 010A, 161 Vitest, 33 Browsergruppen                                                      |
| 011A   | feature/m7-hosted-test-infrastructure    | a58b0d1 | 35 Vitest und acht lokale Gast-Routen, kein Hosted-Projekt nachgewiesen                                        |
| 011B   | integration/m7-user-test-release         | f248df0 | Funktionscommit mit PWA und Produktsuche. Basis a17f15d, Integrationsmerges 6a2cf96, 316edb0 und 39642bb.      |

[Lokale Testzahlen, Messungen und Befunde](docs/TEST_REPORT.md) · [Anforderungsmatrix](docs/IMPLEMENTATION_STATUS.md) · [Screenshots und Rohmessungen](docs/review/task011b) · [Teilnehmeranleitung, Geräte- und Freigabeliste](docs/USER_TEST_RELEASE.md) · [Hosted-Migrationsvertrag](docs/HOSTED_TEST_VERTRAG.md)

Der lokal geprüfte PR-Kandidat ist `1066454ef6859721145e277efcedc848d11acb07`. Das [GitHub-Prüfprotokoll zu PR #5](https://github.com/AnikaA13/zaeme-m245/pull/5/checks) führt die wirklichen Prüfläufe und Resultate.

Der lokale Lauf verwendete ausschliesslich den Wegwerfstack `zaeme-task011-local`. Das Archiv enthält weder dessen Schlüssel noch Sitzungen, Bestätigungsmails oder Einladungslinks. Der letzte Abschnitt im ausgelieferten ZIP nennt den zum Verpackungszeitpunkt tatsächlich verifizierten GitHub-Stand.

## Frühere Übergaben

[009B](docs/TASK_009B_HANDOFF.md) · [010B](docs/TASK_010B_HANDOFF.md) · [011A](docs/TASK_011A_HANDOFF.md)
