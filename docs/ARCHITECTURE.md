# Architektur

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
