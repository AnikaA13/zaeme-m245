# Architektur

## Browseranwendung ab Task 006

React Router führt Gäste auf `/welcome`, `/auth/login`, `/auth/register`, `/auth/confirm` und `/auth/forgot-password`. Das SDK verwaltet die Sitzung. Bei PKCE verarbeitet die Anwendung genau einen Code über `exchangeCodeForSession`. Die automatische URL-Erkennung ist ausgeschaltet. Der Browser entfernt Query und Fragment vor dem Austausch. Nur der vom SDK beim erfolgreichen Austausch bestätigte Recovery-Vorgang öffnet das Passwortformular für das zugehörige Konto. Nach Neuladen dieses Formulars braucht es einen neuen Link. [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)

`/profile/setup` legt den Anzeigenamen mit Version 0 an. `/` zeigt nach abgeschlossener Zugangsprüfung das Onboarding oder den persönlichen Start. `/household/create`, `/join` und `/household` verwenden die generierten Typen. Der Client liest zuerst das eigene Profil und die eigene Mitgliedschaft, anschliessend den autorisierten Haushalt mit eingebetteten Mitgliedern und Anzeigenamen. Die bestätigte Rolle stammt aus dem Vergleich mit dem gelesenen Owner. Fehler unterbrechen den Zugriff bis zur erfolgreichen Wiederholung.

Ein zentraler Sitzungsspeicher verwirft laufende Lesevorgänge beim Kontowechsel. Schreibanfragen sind an die Sitzung und Mitgliedschaftsgeneration gebunden. Der Abgleich läuft nach Mutationen, bei Fokus, Sichtbarkeit, Wiederverbindung und alle 30 Sekunden im sichtbaren Dokument. Gleichzeitige Lesevorgänge werden zusammengeführt. Der SDK-Callback plant die Datenabfrage ausserhalb des Auth-Callbacks ein. Beim Logout verschwindet die private Ansicht vor dem Netzaufruf. Bei fehlender Serverbestätigung verwirft die App die lokale Sitzung und weist darauf hin. Bereits ausgestellte JWTs haben ihre eigene Gültigkeitsdauer.

Eine Einladungsabsicht bleibt im RAM. Für die Rückkehr aus einer Bestätigungsmail darf der ursprüngliche Tab Zweck, Code, Zieladresse und Ablaufzeit für höchstens 15 Minuten in `sessionStorage` halten. Die Rückkehr übernimmt den Eintrag einmalig und prüft die bestätigte Identität. Nach Abbruch, Kontowechsel oder Beitritt wird er verworfen. Auf einem anderen Gerät den ursprünglichen Link erneut öffnen. Der Rohcode einer neu erstellten Einladung ist ausschliesslich in der geöffneten Erstellungsansicht verfügbar.

## Freigabe für gehostete Authentifizierung

**NOT RUN.** Vor einer kontrollierten HTTPS-Abnahme sind folgende Schritte erforderlich.

1. Separates Supabase-Testprojekt anlegen. PostgreSQL-Version, Berechtigungen der Migrationsrolle und tatsächlich exponierte Data-API-Schemas prüfen. Migrationen und Autorisierungstests dort ausführen.
2. E-Mail-Bestätigung aktivieren, Passwortminimum auf acht Zeichen abstimmen und Rate-Limits passend zum Testbetrieb setzen. SMTP-Anbieter, Absenderdomain und Zustellbarkeit prüfen.
3. Stabilen HTTPS-Ursprung für die Vercel-Testumgebung festlegen. Site URL exakt setzen. Nur die vollständigen URLs für `/auth/callback` und `/auth/reset-password` freigeben. Für Produktion Ursprung und Schlüssel getrennt konfigurieren.
4. In Vercel nur öffentliche URL und Publishable Key für das Frontend setzen. Bundle und Logging von Proxy, Auth und Data API auf Zugangsdaten, Anfrageinhalte und Callback-URLs prüfen.
5. Mit echten zugestellten Bestätigungs- und Recovery-Mails sowie zwei getrennten Browserkontexten prüfen. Geräteabnahme und SMTP-Zustellung separat dokumentieren.

## Implementierter Stand 005

PostgREST exponiert `public`. Zwei Migrationen erstellen vier Fachtabellen, zwei interne Tabellen und elf gesicherte Datenbankoperationen. Der künftige Browserclient liest die eigene Mitgliedschaft mit ihrer Generation und übermittelt diesen Kontext bei Änderungen. PostgreSQL prüft die Berechtigung in jeder Transaktion. Die generierten TypeScript-Typen beschreiben das Schema. Grants und RLS bestimmen, welche Felder und Zeilen ein Client nutzen darf.

Die SPA verwendet weiterhin den M0-Einstieg. 006 übernimmt Auth und Haushaltsoberflächen. 007 erweitert Austritt und Entfernung gemeinsam mit den Reservationen. 009 ergänzt Einkauf und Realtime. Die weiteren Abschnitte dokumentieren M0 und die Zielarchitektur. [Nachweis](TEST_REPORT.md)

## Implementierte Grundlage

```text
public/           Statische Ressourcen und Web-App-Manifest
src/
  app/            Anwendungshülle, Routen, Fehlergrenze und Rauchtests
  features/start/ Entwicklungsstartbildschirm
  styles/         Globale CSS-Regeln und Design-Tokens
  test/           Gemeinsame Testeinrichtung
docs/             Anforderungen, UX, Entscheidungen und Projektstand
```

`index.html` lädt `src/main.tsx`. Der React-Einstieg setzt die Fehlergrenze
um den BrowserRouter. Die Anwendungshülle zeigt den Entwicklungsstartbildschirm
unter `/` und unter allen übrigen Adressen «Seite nicht gefunden» mit einem
Link zurück zur Startseite. Vite baut eine statische SPA nach `dist/`.
Die Fehleransicht für unbekannte Adressen ist eine Client-Route. In der lokalen
Vorschau liefert der direkte Aufruf den HTML-Einstieg mit HTTP 200.
`vercel.json` enthält eine Umschreibregel für direkte Routenaufrufe.
[Vercel-Dokumentation zu Vite](https://vercel.com/docs/frameworks/frontend/vite)

Die React-Fehlergrenze zeigt bei Fehlern im Komponentenbaum eine Meldung und
eine Schaltfläche für `window.location.reload()`. Fehler vor dem React-Einstieg
wie ein fehlendes Wurzelelement, Fehler in Ereignishandlern sowie asynchrone
Fehler ausserhalb des Komponentenbaums liegen ausserhalb ihrer Zuständigkeit.
Bei deaktiviertem JavaScript erscheint der Hinweis aus `index.html`.

Das verknüpfte Web-App-Manifest definiert Name, Sprache, Startadresse, Geltungsbereich,
`standalone` und Farben. App-Symbole, ein Service Worker und eine Offline-Strategie
fehlen. Die Installierbarkeit auf Zielgeräten ist ausstehend.

## Vorgesehener Backend-Anschluss

Supabase Auth soll Sitzungen verwalten. Fachliche Komponenten sollen
validierte Eingaben über einen typisierten Supabase-Client senden. PostgreSQL
soll Daten speichern und den Zugriff durch Row Level Security auf berechtigte
Haushaltsmitglieder beschränken. Die Oberfläche soll bestätigte Ergebnisse und
verständliche Fehler anzeigen. Realtime ist für bestätigte Anwendungsfälle
vorgesehen. Die spätere Einrichtung soll versionierte Migrationen unter
`supabase/migrations/` und Tests für erlaubte sowie verweigerte Zugriffe
umfassen. Ein Client, Migrationen und verbindliche Datenmodelle werden mit
dem ersten freigegebenen Backend-Meilenstein ergänzt.

## Zielarchitektur ab 005 · Vorschlag

Eine Vite-SPA, Supabase Auth, PostgREST/RPC und PostgreSQL. Eine serverseitig autorisierte Datenquelle versorgt alle Geräte. Kein eigener Anwendungsserver. [Schema](DATABASE_SPEC.md), [Zugriffsregeln](SECURITY_SPEC.md) und [Transaktionen](RPC_SPEC.md) definieren die Grenzen. Start, Vorrat, Hinzufügen, Einkauf, Haushalt führen durch die App. Die Erfassungsaktion merkt sich Herkunftsziel und Fokus.

| Künftiges Modul                             | Verantwortung                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| features/auth und features/household        | Auth-Callback, Reset und Sitzung, danach Mitgliedschaft, Einladungen und Owner-Verwaltung          |
| features/inventory                          | Chargen, Reservierungen, Versionen, Verbrauch, Details und Suche                                   |
| features/expiry                             | Reine Kalenderfunktionen, de-CH, Frist inklusiv, Tageswechsel und Sommerzeit                       |
| features/capture                            | Gemeinsames manuelles Formular, Kamerastream und Abbruch, EAN-Prüfziffer, begrenzter OFF-Lookup    |
| features/shopping                           | Gemeinsame Liste und ausdrücklich gesetzter Erledigt-Status                                        |
| shared/ui, shared/validation, shared/errors | Dialog mit Fokus-Rückgabe, Feldregeln, Fehlercodes und schweizerische Meldungen                    |
| integrations/supabase                       | Ein Client, generierte Typen, Sitzungskontext, Queries und RPCs; Komponentendaten im React-Zustand |

Module erst bei funktionierendem Durchstich anlegen. Keine neue State-Bibliothek erforderlich. Erfassungsmodul überträgt nur EAN an Open Food Facts. Vor Integration Nutzungsbedingungen, Attribution, Client-Kennung, CORS und Grenzen prüfen. Falls ein Browser die vorgeschriebene Kennung nicht setzen kann, kleinen fest auf Produktabfrage begrenzten Proxy evaluieren. Bibliothekswahl erst nach Wartungs-, Lizenz- und echten Gerätetests.

## Synchronisierung ohne private Löschereignisse

Supabase dokumentiert fehlende RLS-Prüfung für gelöschte Zeilen und Einschränkungen beim Filtern von DELETE. Darum nur die schmale Tabelle household_signals in die Realtime-Publikation aufnehmen. Weder Fachzeilen, Profile, Einladungen noch Quittungen veröffentlichen. Der Zähler enthält eine zufällige Haushalts-ID und Revision. Eigene SELECT-Policy wie im Sicherheitsvertrag. Bei erfolgreicher Änderung von Mitgliedschaft, Profilname, Bestand, Reservierung, Einkauf oder Warnfrist den Zähler im selben Commit erhöhen. Eine Fachlöschung wird für Mitmitglieder somit zu einer normalen Zähleraktualisierung. Bei Auflösung Signalzeile ruhen lassen, FK-freie UUID nie wieder vergeben. Auch breit abonnierte Kanäle mit fremden JWTs prüfen. [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

Ein Provider pro Sitzung und aktuellem Haushalt hält genau ein Abonnement für UPDATE mit Filter id=eq.<eigener Haushalt>. Erst abonnieren, nach SUBSCRIBED vollständigen autorisierten Snapshot laden. Bei jeder Revision laufende Aktualisierung als erneut fällig markieren, Bursts zusammenfassen. Lesen der Fachlisten bei Bedarf als einzelne Abfragen mit Zähler vor/nach dem Laden; bei unterschiedlicher Revision nochmals laden. Eigener Commit, Fokus, Reconnect, Wiederanmeldung des Kanals lösen ebenfalls Refetch aus. Bei sichtbarer App alle 30 Sekunden Mitgliedschaft und Revision prüfen, bei verpasster Änderung nachladen. Bei jedem Fokus sofort prüfen. Ziel unter stabiler Verbindung ≤3 Sekunden von Commit bis Anzeige, per Zweitgerät messen.

Jeder Login, Logout und Wechsel des Haushalts erhöht eine lokale Generation. In-flight-Abfragen abbrechen, Timer stoppen, Kanal entfernen und privaten Zustand leeren. Vor dem Setzen von React-State Generation, Nutzer-ID, Haushalt und neueste Anfragegeneration vergleichen. Ein verspäteter Logout-/Fetch-Callback darf kein fremdes Ergebnis anzeigen. Bei Mitgliedschaftsverlust sofort räumen, auch falls der entfernte Nutzer kein Signal mehr erhalten darf. Während Verbindungsunterbruch/fehlgeschlagener Aktualisierung letzten erfolgreichen Abgleich und «Stand veraltet» zeigen. Keine Offline-Schreibqueue, kein IndexedDB-Vorrat, keine privaten API-Antworten im Service Worker oder HTTP-Cache. Bestätigten Fehler und unklaren Timeout im UI unterscheiden.

## 007 · Transaktionsgrenze des Vorrats

Eine Charge ist die Versionseinheit für Bestand, Metadaten und alle zugehörigen Reservierungen. Unter READ COMMITTED sperrt `private.start_operation` zuerst das Konto, dann den eigenen Haushalt und prüft die aktuelle Generation. Die Mutation sperrt die Charge, liest die Reservierungen, prüft die Geschäftsregel und schreibt Änderung und Quittung im selben Commit. Austritt und Entfernung sperren alle betroffenen Chargen nach UUID, löschen die eigenen Reservierungen der austretenden Person und erhöhen die Chargenversionen vor der Entfernung der Mitgliedschaft. Bei 40001 oder 40P01 rollt die Mutation zurück und liefert RETRY.

Task 008 liest aktive Chargen über die Invoker-Sicht und verwendet die fünf Schreibfunktionen. Task 006 kann die vorhandenen Haushaltssignaturen unverändert aufrufen. Nach genehmigter Zusammenführung Dokumentationsänderungen beider Zweige erhalten, Typen aus dem gemeinsamen Schema regenerieren und Datenbank-, API-, Frontend- und Browserregressionen erneut ausführen. Prüfpunkte sind README, Status, Changelog, Testbericht, Nachweismatrix, Datenbanktypen und gemeinsam bearbeitete Entwicklerskripte. Paketdateien, CI und die gemeinsame Supabase-Konfiguration vor der Integration auf Änderungen des anderen Zweigs prüfen.
