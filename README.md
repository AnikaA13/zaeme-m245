# zäme

Lebensmittelmanagement für Haushalte ab drei Personen. zäme ist ein Schulprojekt
für die GBS-Höhle der Löwen in der Schweiz. Die App soll den gemeinsamen
Lebensmittelvorrat, Ablaufdaten und Einkäufe im Haushalt leichter koordinierbar
machen.

## Technik

React, TypeScript im Strict-Modus, Vite und React Router bilden das Frontend.
Vitest und React Testing Library dienen für Tests, ESLint und Prettier für
Codequalität und Formatierung. Ein Web-App-Manifest und die Vercel-Konfiguration
bereiten den Betrieb vor. Supabase Auth, PostgreSQL und PostgREST tragen die lokale Haushaltsdatenbank.

## Lokal starten

Die M0-Oberfläche läuft unabhängig von der Datenbank. Für die lokale Haushaltsdatenbank werden Node 24, npm 11 und eine lokale Linux-Docker-Engine benötigt. API, PostgreSQL und Testpostfach verwenden die Ports 54321, 54322 und 54324. Die erste Ausführung lädt die Service-Images.

```sh
npm ci
npx --no-install supabase --version
npm run db:start
npm run db:migrate
npm run db:reset
npm run db:test
npm run db:test:api
npm run db:types
npm run db:types:check
npm run db:stop
```

`db:migrate` wendet ausstehende Migrationen lokal an. `db:reset` ersetzt den Inhalt der Wegwerfdatenbank und spielt alle Migrationen erneut ein. Das Skript prüft Projekt-ID, fehlende Remote-Verknüpfung, lokalen Docker-Endpunkt, Containerlabel, API- und DB-Adresse und Portbindungen. `db:types` schreibt die Typen nach `src/database.types.ts`. `db:stop` erhält den lokalen Datenstand. API-Tests entfernen ihre synthetischen Konten nach jedem Lauf.

Falls der Start eine allgemeine Portbindung meldet, in Docker Desktop unter **Settings → Resources → Network** die Standard-Portbindung auf **localhost** setzen, anwenden und den Start wiederholen. Diese Einstellung betrifft den Rechner. Alternativ dieselben Befehle auf einem isolierten Linux-Rechner mit Docker Engine ausführen. [Testbericht](docs/TEST_REPORT.md) · [Docker-Netzwerk](https://docs.docker.com/desktop/features/networking/) · [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

Für die separate Prüfung des Upgrade-Pfads setzt `npm run db:upgrade:check` das verifizierte Wegwerfprojekt auf die leere Auth-Grundlage zurück, prüft diesen Zwischenstand und wendet die Migrationen mit `migration up --local` an. Dieser Test benötigt Node ab 24.4 und ersetzt die lokalen Testdaten.

### Frontend

Vorausgesetzt werden Git, Node.js 24 und npm 11. Führe im Repository aus:

```sh
npm ci
npm run dev
```

Öffne die von Vite ausgegebene lokale Adresse. Falls PowerShell das npm-Skript
blockiert, verwende dort `npm.cmd`. `npm ci` installiert die in
`package-lock.json` festgehaltenen Versionen.

| Befehl                 | Zweck                                         |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Lokalen Entwicklungsserver starten            |
| `npm run build`        | Typen prüfen und Produktionsdateien erstellen |
| `npm run preview`      | Produktionsbuild lokal ansehen                |
| `npm run lint`         | ESLint ohne zulässige Warnungen ausführen     |
| `npm run typecheck`    | Strikte TypeScript-Prüfung ohne Dateiausgabe  |
| `npm run test`         | Tests einmalig ausführen                      |
| `npm run test:watch`   | Tests bei Änderungen erneut ausführen         |
| `npm run format`       | Dateien mit Prettier formatieren              |
| `npm run format:check` | Formatierung prüfen                           |

## Umgebung und aktueller Umfang

Der Entwicklungsstartbildschirm braucht keine Umgebungsdatei und kein
Supabase-Projekt. Beim späteren Anschluss kann `.env.example` nach `.env.local`
kopiert und mit der öffentlichen Projekt-URL sowie dem Publishable Key befüllt
werden. Vite kann `VITE_*`-Werte im Browser-Bundle veröffentlichen. Halte
Service-Role-Schlüssel und andere Geheimnisse aus allen `VITE_*`-Variablen
heraus. Lokale Umgebungsdateien sind von Git ausgeschlossen.
[Supabase-Dokumentation zu API-Schlüsseln](https://supabase.com/docs/guides/getting-started/api-keys)

Die Oberfläche umfasst den Entwicklungsstartbildschirm, einen Hinweis bei
unbekannten Adressen und eine Fehleransicht. Auth, Haushalte und Warnfrist
sind serverseitig vorbereitet. Ihre Bedienoberflächen und die Synchronisierung
stehen aus. Die PWA-Grundlage besteht aus dem
Web-App-Manifest. Die Installierbarkeit ist offen und es gibt keinen Offlinebetrieb.
Den aktuellen Prüfstand findest du in [PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## CI

GitHub Actions verwendet die Node-Version aus `package.json`, installiert mit
`npm ci` und führt Lint, Typprüfung, Formatprüfung, Tests und Build aus.
`package-lock.json` gehört zusammen mit dem Workflow ins Repository.
