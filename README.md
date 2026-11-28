# zäme

Lebensmittelmanagement für Haushalte ab drei Personen. zäme ist ein Schulprojekt
für die GBS-Höhle der Löwen in der Schweiz. Die App soll den gemeinsamen
Lebensmittelvorrat, Ablaufdaten und Einkäufe im Haushalt leichter koordinierbar
machen.

**Testfreigabe:** Der Haushaltstest wartet auf die Hosted- und Geräteabnahme. [Freigabestand und Anleitung](docs/USER_TEST_RELEASE.md)

## Technik

React, TypeScript im Strict-Modus, Vite und React Router bilden das Frontend.
Vitest und React Testing Library dienen für Tests, ESLint und Prettier für
Codequalität und Formatierung. Ein Web-App-Manifest und die Vercel-Konfiguration
bereiten den Betrieb vor. Supabase Auth, PostgreSQL und PostgREST tragen die lokale Haushaltsdatenbank.

## Lokal starten

Auth, Haushalt und Vorratsdatenbank benötigen Node 24, npm 11 und eine lokale Linux-Docker-Engine. Im gemeinsamen Entwicklungsstack verwenden API, PostgreSQL und Mailpit die Loopback-Ports 54321, 54322 und 54324. Die erste Ausführung lädt die Service-Images. Separate Teststacks sind unten beschrieben.

```sh
npm ci
npx --no-install supabase --version
npm run db:start
npm run db:migrate
```

`db:migrate` wendet ausstehende Migrationen lokal an. `db:reset` ersetzt den Inhalt der Wegwerfdatenbank und spielt alle Migrationen erneut ein. Das Skript prüft Projekt-ID, fehlende Remote-Verknüpfung, lokalen Docker-Endpunkt, Containerlabel, API- und DB-Adresse und Portbindungen. `db:types` schreibt die Typen nach `src/database.types.ts`. `db:stop` erhält den lokalen Datenstand. API-Tests entfernen ihre synthetischen Konten nach jedem Lauf.

Falls der Start eine allgemeine Portbindung meldet, in Docker Desktop unter **Settings → Resources → Network** die Standard-Portbindung auf **localhost** setzen, anwenden und den Start wiederholen. Diese Einstellung betrifft den Rechner. Alternativ dieselben Befehle auf einem isolierten Linux-Rechner mit Docker Engine ausführen. [Testbericht](docs/TEST_REPORT.md) · [Docker-Netzwerk](https://docs.docker.com/desktop/features/networking/) · [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

Der vollständige Regressionstest mit eigener Wegwerfdatenbank steht unten.

### Frontend

Nach `npm ci` und `npm run db:start` die Vorlage `.env.example` nach `.env.local` kopieren. Der folgende Befehl gibt ausschliesslich den öffentlichen Schlüssel des identifizierten lokalen Stacks aus. Diesen als `VITE_SUPABASE_PUBLISHABLE_KEY` übernehmen und die App starten.

```sh
node --input-type=module -e "import {localStatus} from './scripts/database/local.mjs'; const s=localStatus(); console.log(s.PUBLISHABLE_KEY || s.ANON_KEY)"
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

Vite verwendet `http://127.0.0.1:5173` mit festem Port. Bestätigung und Passwortreset kehren auf genau diesen Ursprung zurück. Auth-Sitzung, Profil, Einladungen und Haushaltsverwaltung sind angeschlossen. Die verantwortliche Person kann die Warnfrist ändern. Haushaltsmitglieder sehen die dringendsten Daten auf Start, suchen im gemeinsamen Vorrat und erfassen separate Chargen. Im Detail können sie Mengen verbrauchen und für sich reservieren. Bearbeiten enthält die Korrektur fehlerhafter Einträge. Die gemeinsame Einkaufsliste, authentifizierte Synchronisierung und EAN-13-Erfassung mit manueller Alternative sind integriert. Installationsdateien und Offline-Hinweis sind im Produktionsbuild enthalten. [Routen und Integrationsvertrag](docs/TASK_008_ANSCHLUSS.md)

Für die Browserprüfung den Entwicklungsserver beenden, den lokalen Datenbankstack laufen lassen und `npx playwright install chromium` sowie `npm run test:browser` ausführen. Der Test startet Vite selbst auf Port 5173, verwendet Mailpit und räumt seine synthetischen Konten auf. Unit-Tests mit `npm run test` benötigen keinen laufenden Stack. [Prüfstand](docs/TEST_REPORT.md) · [Hosting-Voraussetzungen](docs/ARCHITECTURE.md)

## CI

GitHub Actions verwendet die Node-Version aus `package.json`, installiert mit
`npm ci` und führt Lint, Typprüfung, Formatprüfung, Tests und Build aus.
`package-lock.json` gehört zusammen mit dem Workflow ins Repository.

## Integration 007.1 reproduzieren

Für den separaten Wegwerfstack in PowerShell `$env:ZAEME_TEST_STACK = 'integration'` setzen. Unter Linux `export ZAEME_TEST_STACK=integration` verwenden. Alle Befehle im selben Terminal ausführen. Der Stack verwendet das Projekt `zaeme-integration-0071`, den Container und das Volume `supabase_db_zaeme-integration-0071` sowie API 55821, PostgreSQL 55822 und Mailpit 55824 auf Loopback. Der Browserlauf verwendet in diesem Stack Port 6673, einschliesslich Auth-Rückkehr.

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:upgrade:check
npm run db:test
npm run db:test:api
npm run db:types
npm run db:types:check
npm run lint
npm run typecheck
npm run format:check
npm run test
npm run build
npx --no-install playwright install chromium
npm run test:browser
npm run db:stop
git diff --check
```

Reset und Upgradeprüfung ersetzen die Daten des ausgewählten Wegwerfstacks. Vor beiden prüft das Skript Projekt-ID, lokale Endpunkte, Containerlabel und Listener. Der Upgradevergleich erhält Profile, Haushalte, Mitgliedschaften und Einladungen aus Task 005. Browser und HTTP-Suite verwenden ihre eigenen synthetischen Konten nacheinander. Für ein vollständig leeres Integrationsvolume auch die internen GoTrue-Audit- und PKCE-Zeilen nach dem Test durch einen abschliessenden `npm run db:reset` im gewählten Wegwerfstack bereinigen, danach `npm run db:stop` ausführen.

Ohne Auswahl gilt die gemeinsame Konfiguration `zaeme-task005-local` mit den Ports 54321, 54322 und 54324. Für eine parallele Arbeitskopie kann eine Tasknummer wie `ZAEME_TEST_STACK=task007` angegeben werden (55321, 55322, 55324). Die abgeleiteten Dateien liegen unter `.local-stack/`. Ein neuer Terminalprozess ohne Variable oder `Remove-Item Env:ZAEME_TEST_STACK` in PowerShell wechselt zur gemeinsamen Entwicklungskonfiguration zurück.

Der Datenbankworkflow führt die erweiterten SQL-, HTTP-, Typ- und Browserprüfungen sequenziell aus. GitHub startet ihn beim Pull Request oder manuell. [Task-008-Vertrag](docs/TASK_008_VERTRAG.md) · [Testbericht](docs/TEST_REPORT.md)
