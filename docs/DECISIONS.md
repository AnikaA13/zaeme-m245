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
