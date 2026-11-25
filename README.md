# zäme

Lebensmittelmanagement für Haushalte ab drei Personen. zäme ist ein Schulprojekt
für die GBS-Höhle der Löwen in der Schweiz. Die App soll den gemeinsamen
Lebensmittelvorrat, Ablaufdaten und Einkäufe im Haushalt leichter koordinierbar
machen.

## Technik

React, TypeScript im Strict-Modus, Vite und React Router bilden das Frontend.
Vitest und React Testing Library dienen für Tests, ESLint und Prettier für
Codequalität und Formatierung. Ein Web-App-Manifest und die Vercel-Konfiguration
bereiten den Betrieb vor. Als Backend ist Supabase vorgesehen.

## Lokal starten

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

Der aktuelle Umfang umfasst den Entwicklungsstartbildschirm, einen Hinweis bei
unbekannten Adressen und eine Fehleransicht. Anmeldung, Haushalte, Datenspeicherung
und Synchronisation sind ausstehend. Die PWA-Grundlage besteht aus dem
Web-App-Manifest. Die Installierbarkeit ist offen und es gibt keinen Offlinebetrieb.
Den aktuellen Prüfstand findest du in [PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## CI

GitHub Actions verwendet die Node-Version aus `package.json`, installiert mit
`npm ci` und führt Lint, Typprüfung, Formatprüfung, Tests und Build aus.
`package-lock.json` gehört zusammen mit dem Workflow ins Repository.
