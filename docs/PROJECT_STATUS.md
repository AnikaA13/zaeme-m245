# Projektstand

## Task 009A · Lokales Backend für Einkauf und Synchronisation

Der separate Backend-Branch ergänzt Einkauf, transaktionale Haushaltssignale und eine UPDATE-Publikation. Das lokale WebSocket-Szenario verifiziert Mitgliedschaftsentzug mit einem weiterhin gültigen JWT und den Zugriff nach Wiederbeitritt. Task 008 integriert den Vorratsclient unabhängig. Einkauf, Warnfrist-Bedienung und sichtbare Synchronisation auf zwei Geräten folgen in Task 009B. [Prüfbericht](TEST_REPORT.md) · [Integrationsvertrag](TASK_009B_VERTRAG.md)

## Task 008 · Vorratsoberfläche

Im authentifizierten Haushalt sind Start, Vorrat, manuelle Erfassung, Bearbeitung, Verbrauch und eigene Reservierungen an die bestehende Datenbank angeschlossen. Einkauf zeigt einen Entwicklungshinweis. Die nächsten fachlichen Schritte sind Einkauf und Synchronisierung in 009 sowie Kamera und Produktsuche in 010. Geräteabnahme und Haushaltstests stehen aus. Umfang, Prüfstand und technische Anschlussstellen sind separat dokumentiert. [Anforderungsmatrix](IMPLEMENTATION_STATUS.md) · [Prüfbericht](TEST_REPORT.md) · [Anschlussvertrag](TASK_008_ANSCHLUSS.md)

## Task 007.2 · Freigabeprüfung

Die ersten beiden CI-Läufe bestanden die Frontendprüfungen und die Datenbankschritte bis einschliesslich Typvergleich. Der erste Chromium-Lauf stoppte bei der Registrierung, der zweite nach erfolgreicher Registrierung beim Passwortlink. Die Testeingabe prüft deshalb bei allen drei Auth-Formularen den abgeschlossenen Seitenwechsel. Die GitHub-Ergebnisse gehören zum jeweiligen Commit in [PR #3](https://github.com/AnikaA13/zaeme-m245/pull/3).

## Task 007.1 · integrierter Stand

Auf `integration/m3-auth-inventory` sind die Auth- und Haushaltsoberfläche von 006 und die Vorratsdatenbank von 007 zusammengeführt. Die vier Migrationen gelten unverändert. Für Abnahmeumfang, Prüfbefunde und offene Umgebungstests gilt der [aktuelle Prüfbericht](TEST_REPORT.md). Die nachfolgenden Aufgabenstände dokumentieren ihre jeweiligen historischen Prüfumgebungen.

F03, F05, F07, F10 und F17 benötigen noch die Vorratsoberfläche. F04 Realtime, F06 Kamerascan, F09 Einkauf, F15 physische Installation sowie Hosted SMTP, HTTPS, physische Geräte und Nutzertests bleiben offen. [Übergabe für 008](TASK_008_VERTRAG.md)

## Task 006 · lokale Auth- und Haushaltsoberfläche

Der Branch `feature/m2-auth-households` basiert direkt auf `4936f3f`. Die Anwendung unterstützt Registrierung, E-Mail-Bestätigung, Passwortreset, Profilpflege und den vollständigen Lebenszyklus der Haushaltsmitgliedschaft. Der Browserlauf mit vier getrennten Konten prüfte den Beitritt zu dritt, einen zweiten isolierten Haushalt, Entzug und Auflösung. Die lokale Abnahme gilt für Windows, Chromium und den isolierten Stack. Hosted SMTP, HTTPS-Preview, echte Mobilgeräte und Screenreader bleiben offen. [Prüfbericht](TEST_REPORT.md)

Nach technischem Review kann 007 den Vorrat und die transaktionale Freigabe von Reservationen bei Entfernung und Austritt ergänzen. Bis dahin gilt für F02 nur der geprüfte Haushaltsumfang. F19 zeigt die gespeicherte Warnfrist an.

## Task 005 · lokal verifiziert

Architekturcommit `e766d28`, Implementierung auf `feature/m1-database-foundation`. Frischer Reset und separater Upgrade vom leeren Backend bestanden. Nach geprüfter Loopback-Bindung bestanden 140 pgTAP-Prüfungen, elf fachliche HTTP-Szenarien und der Typvergleich. Die M0-Oberfläche verwendet die RPCs noch nicht. Remote-CI und die späteren Hosting-Prüfungen sind offen.

Nach dem technischen Review umfasst 006 Registrierung, Bestätigung, Sitzung, Passwortwiederherstellung und Haushaltsoberflächen. Parallel können Zwei-Browser-Testfälle, Mail-Rückkehr und Fixtures für 007 vorbereitet werden. [Testbericht](TEST_REPORT.md)

## Task 001

Die technische Grundlage von zäme ist im Repository eingerichtet. Das
Schulprojekt der GBS-Höhle der Löwen richtet sich an Haushalte ab drei
Personen. Die App soll den gemeinsamen Lebensmittelvorrat, Ablaufdaten und
Einkäufe koordinieren.

- React-Startbildschirm in Schweizer Standarddeutsch mit Entwicklungsstatus,
  mobiler Anordnung und zentralen CSS-Tokens.
- Browser-Routing für Startseite und unbekannte Adressen sowie eine
  Fehlergrenze mit Neuladeaktion.
- Strict TypeScript, Vite, ESLint, Prettier, Vitest und React Testing Library
  mit zwei Rauchtests und festgehaltenen Paketversionen.
- Web-App-Manifest, Vercel-SPA-Konfiguration und eine optionale
  Supabase-Umgebungsvorlage mit Platzhaltern.

## Task 002 · Verifikation vom 25. November 2026

Task 002 wurde auf `main` bei `230f829` geprüft. Zu diesem Zeitpunkt lag
die M0-Grundlage einschliesslich Sperrdatei und Workflow im Arbeitsverzeichnis.

Geprüft unter Windows mit Node.js 24.14.1 und npm 11.21.3.

| Prüfung                          | Ergebnis                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| `npm ci`                         | Erfolgreich mit Registry-Zugriff nach Beenden des alten Prüfservers. |
| `npm ls --depth=0`               | Erfolgreich, installierte Direktabhängigkeiten aufgelistet.          |
| `npm run lint`                   | Erfolgreich, ohne Warnungen.                                         |
| `npm run typecheck`              | Erfolgreich.                                                         |
| `npm run format:check`           | Erfolgreich.                                                         |
| `npm run test`                   | In der Sandbox `spawn EPERM`. Ausserhalb bestanden 3 von 3 Tests.    |
| `npm run test -- --pool=threads` | In der Sandbox bestanden 3 von 3 Tests.                              |
| `npm run build`                  | Erfolgreich, Produktionsdateien in `dist/`.                          |
| `git diff --check`               | Erfolgreich für die versionierte Arbeitskopie.                       |

Der erste Versuch mit `npm ci` scheiterte mit `EPERM` beim Löschen einer
nativen Rolldown-Datei. Nach dem Beenden des noch laufenden Prüfservers
gelang die Neuinstallation mit Freigabe ausserhalb der Sandbox. npm meldete
für ESLint 9.39.5 das Supportende.

Der Vitest-Standardpool startet einen Kindprozess. Die Windows-Sandbox
blockierte den Start vor Ausführung der Tests. Derselbe Befehl beendete sich
ausserhalb der Sandbox mit Exit 0. Die Testkonfiguration bleibt unverändert.
Der Thread-Pool ist eine lokale Alternative bei derselben Sandbox-Meldung.
[Vitest-Dokumentation zu Worker-Pools](https://vitest.dev/config/pool)

### Anwendung und Browser

- Die lokale Produktionsvorschau zeigte in Chrome die Startseite und die
  direkt aufgerufene Fehlroute bei 320 px und im Desktopfenster. Mit Tab
  war der Fokusrahmen am Rückkehrlink sichtbar. Die Eingabetaste öffnete
  die Startseite.
- Die Produktionsvorschau lieferte für beide Routen den HTML-Einstieg mit
  HTTP 200. Das Manifest war abrufbar und enthielt `de-CH` und `standalone`.
- Ein gezielt ausgelöster Renderfehler zeigte im Komponententest die
  Fehleransicht und die Neuladeschaltfläche. In einem separaten lokalen
  Browserlauf wurde der Fehler einmalig über den Entwicklungsserver
  injiziert. «Seite neu laden» stellte die Startseite wieder her.
- Ein fehlendes Wurzelelement, Fehler in Ereignishandlern und asynchrone
  Fehler ausserhalb des Komponentenbaums fallen ausserhalb der Fehlergrenze.
  Der Hinweis bei ausgeschaltetem JavaScript ist im HTML vorhanden und
  wurde nicht separat im Browser getestet.

### CI und Konfiguration

Der neue GitHub-Actions-Workflow sieht `npm ci`, Lint, Typprüfung,
Formatprüfung, Standardtests und Build unter Node.js 24 auf Ubuntu vor.
Die Sperrdatei passt zu `package.json` und enthält die entsprechenden
nativen Linux-Pakete für Rolldown und Lightning CSS.
Der Workflow setzt keine Supabase- oder
Vercel-Zugangsdaten voraus.

`.env.example` enthält zwei öffentliche Platzhalter. Die Ignore-Regeln
decken lokale Umgebungsdateien, Abhängigkeiten, Builds, Caches und
Testartefakte ab. Die geprüften Projektdateien enthielten keine Hinweise
auf Anmeldedaten, privilegierte Schlüssel oder personenbezogene Testdaten.

## Task 003 · Veröffentlichung der M0-Grundlage

Die geprüfte M0-Grundlage mit Sperrdatei und Workflow gehört auf den
Release-Zweig `chore/m0-application-foundation`. Der erste entfernte
CI-Lauf ist über den zugehörigen Pull Request zu prüfen.

## Offene Punkte

- Der HTML-Prototyp und das Originallogo fehlen im Checkout. Die Startseite
  verwendet provisorische Markenfarben und einen Schriftzug. Chromes
  automatische Anfrage nach `favicon.ico` ergab HTTP 404.
- Die PWA-Grundlage besteht aus dem Web-App-Manifest. App-Symbole, Service
  Worker und Offlinebetrieb fehlen. Die Installierbarkeit ist unbestätigt.
- Die Vercel-Konfiguration wurde lokal vorbereitet. Ein Vercel-Deployment
  steht aus. Nach dem Deployment die unbekannte Adresse direkt öffnen und den
  Abruf des Manifests prüfen.
- Die Projektgruppe prüft die vorhandene MVP-Spezifikation abschliessend.
  Die finale UX-Spezifikation ist ausstehend.

M0 ist aus lokaler technischer Sicht zur Freigabe bereit. Der empfohlene
nächste Meilenstein nach der Freigabe ist M1 mit Authentifizierung,
Haushaltsmitgliedschaft und überprüfter Datenisolation per RLS.

## Task 004 · Spezifikation und Architekturreview

PR #1 ist mit 690c769 auf main gemergt. Zweiter Elternteil ist der geprüfte M0-Stand a7ca126; beide Commits haben denselben Dateibaum. Sechs erfolgreiche CI-Prüfungen und drei bestandene M0-Tests sind aus der Release-Übergabe bekannt. Die vorhandene Foundation umfasst weiterhin Startansicht, Routing, Fehlergrenze und Manifest.

Die PO-Entscheide vom 25.11. einschliesslich fünf Navigationseinträgen sind in MVP, UX und Handoff abgeglichen. Die Gruppe prüft die Spezifikation noch. [Umsetzungsstatus](IMPLEMENTATION_STATUS.md) und [Umsetzungsplan](IMPLEMENTATION_PLAN.md) führen die Architektur zur Prüfung. Auth, Datenbank, RLS, Realtime, Kamera, Lookup, gemeinsame Liste und PWA-Installation sind geplant. Es gibt noch keine Produkt- oder Geräteabnahme.

Im Checkout fehlt die Originalmarke als einsetzbares Asset. Unter `~/Downloads/Hoehle-der-Loewen-final (1)/Hoehle-der-Loewen/Prototyp/zaeme_mobile.html` wurde der historische Quelltext mit eingebettetem SVG, simuliertem Scan und localStorage geprüft. Die lokale OneDrive-Kopie war bytegleich. Die Aufgabenstellung V2026-02 lag unter Downloads vor. Testprotokolle wurden in diesem Task nicht neu ausgewertet. Docker-Client vorhanden, Engine nicht erreichbar, Supabase CLI im PATH nicht gefunden. Der nächste Umsetzungsschritt setzt Architekturreview und eine isolierte Testumgebung voraus.

### Tatsächliche Prüfung der Review-Arbeitskopie

Formatprüfung, ESLint, Typprüfung und Produktionsbuild erfolgreich. Der Standardaufruf von Vitest endete vor Testbeginn mit spawn EPERM. Im dokumentierten Thread-Pool bestanden alle drei bestehenden M0-Tests. Diese Läufe prüfen die vorhandene Anwendungshülle. Die Fachverträge wurden ausschliesslich als Dokumentation geprüft.

## Task 007 · Gemeinsamer Vorrat und Reservierungen

Auf dem M1-Merge `0fb8398` sind zwei weitere Migrationen lokal installiert und geprüft. Mehrere Mitglieder können dieselbe Charge lesen, eigene Mengen reservieren und freie oder selbst reservierte Mengen verbrauchen. Ein explizit bestätigter Vollverbrauch ist an die angezeigte Menge, Einheit und Version gebunden. Austritt und Entfernung geben betroffene Reservierungen im selben Commit frei. Bestand und Quittung bleiben bei Abbruch konsistent.

Der technische Teilstand für F02/F03/F05/F07/F10/F17 ist lokal mit PostgreSQL, GoTrue und PostgREST belegt. Die Abnahmen der Oberfläche, Synchronisierung zwischen Geräten, Hosting und Nutzertests einschliesslich G01–G08 stehen aus. Task 006 bleibt ein separater Integrationsstand. Task 008 kann den [Schreibvertrag](RPC_SPEC.md) und den [Lesevertrag](DATABASE_SPEC.md) verwenden. [Nachweismatrix](IMPLEMENTATION_STATUS.md) · [Testbericht](TEST_REPORT.md)
