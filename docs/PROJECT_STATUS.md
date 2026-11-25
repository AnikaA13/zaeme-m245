# Projektstand

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
