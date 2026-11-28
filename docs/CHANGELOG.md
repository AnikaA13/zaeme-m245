# Änderungsprotokoll

## Task 009B · Einkauf und Synchronisation

Der vierte Navigationseintrag öffnet die gemeinsame Einkaufsliste. Einträge lassen sich mit optionaler Menge und Einheit erfassen, bearbeiten, abhaken, wieder öffnen und nach Bestätigung entfernen. Im Produktdetail öffnet «Auf Einkaufsliste setzen» das mit dem Produktnamen vorbelegte Formular. Eigentümerinnen und Eigentümer können die gemeinsame Warnfrist zwischen 0 und 30 Tagen ändern. Haushaltssignale aktualisieren Vorrat, Einkauf und Haushaltseinstellungen.

## Task 009A · Gemeinsamer Einkauf und Haushaltssignale

Vier geschützte Einkaufs-RPCs und ein haushaltsbezogener Revisionszähler ergänzen die vier bisherigen Migrationen. Änderungen an Haushalt, Profil, Vorrat, Reservierung, Einkauf und Warnfrist invalidieren den gemeinsamen Stand im selben Commit. Der lokale Datenbankworkflow startet Realtime und prüft auch authentifizierte WebSockets. Parallele Stacks erhalten eigene Browser- und Auth-Rückkehrports. [Vertrag für 009B](TASK_009B_VERTRAG.md)

## Task 008 · Gemeinsamen Vorrat bedienen

Start, Vorrat, manuelle Erfassung, Detail, Bearbeitung, Verbrauch und eigene Reservierungen verwenden die vorhandene Datenbank. Lade- und Konfliktzustände, Datumsprüfung, Navigation und Abgleich offener Anfragen sind integriert. Gemeinsame Validierungsfälle und Browserabläufe mit PostgreSQL-Gegenprüfung ergänzen die bisherigen Regressionen. Alle vier Migrationen und die generierten Datenbanktypen bleiben auf dem Stand von 007.2.

## Task 007.2 · Registrierung im Browserlauf

Der Browserprüfer wartet bei Registrierung, Anmeldung und Passwortwiederherstellung auf die Überschrift des jeweiligen Formulars, bevor er das gleich beschriftete E-Mail-Feld ausfüllt.

## Task 007.1 · Integration von Haushalt und Vorrat

Die beiden Implementierungen sind lokal zusammengeführt. Neu sind die Sperre für geänderte offene Mutationen, die Prüfung von Vorratsquittungen und Sitzungswechseln sowie Meldungen für Datum, verfügbare Menge, Reservierungen und Vollverbrauch. Der Chromium-Test verbindet die vorhandenen Haushaltsaktionen mit echten Vorrats-RPCs und einer unabhängigen SQL-Prüfung. Der Datenbankworkflow führt anschliessend auch den Browserlauf aus. [Prüfbericht](TEST_REPORT.md)

## Task 006 · Anmeldung und Haushalte

Echte E-Mail-Flows, Profilpflege, Startansicht und Haushaltsverwaltung im Frontend ergänzt. Einladungen lassen sich erstellen, teilen, prüfen, einlösen und widerrufen. Die Haushaltsansicht verwendet RLS-Daten und prüft den Zugang erneut. Lokale Auth-Konfiguration und typisierter Client sind auf Vite abgestimmt. Neu sind das verifizierte Projektlogo sowie Protokoll-, Sitzungs-, Komponenten- und Chromium-Tests mit Mailpit. [Testbericht](TEST_REPORT.md)

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

## 25. November 2026 · Task 007

- Chargen und eigene Reservierungen mit Haushalts-RLS, exakten Mengen, Metadatenprüfung, Versionen und fünf transaktionalen RPCs ergänzt. Aktive Lesesicht mit persönlichen und gemeinsamen Mengen hinzugefügt.
- Austritt und Entfernung geben die Reservierungen der betroffenen Person atomar frei. Der bestätigte Vollverbrauch prüft die beobachtete Chargenversion.
- Datenbanktypen generiert. Isolierte lokale Stack-Konfiguration, Upgradeprüfung mit Bestandsdaten, gemeinsame F10-Fixtures, pgTAP-, Rollback- und HTTP-Konkurrenztests ergänzt. [Prüfnachweis](TEST_REPORT.md)
