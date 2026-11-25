# Änderungsprotokoll

## Task 005 · lokale Haushaltsdatenbank

Zwei Migrationen führen Profile, Haushalte, Mitgliedschaften, Einladungen, Versuchszähler und Operationsquittungen ein. Elf typisierte RPCs steuern Zugriff und Warnfrist. Neu sind eine gepinnte Entwicklungs-CLI, generierte Datenbanktypen, pgTAP-, API- und Konkurrenztests und ein separater Linux-Workflow. Nach Umstellung und Prüfung der tatsächlichen Host-Portbindung bestand der lokale Abschlusslauf. [Nachweise](TEST_REPORT.md)

## Task 003 · M0-Release

- Geprüfte Anwendungsgrundlage, Sperrdatei und CI-Workflow für den
  Release-Zweig `chore/m0-application-foundation` zusammengestellt.

## Task 002 · M0-Verifikation und Übergabe

- GitHub-Actions-Workflow für die npm-Qualitätsprüfungen mit Node.js 24 ergänzt.
- Renderfehler und Neuladeschaltfläche mit der bestehenden React-Fehlergrenze
  in einem Komponententest geprüft.
- Prüfstand, Grenzen der PWA-Grundlage und die noch offenen Freigaben dokumentiert.

## Task 001 · Initiale Projektgrundlage

- React-Einstieg mit TypeScript im Strict-Modus und Vite ergänzt.
- Entwicklungsstartseite, Routing für unbekannte Adressen und Fehlergrenze
  erstellt.
- Globale Stile, zentrale Markenfarben und sichtbare Tastaturfokuszustände
  definiert.
- Paketdefinitionen und Prüfskripte für Build, Typen, Lint, Tests und
  Formatierung erstellt.
- Zwei Rauchtests für die Startseite und eine unbekannte Adresse ergänzt.
- Paketversionen in `package-lock.json` festgehalten und jest-dom für
  die Typkompatibilität mit Vitest 5 auf Version 8 aktualisiert.
- Web-App-Manifest, Vercel-SPA-Konfiguration sowie öffentliche
  Supabase-Umgebungsvariablen als Vorlage hinzugefügt.
- Installationsanleitung, Architektur, Entscheidungen, Rahmenanforderungen,
  UX-Stand und Testplan dokumentiert.

## Task 004 · Spezifikation und Architekturplanung

- Navigation, Reservierungsrechte, Vollverbrauch, Validierung, Fristen, Installation und P0/P1-Abnahme auf die PO-Entscheide abgestimmt. Anforderungs-IDs und historische Testbeobachtungen erhalten.
- Schema, RLS, sichere Einladungen, RPCs, Gleichzeitigkeit und Synchronisierung zur Prüfung dokumentiert. Tasks 005–011, Abnahmetests und Anforderungsnachweise zugeordnet.
- M0-Merge und lokale Herkunft des Mobile-Prototyps dokumentiert. Der Änderungsumfang besteht aus Projektdokumentation und Repository-Anweisungen.
