# Technische Entscheidungen

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
