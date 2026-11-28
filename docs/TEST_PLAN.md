# Testplan

## Task 010B · Abnahme der Erfassung

Die App-Browsersuite prüft die beiden Einstiege und die Herkunft bei Abbruch, verspätete Kamerazusage, verweigerte Freigabe, optische EAN aus Video, korrigierten Produktnamen, explizite Anlage, verlorene Quittung, echten Retry und weitere Erfassung. Die Providerantworten bleiben kontrolliert. Unabhängige Datenbankabfragen prüfen Anzahl und Inhalte der Chargen. Der getrennte 010A-Prüfstand und die Lebenszyklustests bleiben Bestandteil der Regression.

Android Chrome und iOS Safari jeweils auf dem freigegebenen HTTPS-Build mit dem 20er-Blatt prüfen. Modell, Versionen, Ursprung und Revision vor Beginn eintragen. Für NF06 und NF07 zusätzlich mit offener Tastatur, Vergrösserung und aktivem TalkBack beziehungsweise VoiceOver Feldfehler, Fokus, Abbruch und Rückkehr prüfen. [Gerätetestblatt](TASK_010A_GERAETETEST.md)

## Regression 008 · Vorratsoberfläche

`npm run test` prüft die geteilten Grenzfälle, lokale Datumsklassifizierung, Leseinvalidierung, mehrere Reservierungsseiten und offene Aufträge isoliert. `npm run test:browser` führt die bestehenden Mailpit-, Auth- und Haushaltsszenarien sowie `browser-core.mjs` aus. Eine echte verlorene Antwort wird erst nach der Serverquittung verworfen. SQL prüft gespeicherte Mengen, Versionen, NULL-Werte und Löschungen unabhängig von der UI. Zwei Browserkontexte ändern dieselbe Charge. Separate Haushalte und verspätete Antworten prüfen die Sichtgrenze. Für den Leistungstest werden 200 und anschliessend insgesamt 1005 zusätzliche synthetische Chargen eingefügt. Die Zeitmessung umfasst eine echte Navigation bis zur ersten sichtbaren Listenzeile. `ZAEME_SCREENSHOTS=1` aktiviert repräsentative PNG-Aufnahmen des synthetischen Haushalts. Geräte- und Nutzertests erfolgen getrennt.

## Regression 007.1 · F01/F02/F03/F07/F10/F17, NF01/NF08/NF09/NF13

Nach Reset und Upgrade pgTAP, HTTP und Typvergleich ausführen. Danach im selben Wegwerfstack mit Mailpit und Chromium prüfen. Die bestehende Szenarienfolge A–J und der fehlerhafte Logout bleiben Bestandteil des Laufs.

| Fall                 | Auslöser                                                                                | Unabhängiger Nachweis                                                                          |
| -------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Austritt             | Mitglied verlässt den Haushalt über die UI                                              | Reservierung entfernt, Menge konstant, Version erhöht, alter Zugriff abgelehnt                 |
| Entfernung           | Owner entfernt Mitglied mit zwei Reservierungen                                         | Beide Versionen erhöht, übrige Reservierungen und Gesamtmengen erhalten, altes JWT ohne Zugang |
| Wiederbeitritt       | Mitglied verwendet gültige Einladung                                                    | Neue Generation, alte Quittung und alter Verbrauch abgewiesen, alte Zielgeneration wirkungslos |
| Auflösung            | Alleiniger Owner bestätigt mit reserviertem Bestand                                     | Haushalt, Chargen und Reservierungen entfernt, Konto und Profil weiter nutzbar                 |
| Asynchrone Antworten | Profilmutation verzögern, währenddessen abmelden und anderes Konto anmelden             | Neuer Name und Route erhalten, keine alte Erfolgsmeldung                                       |
| PKCE                 | Normale und vertauschte Rückkehr mit echtem Code, anderer Browser und verbrauchter Link | Passwortformular nur nach gültiger Recovery, URL bereinigt                                     |

In Vitest zusätzlich unveränderliche Eingaben, Doppelsubmit, neue Absicht, getrennte Chargen, OP_EXPIRED, Generationenwechsel während Nachprüfung und falsche Quittungen prüfen. Ein physischer Gerätetest, Hosted SMTP und HTTPS sind gesonderte Abnahmen.

## Task 006 · reproduzierbarer lokaler Lauf

`npm ci`, `npm run db:start`, `npx playwright install chromium` und `npm run test:browser` ausführen. Port 5173 muss frei sein. Der Test verwendet vier eigene Browserkontexte und zufällige Konten unter `example.invalid`. Alle vier registrieren sich über das Formular. Der Runner liest ihre tatsächlichen lokalen E-Mails und öffnet die Links im zugehörigen Kontext. Er schliesst Browser und Vite und entfernt die Konten, ihre Haushalte und die erfassten Nachrichten. Er schreibt weder Traces noch Screenshots.

Die Szenarien A–J decken Bestätigung, persistenten Login, Haushaltsgründung, drei Mitgliedschaften, Isolation, Widerruf, Entfernung, Kontowechsel, Passwortwechsel, Austritt und Auflösung ab. Eine verzögerte echte Profilantwort prüft den Wechsel im selben Dokument. Die mobilen Prüfungen messen Überlauf und sichtbare Bedienflächen bei 320, 375, 390, 430 und 1280 CSS-Pixeln sowie 100 und 200 Prozent Schriftgrösse.

Ergänzend `npm run test` für isolierte Zustands- und Protokolltests und die drei DB-Regressionsbefehle gemäss README ausführen. Manuell auf iOS und Android die Texteingabe mit geöffneter Tastatur, Fokus nach Dialogen, Screenreader-Ausgabe, Teilen und Zwischenablage prüfen. Für Hosted-Tests gilt die separate [Freigabeliste](ARCHITECTURE.md).

## Ausführbare Prüfungen für 005

`npm run db:test` führt die pgTAP-Suite in einer zurückgerollten Transaktion aus. `npm run db:test:api` erstellt synthetische Konten für den jeweiligen Lauf, meldet sie mit Passwort an und ruft PostgREST mit den ausgestellten Tokens auf. Die Admin-API dient nur der Fixture-Erstellung. SQL kontrolliert Endzustände und setzt Ablaufzeitpunkte. Für einen Ablaufversuch hält eine separate psql-Verbindung die Haushaltszeile gesperrt. Der Test weist den tatsächlich wartenden Beitritt über `pg_blocking_pids` nach.

Zu TT01/02/07/12/16/17/19 liegen Teilnachweise für Haushalte vor. Linux-Wiederholung, Auth-Mailversand, Oberflächen und spätere Bestands-/Reservationsfälle haben eigene Nachweise. [Testergebnisse](TEST_REPORT.md)

## Historischer Prüfplan der M0-Hülle

- `npm run test` führt die Tests einmal aus. Die zwei Rauchtests prüfen
  die sichtbare Überschrift, den Entwicklungsstatus und die Rückkehrmöglichkeit
  bei einer unbekannten Adresse. Der Komponententest löst einen Renderfehler
  aus und prüft die Fehleransicht und die zugängliche Neuladeschaltfläche.
- Für einen lokalen Lauf bei `spawn EPERM` in der Windows-Sandbox steht
  `npm run test -- --pool=threads` zur Verfügung. Den Standardlauf mit
  `npm run test` in einer regulären lokalen Shell oder auf GitHub Actions prüfen.
- `npm ci` installiert die Abhängigkeiten aus der Sperrdatei.
  `npm run typecheck`, `npm run lint`, `npm run format:check` und
  `npm run build` prüfen Typen, Regeln, Formatierung und Bündelung.
- Zur lokalen Browserprüfung ohne Supabase-Konfiguration `npm run dev`
  starten. Die Startseite und eine unbekannte Adresse bei 320 px und auf einem
  breiten Bildschirm öffnen. Mit der Tabulatortaste den sichtbaren Fokus
  prüfen und den Link zur Startseite auslösen.
- Nach einem erfolgreichen Build mit `npm run preview` die gerenderte
  Startseite und die direkt aufgerufene Fehlroute im Browser prüfen. Den
  Abruf und den Inhalt des Web-App-Manifests separat kontrollieren.
- Für die Browserprüfung der Neuladeaktion lokal vorübergehend einen
  Renderfehler in einem Kind der Fehlergrenze auslösen. Die Meldung prüfen,
  «Seite neu laden» auslösen und den Dokumentabruf im Netzwerk-Tab verfolgen.
  Anschliessend die temporäre Änderung zurücknehmen.
- Für die spätere Installationsprüfung die App über HTTPS auf den vorgesehenen
  Android- und iOS-Geräten installieren und vom Startbildschirm öffnen.

## Geplant

Unit-Tests für fachliche Regeln, Komponenten- und Integrationstests für
Benutzungsabläufe sowie Datenbanktests für Haushaltsisolation und RLS.
Playwright kann später echte Anmelde- und Haushaltsabläufe, mehrere
Browserbreiten, Tastaturbedienung und PWA-Verhalten prüfen. Das Projekt
verwendet stabile Routen und semantische Rollen als Ansatzpunkte.
Playwright-Installationen und Testkonten folgen mit dem ersten relevanten
End-to-End-Ablauf. Die Ignore-Regeln decken Berichte und lokale Sitzungen ab.

## Geplante Abnahme auf realer Datenbank

Die erwarteten Ergebnisse jedes TT01–TT20 stehen in [MVP_SPEC.md](MVP_SPEC.md). Alle folgenden Tests sind offen. Frischen lokalen Supabase-Stack oder isolierten CI-Stack aufsetzen, Migrationen ausführen. Synthetische Konten A (Owner), B, C im ersten Haushalt, D im zweiten Haushalt und E ohne Mitgliedschaft über Auth erzeugen. Mit gültigen Anmeldungen eigene Clients/JWTs beziehen, Gast mit Publishable Key ohne Sitzung. Fixture-Schlüssel ausserhalb des Browsers. Nach jeder Suite lokale DB verwerfen oder Projekt-Fixtures kontrolliert entfernen, Sitzungen und Browserprofile löschen. Keine echten Personen oder Produktionsdaten.

| Task | Werkzeuge, Tests und erwartete Beobachtung                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 005  | pgTAP für Unique/FK/Owner am Commit, nichtrekursive Policies und Rollenrechte. Über Data API und RPC mit jeder Rolle sämtliche Tabellenaktionen und Rückgaben aus der Sicherheitsmatrix testen. TT01/02 auch mit bekannten Fremd-IDs. Invite erstellen, Vorschau, zwei Einlösungen, Ablauf/Widerruf, ungültig und Budgetüberschreitung. Gleichzeitiger Beitritt desselben Kontos zu zwei Haushalten, Join gegen Auflösung, Owner-Austrittsverbot. Keine Rohschlüssel in Logs oder Listen. |
| 006  | Playwright mit isolierten Browserkontexten und lokalen Testmails: Registrierung bestätigen, Reset, Login/Logout, Reload, Einladungslink vor Login und Wiederöffnung in anderem Tab. TT10 und Mitgliedschaftsteil von TT12. Nach Logout verzögerte Antwort künstlich freigeben, kein Zustand von A in Sitzung D.                                                                                                                                                                           |
| 007  | TT04/06/11–17. pgTAP für FKs auch über Haushaltsgrenzen, Mengen/Einheiten und Datumsregeln, Versionskonflikt, Quittung und Ablauf. Zusätzlich unabhängige gleichzeitig laufende Transaktionen wie unten. Mutationspfade mit normalen JWTs wiederholen. Client-Rolle darf keinen direkten UPDATE ausführen.                                                                                                                                                                                |
| 008  | Vitest/RTL mit identischen akzeptierten/abgelehnten Werten wie DB: 0, 9999, 9999.001, 1.4 Packungen, 0.001 kg, vier Nachkommastellen, leere/101-stellige Namen, alle Kategoriepaare, Schaltjahr, +5/+20 Jahre und erster Tag darüber. EAN mit führender Null und falscher Prüfziffer. TT06/07/11/13/14. Zürich Mitternacht und beide Sommerzeitwechsel mit fixierter Uhr. Bei 320 px alle fünf beschrifteten Bedienelemente und Fokus-Rückgabe nach Abbruch prüfen.                       |
| 009  | TT03/07/08/09/19. Zwei Browsergeräte: Zeit von bestätigter Mutation bis Neudarstellung messen, stabile Verbindung und Revision protokollieren. Einkauf abhaken, genau gleiche Chargenzahl. Frist nur durch Owner, 0/3/7/30 und jeweils n/n+1 testen. Realtime trennen, Fokus/Reconnect und periodischen Abgleich prüfen. Zähler fremder Haushalte und private Löschereignisse dürfen auch bei breitem Abonnement nicht ankommen.                                                          |
| 010  | TT05, AK06.1–7. Mocks für Fehlerzustände, dazu echte Kamera und 20 lesbare Schweizer EAN-13, Gerät/Browser/HTTPS, Scanerfolg separat vom Produktnamen-Treffer, manueller Fallback bei verweigerter Kamera, Abbruch und Timeout.                                                                                                                                                                                                                                                           |
| 011  | TT18/20 auf physischen Geräten, iOS Safari und Android Chrome: installieren, Standalone, Auth und Kamera erneut prüfen. Cache Storage, IndexedDB und Netzwerk nach Logout und Offlinebetrieb auf private Antworten prüfen. NF03 mit 200 Chargen; Zeit, Testgerät und Netz erfassen. Gesamte TT01–TT20 und AC-Kriterien gegen Release-Build prüfen.                                                                                                                                        |

**Echte Parallelität.** Zwei unabhängige DB-Verbindungen oder authentifizierte HTTP-Clients an einer Startbarriere freigeben. Für deterministische Rennen im lokalen DB-Harness Transaktion A nach Sperrerwerb offen halten, B in separater Verbindung starten, tatsächliches Warten feststellen, erst dann A committen. Mit umgekehrter Reihenfolge wiederholen. Akteur und normale Rollenrechte pro Verbindung setzen. Endzustand und Quittungen aus dritter Verbindung lesen. Bei TT04 Bestätigung auch dann testen, wenn die zweite Teilmenge inzwischen die letzte ist. Bei TT17 nach Commit die HTTP-Antwort verwerfen und dieselbe op erneut senden. Die sieben Sollausgänge stehen in [RPC_SPEC.md](RPC_SPEC.md). Zwei nacheinander ausgeführte RPCs prüfen Fachregeln, belegen aber keine Parallelität. [Supabase-Datenbanktests](https://supabase.com/docs/guides/database/testing)

**Nutzertest.** Erst nach technischer P0-Abnahme möglichst Familie und WG mit mindestens drei Mitgliedern beobachten. Pro Aufgabe Start/Ende, Erfolg, benötigte Hilfe und Fehler protokollieren. G01 Vorrat ≤10 s, G02 bald fälliger Artikel ≤5 s, G03 manuell Median ≤30 s, G04 bekannter Scan Median ≤20 s, G05 Vollverbrauch ab Detail höchstens zwei Interaktionen inklusive Bestätigung ohne betroffene Reservierung, G06 Synchronisierung ≤3 s, G07 Pflegeaufwand Median ≤2/5, G08 ≥90 % der Kernaufgaben ohne Hilfe. Das sind Messziele. Teilnehmerzahl, Geräte und tatsächliche Ergebnisse später ausweisen. Historische Prototypbeobachtungen getrennt erhalten.

## 007 · Automatisierte Backend-Abnahme

`db:test` prüft Tabellenbedingungen, Sichtrechte, Fremdschlüssel, Kalendergrenzen und Transaktionsrücknahme. `db:test:api` verwendet echte JWTs und PostgREST. Für Konflikte hält eine dritte Sitzung die Haushaltszeile, bis PostgreSQL beide wartenden Sitzungen über `pg_blocking_pids` nachweist. Nach der Freigabe werden Quittungen und persistierter Endzustand geprüft. TT04/11 unterscheiden additiven Teilverbrauch und bestätigten Vollverbrauch. TT12–17 decken Reservierungen, Austritt, Entfernung, Versionen und doppelte Zustellung ab.

Task 008 kann `fixtures/inventory-validation.json` direkt importieren. Für `items` die Felder über einen gültigen Basisnamen legen und mit `valid` vergleichen. `reservations` enthält Bestand, Einheit, absolute Zielmenge und erwarteten Code. `expiry` beschreibt Kalenderjahre und anschliessende Tage relativ zum Zürcher Testdatum, Bestätigung und Fehlercode. `code=null` steht für Erfolg. Die identischen Beispiele laufen über die lokale API. Browserdarstellung, Dialogbindung, Darstellung von Kommawerten und Aktualisierung zwischen Geräten werden nach Integration manuell geprüft.
