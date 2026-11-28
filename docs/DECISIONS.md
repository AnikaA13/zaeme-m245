# Technische Entscheidungen

## 011B · Installation und Produktsuche

Das App-Symbol verwendet das vollständige quadratische Originalzeichen auf dem cremefarbenen Markenhintergrund. Die gewöhnlichen PNGs zeigen es mit 90 Prozent Kantenlänge, die maskierbare Variante mit 55 Prozent. Damit liegt sogar das umschliessende Quadrat innerhalb des zentralen Sicherheitskreises mit 40 Prozent Radius. Die Originale bleiben erhalten. Eine eigenständige Logo-Neugestaltung oder zusätzliche Gruppenfreigabe ist damit nicht verbunden.

Für die Menüinstallation kann Chromium auf einen Service Worker verzichten. Der kleine Worker liefert den Offline-Hinweis beim erneuten Start. Es gibt keine Installationstaste mit vorausgesetztem Browser-Prompt. Die Hinweise für Safari und Chrome stehen in der [Testanleitung](USER_TEST_RELEASE.md). [MDN zur Installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) · [Apple für iPhone](https://support.apple.com/de-ch/guide/iphone/iphea86e5236/ios)

Der Browser kann keine verlässliche eigene User-Agent-Kennung für die externe Produktabfrage setzen. Der feste Lese-Endpunkt übernimmt dies für die App. Die fünf Sekunden im Client schliessen die Antwortverarbeitung ein. [Anbietervorgaben](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)

## Task 009B · Einkauf und Synchronisation

Ein Kanal je aktivem Haushalt genügt für Vorrat, Einkauf und Einstellungen. Die UI sammelt Ereignisse für 45 ms und merkt während einer laufenden Prüfung einen weiteren Durchlauf vor. Ein ausbleibendes Signal kann auch auf einen Mitgliedschaftsentzug zurückgehen. Deshalb liest der Client bei bestehender Netzwerkverbindung alle 1,5 Sekunden zusätzlich die autorisierte Revision. Eine fehlende Zeile löst sofort die Mitgliedschaftsprüfung aus. Eine verpasste Revision löst denselben Abgleich wie ein Kanalsignal aus. Die bestehende Sitzungsinvalidierung räumt Requests, offene Aufträge, Formulare und Kanal bei einem Kontextwechsel auf.

## 009A · Revisionszähler und Kanalbeitritt

Fachzeilen invalidieren den Haushalt in derselben Transaktion. Die Haushaltsanlage reserviert die Signal-ID inklusive erster Mitgliedschaft mit Revision 1. Bei der Auflösung bleiben nur ID und letzte Revision erhalten. Einladungsanlage, Vorschau, Widerruf, Ablauf und interne Bereinigung betreffen den privaten Einladungsablauf. Erst der wirksame Beitritt invalidiert die gemeinsame Ansicht. Die Warnfrist und das Profil melden auch eine neue Fachversion bei erneutem Speichern desselben Werts. Identische Quittungswiederholungen und unveränderte Reservierungen schreiben keine Fachzeile.

Der Integrationstest setzt vor dem Kanalbeitritt das Benutzer-JWT explizit und wartet auf die PostgreSQL-Registrierung. Dadurch kann der erste Refetch die Lücke beim Anmelden des Kanals schliessen. Die Auslieferung prüft den aktuellen RLS-Lesezugriff je Signal. [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) · [Kanalimplementierung v2.147.1](https://github.com/supabase/realtime/blob/v2.147.1/lib/realtime_web/channels/realtime_channel.ex)

## Task 010B · Scanversuch und geprüfte Formularvorbelegung

Die geschützte Route lädt die Scanansicht beim Öffnen. Erst «Kamera starten» fordert Video an. Ein Abbruchsignal begrenzt Kamera und anschliessende Einzelabfrage auf denselben Versuch innerhalb der aktuellen Mitgliedschaft. Die EAN und der Vorschlag bleiben bis zur Formulareingabe im Arbeitsspeicher der Ansicht. Der Browser-Verlauf enthält nur die Route. Ein neuer Routeneintrag erzeugt nach bestätigtem Speichern eine frische Erfassung. Der Decoder wird separat nach Kamerafreigabe geladen. Vite legt die Drittanbieter-Lizenztexte im Build ab.

## Task 010A · Decoder, Kamera und Datenquelle

Für F06 verwenden wir den gezielten EAN-13-Leser von `@zxing/library` 0.23.0 (Apache-2.0, Node ≥24). `@zxing/browser` 0.2.1 (MIT) verwendet denselben Core als Peer. Direkter Zugriff auf den Reader erlaubt die eigene Track-Freigabe auch während verzögerter Browserprompts. Das Paket ist im beitragsbasierten Wartungsmodus. Der kleine Funktionsumfang, der vorhandene Node-24-Stack, die optisch getestete EAN-13-Erkennung und der separate Ladechunk begründen den Einsatz. Die schmalen ESM-Importpfade sind an die gesperrte Version gebunden. Bei Upgrades den optischen Test und den Modulgraphen wiederholen. Ein plattformabhängiger nativer Detector ist keine Voraussetzung. [ZXing Core](https://github.com/zxing-js/library) · [Browseradapter](https://github.com/zxing-js/browser)

Der Anbieterzugriff verwendet ausschliesslich die v3-Einzelabfrage für den Produktnamen. Die Browser-Schicht kennt keine Sitzung, Haushalte oder Schreiboperationen. Der Aufrufer verwaltet den Kontext über ein Abbruchsignal. Herkunft, Browserkennung, Grenzen und Zustände sind im [Integrationsvertrag](TASK_010B_VERTRAG.md) beschrieben.

## Task 008 · Vollständige Liste und bewusste Konfliktauflösung

Die Implementierung lädt die aktive Sicht in 100er-Seiten, bevor sie nach Datum sortiert oder nach Namen sucht. Damit wirken Suchsonderzeichen wörtlich und späte ID-Seiten können die dringendste Charge enthalten. Die Anzeige begrenzt zunächst die gerenderten Treffer. Reservierungen werden je sichtbarer Gruppe geladen. Ein Versionskonflikt erfordert einen erneuten Entscheid. Eine fehlende Antwort hält den ursprünglichen Auftrag im Sitzungskontext. Die bestehende Navigationsentscheidung platziert die manuelle Erfassung zentral. Der Einkauf zeigt seinen aktuellen Entwicklungsstand. Alphabetische Sortierung bleibt mit den zusätzlichen P1-Filtern zurückgestellt.

## Task 011A · Kontrollierte Testversion

Für die Schulabnahme ist eine manuelle Vercel-Preview mit fester Quellrevision und eigenem Supabase-Testprojekt vorgesehen. Auth-Rückwege binden an die konkrete Deployment-URL. Migrationen laufen einzeln nachvollziehbar als ausstehende geprüfte Historie. Die Katalogabfrage im lokalen Stack ergab für postgres SELECT WITH GRANT OPTION auf auth.users. Das weicht von der historischen Angabe unter 005 ab. Die effektiven Hosted-Rechte müssen gesondert geprüft werden. [Hosted-Testvertrag](HOSTED_TEST_VERTRAG.md)

## 007.1 · Wiederholen und Kontext prüfen

Eine offene Absicht ist pro Mutation und Zielressource gebunden. Eine zweite Eingabe darf sie erst nach Zustandsabgleich und bewusster lokaler Auflösung ablösen. Ein bestätigter Vollverbrauch benötigt einen eigenen Benutzerentscheid. Die Sitzungsnachprüfung akzeptiert bei Beitritt und Gründung genau einen Wechsel zum quittierten Haushalt. Bei Austritt und Auflösung erwartet sie den Verlust der Mitgliedschaft. Das erneute Eintreten in denselben Haushalt erzeugt einen neuen Kontext.

Die Wegwerfumgebung wird explizit pro Prozess gewählt. Damit können Quellbranches und gemeinsamer Entwicklungsstack ihre vorhandenen Volumes behalten. Für den Browser verwendet der Test die Mailpit-Adresse des gewählten Stacks. Der erlaubte Vite-Ursprung und die zwei exakten PKCE-Routen bleiben gemeinsam.

## Task 006 · Auth, Absichten und Wiederholung

- Der typisierte Supabase-Client 2.119.2 (MIT, Node ab 22) nutzt im Browser PKCE und die SDK-Sitzungspersistenz. Playwright 1.65.1 (Apache-2.0, Node ab 20) läuft ausschliesslich im Testprozess. Node 24 erfüllt beide Anforderungen.
- Der lokale Ursprung ist `http://127.0.0.1:5173`. Die Rückwege für Bestätigung und Wiederherstellung haben exakte Pfade. Das UI prüft neue Passwörter auf acht Zeichen, die lokale Auth-Konfiguration setzt dieselbe Mindestlänge. Das lokale Mailpit-Budget erlaubt wiederholte Läufe.
- Der Client erzeugt UUIDv7 mit 48 Zeitbits, Versions- und Variantenbits sowie kryptografischem Zufall. Er hält die normalisierte Absicht und ID während einer ungeklärten Anfrage im RAM. Vor der manuellen Wiederholung erfolgt ein Abgleich. Eine geänderte Eingabe, Identität oder Generation begründet keine automatische Wiederholung. Entfernung bindet auch die Generation der bestätigten Zielperson.
- Einladungen verwenden 32 Zufallsbytes. Nur deren SHA-256 als hexadezimales PostgreSQL-bytea geht an den Erstellungs-RPC. Der 43-stellige Code wird nach bestätigter Speicherung angeboten. Vorschau und Beitritt erfolgen per POST und benötigen zwei bewusste Aktionen. Die vorhandenen Migrationen blieben gültig.
- Das eingebundene Projektlogo stimmt mit dem Original-SVG im lokalen Prototyp überein. Die spätere Warnfristbearbeitung und Realtime bleiben Task 009 zugeordnet.

## Task 005 · Präzisierungen des Datenbankvertrags

Die Entfernung bindet zusätzlich die Generation der Zielperson. So kann eine verspätete Bestätigung des Owners nach erneutem Beitritt keine neue Mitgliedschaft löschen. Der API-Test prüft genau diesen Ablauf.

- Eine zufällige Generation bindet Requests und Quittungen an den konkreten Beitritt. Austritt und Auflösung liefern eine eigene inhaltslose Abschlussbestätigung.
- Eine private Sicht überbrückt das fehlende GRANT OPTION der Migrationsrolle auf Auth-Daten. Ihr einziges mögliches Ergebnis ist die eigene bestätigte ID. Der RPC-Besitzer erhält kein Auth-Leserecht.
- Eine JSON-Zahl am Warnfrist-Einstieg erlaubt INVALID auch für falsche Eingabetypen. Das persistente Feld bleibt INTEGER.
- PostgreSQL 17.11 hat lokal kein `pg_catalog.uuidv7()`. Die DB prüft Version, Variante und 48 Zeitbits. Der Testclient setzt die Zeitbits und verwendet Web Crypto für die Zufallsbits. [RFC 9562, Abschnitt 5.7](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7)
- CLI 2.122.1 ist die einzige zusätzliche direkte Entwicklungsabhängigkeit. Die zunächst geprüfte Version 2.95.3 zog ein von npm audit beanstandetes tar-Paket nach. Beim endgültigen Lockfile meldete npm ci null bekannte Schwachstellen. Die Portprüfung stoppt einen Stack mit allgemeiner Host-Bindung. [Testbericht](TEST_REPORT.md)

| Entscheidung                        | Begründung                                                         |
| ----------------------------------- | ------------------------------------------------------------------ |
| React, Vite und striktes TypeScript | Unterstützen eine statische SPA und frühe Typprüfung.              |
| Node.js 24 und npm 11               | Entsprechen der vorgefundenen Umgebung und den gewählten Tools.    |
| React Router im Browser             | Unterstützt Startseite, direkte URLs und spätere fachliche Routen. |
| Feature-Ordner bei konkretem Bedarf | Hält zusammengehörige Dateien nah beieinander.                     |
| Zentrale CSS-Variablen              | Ermöglichen die Übernahme der später freigegebenen Markenwerte.    |
| Vitest, jsdom und Testing Library   | Prüfen Rendering und Routing mit einem einzigen Testbefehl.        |
| Supabase-Client später ergänzen     | Die Startseite läuft eigenständig. RLS folgt dem Datenmodell.      |
| PWA-Manifest im ersten Schritt      | Legt Metadaten fest. Die Installierbarkeit wird später geprüft.    |
| GitHub Actions mit Node.js 24       | Führt dieselben npm-Prüfskripte wie lokal und `npm ci` aus.        |

Die Peer-Angaben von Vitest und des React-Plugins lassen Vite 8 zu.
Der Einsatz von Node.js 24 passt zu den veröffentlichten Anforderungen.
Die aufgelösten Versionen stehen in `package-lock.json`. jest-dom 8 liefert
die zu Vitest 5 passenden TypeScript-Deklarationen.
[jest-dom-Kompatibilität mit Vitest 5](https://github.com/testing-library/jest-dom/pull/742),
[Vite-Anforderungen](https://vite.dev/guide/),
[Vitest-Paketmetadaten](https://registry.npmjs.org/vitest/latest),
[React-Plugin-Paketmetadaten](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/package.json),
[typescript-eslint-Kompatibilität](https://typescript-eslint.io/users/dependency-versions/)

Der Vitest-Standardpool bleibt für lokale Läufe und CI aktiv. Für eine
Windows-Sandbox mit eingeschränktem Prozessstart ist der Thread-Pool per
CLI verfügbar. [Vitest-Dokumentation zu Worker-Pools](https://vitest.dev/config/pool)

## Task 004 · Abgleich vom 25. November 2026

PO-Entscheide definieren den Produktumfang. Die technische Architektur ist zur Prüfung vorgeschlagen. Die Gruppenfreigabe steht aus. Historische Beobachtungen UX-01–UX-16 und Messwerte bleiben erhalten.

| Bisheriger Konflikt                                                                   | Gültiger Entscheid und betroffene Kriterien                                                                                                                                          | Grundlage                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Vier dauerhafte Ziele im MVP; vier Einträge mit Haushalt im Kopfbereich im UX-Entwurf | Fünf Einträge: Start, Vorrat, Hinzufügen, Einkauf, Haushalt. Mitte öffnet Erfassung, Abbruch zurück zum Ausgangsziel. AK11.1 und AC-01/02 erhalten.                                  | Jüngster ausdrücklicher PO-Entscheid |
| Reservierung und Einkauf als spätere Pflichtstufe                                     | Beide P0. Nur eigene Menge setzen/freigeben. Fremdverbrauch und Owner-Override sperren. Eigene Reservierung vor freier Menge abbauen. Member-Auswahl entfernt. S08–S10, AC-18–20/25. | PO und F07/F09/F17                   |
| Einzelstück direkt verbrauchen; zehn Sekunden Undo                                    | Vollverbrauch stets bestätigen. AC-14 prüft Schutz vor Fehlverbrauch. Undo zurückgestellt. Frühere Wünsche bleiben als Testbeobachtung dokumentiert.                                 | AK07.1, TT11                         |
| 120/80 Zeichen, optionale Kategorie, g/ml, offene Plausibilitätsgrenzen               | F10 führt Namen, Pflichtkategorie, erlaubte Einheiten, Präzision und Datumsgrenzen. AC-16/17 ergänzend mit TT06 prüfen.                                                              | F03/F10                              |
| Feste drei Tage, offene Zeitzone                                                      | Haushaltseinstellung 0–30, Standard 3, nur Owner. Europe/Zurich, neutral bei unbekanntem Datum, AC-38 parametrisiert.                                                                | F08/F19                              |
| Auth, Einladungen, Austritt und letzter Owner offen                                   | E-Mail/Passwort, maximal eine Mitgliedschaft, kontrollierte Auflösung nur durch alleinigen Owner.                                                                                    | F01/F02                              |
| Einkaufsübernahme und Vorschläge als Standard                                         | Name aus Vorrat und gemeinsame Liste P0; geführte Übernahme AC-29, Wiederverwendung, Vorschläge, Zusatzfilter und Push P1.                                                           | F09/F12–F14/F16/F18                  |
| Offline-Queue und Installationspflicht offen                                          | Installierbarkeit P0; nur online schreiben, private Daten nur im RAM, Service Worker allenfalls für öffentliche Assets.                                                              | PO, F15/NF11                         |
| Unterschiedliche Zeit- und Bedienziele                                                | G01–G08 sind die vorgeschlagenen Messziele. Keine Umdeutung historischer Testdaten.                                                                                                  | MVP Abschnitt 1                      |

Architekturvorschlag: Ein Owner-Fremdschlüssel pro Haushalt, Datenbankgrenze für alle Mutationen, kurze Serialisierung je Haushalt, Versionsprüfung für absolute Änderungen und befristete Quittungen. Ein separater Revisionszähler erlaubt Refetch ohne Veröffentlichung privater Fachzeilen. Gründe und Tests in [Datenmodell](DATABASE_SPEC.md), [RPC-Verträgen](RPC_SPEC.md) und [Systemarchitektur](ARCHITECTURE.md).

## 007 · Bestätigung, Eingabetypen und Lesesicht

- Der Vollverbrauch bindet die Menge, Einheit und sichtbare Chargenversion an den Dialog. Dies verhindert eine frühere Bestätigung nach zwischenzeitlichem Verbrauch, Bearbeiten oder Reservieren. Teilverbrauch bleibt additiv.
- Mengen und Bestätigungen verwenden SQL-`jsonb` an der API-Grenze. Damit kann die Funktion JSON-Dezimaltext und JSON-Boolean prüfen, bevor PostgreSQL skalare Eingaben umwandelt. Der fachliche TypeScript-Vertrag bleibt eng. [RPC-Vertrag](RPC_SPEC.md)
- `active_inventory` summiert Reservierungen per Charge im selben SQL-Snapshot. Die Invoker-Sicht erhält die RLS-Prüfung und liefert vollständige Summen auch bei paginierter Personenliste. Ein zusätzlicher Speicher für Summen entfällt.
- Austritt und Entfernung sperren die betroffenen Chargen in UUID-Reihenfolge. Sie erhöhen nach der Freigabe deren Version. Dies macht veraltete Dialoge erkennbar. Die bestehenden Signaturen und die Mitgliedschaftsgeneration von 005 bleiben erhalten.
