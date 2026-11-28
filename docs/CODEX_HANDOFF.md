# Übergabe für die Umsetzung

## Anschluss an Task 009A

Der Backend-Branch ergänzt zwei Migrationen nach der integrierten Viererbasis. Für die Einkaufsoberfläche, den Sitzungswechsel, die Warnfrist und den Realtime-Kanal gilt der [Vertrag für Task 009B](TASK_009B_VERTRAG.md). Bei der späteren Integration die Browserprüfungen und Dokumentation aus Task 008 mit dem getrennten Browserport und den 009A-Nachweisen zusammenführen. [Lokaler Prüfbericht](TEST_REPORT.md)

## Anschluss nach Task 008

Task 009 übernimmt `/shopping`, die sekundären Produktaktionen und `invalidateInventory()`. Task 010 übernimmt die Erfassungsaktion und `ProductForm` mit `CaptureInput`. Task 011 prüft reale Geräte, Bedienhilfen, Softwaretastaturen und private Cache-Grenzen. Die [Anschlusspunkte](TASK_008_ANSCHLUSS.md) beschreiben die konkreten Schnittstellen. Für ausgeführte Prüfungen gilt der [Prüfbericht](TEST_REPORT.md).

## Stand nach Task 007.1

Basis für die technische Prüfung ist der lokale Branch `integration/m3-auth-inventory`. Für Task 008 gelten der [integrierte Schreib-, Lese- und Sitzungsvertrag](TASK_008_VERTRAG.md) sowie die [tatsächlichen Regressionsergebnisse](TEST_REPORT.md). F03/F05/F07/F10/F17 benötigen die Bedienoberfläche. Die Navigationsfolge bleibt Start — Vorrat — Hinzufügen — Einkauf — Haushalt.

Ziel ist die stabile Testversion am 01.12.2026. Schulauftrag und ausdrückliche PO-Entscheide führen. Fachregeln, Prioritäten und Abnahme stehen in [MVP_SPEC.md](MVP_SPEC.md), Gestaltung und Interaktion in [UX_SPEC.md](UX_SPEC.md). Die Gruppe prüft die Spezifikation noch. M0 und die bestehenden npm-Skripte, Router, Tests und CI erhalten.

- **Haushalt und Auth.** E-Mail/Passwort mit Registrierung, Login, Logout, Reset und persistenter gültiger Sitzung. Maximal ein Haushalt je Konto, genau ein Owner je Haushalt. Onboarding ohne Haushalt möglich. Gehashte, widerrufbare Mehrfacheinladung mit standardmässig sieben Tagen Gültigkeit. Owner verwaltet Einladung, Entfernung und gemeinsame Warnfrist. Allein darf er den Haushalt bestätigt auflösen.
- **Vorrat.** Jede Charge separat speichern. Manuell oder nach echtem EAN-13-Scan mit Open Food Facts im selben editierbaren Formular bestätigen. Bei verweigerter Kamera, unbekanntem Produkt oder Timeout manuell weiterarbeiten, Kamera freigeben. Kein Datum aus dem Barcode ableiten. F10 client- und serverseitig anwenden.
- **Verbrauch und Reservierung.** Verbrauch ist primär, Vollverbrauch verlangt Bestätigung. Nur eigene Mengen reservieren, ändern und freigeben. Eigene Reservierung zuerst verbrauchen, anschliessend freie Menge. Auch der Owner kann fremde Mengen nicht antasten. Austritt und Entfernung geben Reservierungen atomar frei. Undo ist zurückgestellt.
- **Frist und Einkauf.** Ganze 0–30 Tage, Standard 3, Kalendertage in Europe/Zurich. Unbekannte Daten neutral anzeigen, MHD und Verbrauchsdatum unterscheiden. Gemeinsame Einkaufsliste erstellen, bearbeiten, abhaken, wieder öffnen und entfernen. Aus dem Vorrat Namen übernehmen. Abhaken erzeugt keinen Bestand.
- **Navigation und Marke.** Start, Vorrat, Hinzufügen, Einkauf, Haushalt. Mitte öffnet Scan und manuelle Alternative, Abbruch führt zum vorherigen Ziel. Start behält beide Einstiege. Beschriftungen, Icons, Safe Area und Touch-Ziele bei 320 px prüfen. Originalmarke mit Violett/Mint/Creme/Koralle, Schweizer Standarddeutsch, TT.MM.JJJJ.
- **Betrieb.** Installation auf Android Chrome und iOS Safari ist P0. Online-only mit Refetch nach Mutation, Fokus, Reconnect und Realtime-Signal. Offline nur sichtbar veralteter RAM-Stand. Bei Logout private Daten verwerfen. Allenfalls nur öffentliche statische Ressourcen im Service Worker speichern.

[Datenmodell](DATABASE_SPEC.md), [Sicherheitsvertrag](SECURITY_SPEC.md) und [RPC-Vertrag](RPC_SPEC.md) sind Architekturvorschläge. Client schreibt über autorisierte Transaktionen mit Haushalts- und Chargensperre, Versionen und stabiler Operations-ID. Keine Service-Role im Browser. [Umsetzungsplan](IMPLEMENTATION_PLAN.md) beschreibt 005–011 und den frühen HTTPS-Gerätetest. Der [Testplan](TEST_PLAN.md) umfasst TT01–TT20, reale Konkurrenz, direkte API- und RPC-Aufrufe, drei Konten und Fremdhaushalt, Geräte und Nutzertests. Ist-Ergebnisse separat in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) nachführen.

P1 erst nach stabiler P0-Abnahme: Wiederverwendung, Feldvorschläge, zusätzliche Filter, geführte Einkaufsübernahme, Push. Für Push gelten Einwilligung, generische Sperrbildschirmmeldung, höchstens tägliche deduplizierte Zustellung und Widerruf gemäss F18. Ausschlüsse stehen in MVP Abschnitt 3. Spätere Lieferung umfasst Migrationen, generierte Typen, Setup ohne Geheimnisse, Testaufbau und tatsächlichen Testbericht. Offene P0-Prüfungen blockieren die Vollfreigabe.
