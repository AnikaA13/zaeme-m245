# RPC-Verträge und Transaktionsgrenzen

## Implementierte Einkaufsschnittstelle 009A

Anlage und Bearbeitung akzeptieren `name`, `quantity` und `unit`. Beim Abhaken erzwingt der SQL-Parameter `checked jsonb` ein echtes JSON-Boolean vor jeder Umwandlung. Identische Zielwerte bei aktueller Version quittieren den bestehenden Stand. Die vier vollständigen Signaturen und die Typabbildung stehen im [Vertrag für 009B](TASK_009B_VERTRAG.md).

## Clientbindung ab 007.1

Die fünf implementierten Vorratssignaturen im Abschnitt 007 gelten unverändert. Der Client verwaltet die UUIDv7 pro Benutzerabsicht und Zielressource bis zu einer geklärten Antwort. Ein geänderter Auftrag kann eine ungeklärte ID erst nach ausdrücklicher Auflösung ersetzen. Die Quittung wird mit der Ziel-ID und dem Versionsvertrag verglichen. [Client-API, Zustandsabgleich und Wiederholung](TASK_008_VERTRAG.md)

## Verbindliche SQL-Signaturen für 005

Alle Funktionen liegen in `public` und liefern je einen `public.rpc_result`. PostgREST nimmt benannte JSON-Parameter entgegen. Pro Namen gibt es eine Signatur.

```sql
save_profile(op uuid, name text, v bigint, h uuid default null, g uuid default null)
create_household(op uuid, name text)
create_invite(op uuid, h uuid, g uuid, hash bytea)
list_invites(h uuid)
revoke_invite(op uuid, h uuid, g uuid, id uuid)
preview_invite(token text)
join_household(op uuid, token text)
leave_household(op uuid, h uuid, g uuid, confirm boolean)
remove_member(op uuid, h uuid, g uuid, target uuid, target_g uuid)
dissolve_household(op uuid, h uuid, g uuid, confirm boolean)
set_warning_days(op uuid, h uuid, g uuid, days jsonb, v bigint)
```

`h` und `g` stammen aus der aktuell gelesenen eigenen Mitgliedschaft. Bei einem Profil ohne Haushalt dürfen beide fehlen. Die Warnfrist nimmt eine JSON-Zahl entgegen. Typ, Ganzzahligkeit und Bereich werden vor der INTEGER-Konvertierung geprüft. Text, NULL und Bruchteile liefern INVALID. Den Einladungsdigest als bytea-Hexdarstellung im JSON-String senden. Vorschau und Einlösung verwenden POST und übermitteln das Token im Body.

Der SQL-Verbundtyp enthält `ok boolean, code text, id uuid, version bigint, expires_at timestamptz, household_name text, invites public.invite_metadata[], retry_after integer`. Unbenutzte Felder sind NULL. Einladungsmetadaten enthalten ausschliesslich ID, Erstellzeit, Verfall und Widerruf. Die Vorschau belegt nur ok und Haushaltsname. Austritt und Auflösung quittieren ausschliesslich den Abschluss, auch bei Wiederholung. RATE_LIMITED liefert ganze Wartesekunden. Fachfehler sind normale Ergebnisse. Falsch typisierte Transportparameter wie ungültige UUIDs kann PostgREST bereits vor Ausführung ablehnen.

Bei Anlage und Beitritt speichert die Quittung die neue Generation. Alte Generationen können nach Wiederbeitritt weder einen früheren Erfolg lesen noch eine bisher ungesendete Haushaltsänderung ausführen. SHA-256 bindet die kanonische serverseitige JSONB-Darstellung von RPC, Kontext und Nutzwerten. Das Token fliesst nur als Digest ein. Pro Bereinigung werden maximal 32 alte Zeilen je interner Tabelle mit SKIP LOCKED entfernt. Für 007 stehen `private.start_operation` und `private.finish` zur Verfügung. Die folgende Tabelle enthält fachliche Kurzformen und spätere Operationen.

Architekturvorschlag. Direktes Lesen gemäss [Zugriffsmatrix](SECURITY_SPEC.md). **Ein RPC-Aufruf ist eine Datenbanktransaktion.** Die folgenden Signaturen beschreiben API-Eingaben, keine Migration. Alle verlangen eine gültige auth.uid(). Kein Aufruf nimmt die handelnde user_id entgegen.

## Gemeinsame Parameter und Ergebnisse

Für `remove_member` bezieht sich `target_g` auf die beim Bestätigen sichtbare Mitgliedschaft der Zielperson. Ein nach deren Austritt und Wiederbeitritt erstmals zugestellter Auftrag trifft keine aktuelle Zeile und liefert NOT_FOUND. Die schreibenden Einstiegspunkte bilden SQLSTATE 40P01 und 40001 bei einem Abbruch innerhalb der Funktion auf RETRY ab. Ein Abbruch auf Transaktionsebene erfordert ebenfalls die Wiederholung mit derselben Absicht.

Jede Mutation erhält zusätzlich op uuid (UUIDv7, neu pro Benutzerabsicht). Alle Mutationen im bestehenden Haushalt erhalten zusätzlich h uuid als erwarteten Kontext. IDs sind uuid, v ist expected_version bigint, confirm und ack sind boolean ohne implizite Bestätigung. Pflichtfelder dürfen nicht NULL sein. Rollen M/O bedeuten aktuelles Mitglied inklusive Owner bzw. ausschliesslich Owner. Akteur, Zeitstempel, Versionszähler, Rollen und Status werden serverseitig gesetzt. Rückgabe als typisiertes Ergebnis mit ok und minimaler Quittung (id, gegebenenfalls version) oder stabilem Fehlercode. Detaildaten nach Erfolg neu laden.

| RPC und fachliche Eingaben                        | Recht, Prüfung und Wirkung                                                                                                                                 | Erfolg / Konflikt                             | Anforderung und geplanter Nachweis   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| save_profile(name text,v)                         | Eigenes Konto, initial v=0, sonst Vergleich. Namen trimmen, 1–100. Änderung im Haushalt löst Signal aus.                                                   | Profil-ID, Version / STALE                    | F01/F02, Erstanlage, parallele Namen |
| create_household(name text)                       | Profil ohne Haushalt, gültiger Name. Haushalt und erste Mitgliedschaft mit eigenem owner_id anlegen.                                                       | Haushalts-ID / ALREADY_MEMBER                 | F02, TT01, Doppelanlage              |
| create_invite(hash bytea)                         | O, genau 32 Bytes, einmaligen Hash und 7 Tage Laufzeit setzen                                                                                              | ID, Ablauf / HASH_EXISTS                      | F02, Owner gegen Mitglied            |
| list_invites(h uuid)                              | O, nur lesen, aktuelle Mitgliedschaft prüfen                                                                                                               | Liste der Metadaten gemäss Sicherheitsvertrag | F02, TT02                            |
| revoke_invite(id)                                 | O, Einladung in h, widerrufenes Token bleibt widerrufen                                                                                                    | ID / NOT_FOUND                                | F02, Join gegen Widerruf             |
| preview_invite(token text)                        | Konto ohne Mitgliedschaft, Prüfungen und Budget gemäss Sicherheitsvertrag. Kein op, nur Budget schreiben.                                                  | Haushaltsname / INVITE_INVALID                | F02, Ablauf und Informationsschutz   |
| join_household(token text)                        | Profil ohne Haushalt. Kontext aus Hash ermitteln, nach Sperre erneut prüfen. Beitritt atomar.                                                              | Haushalts-ID / ALREADY_MEMBER, INVITE_INVALID | F02, TT01/02, zwei Zielhaushalte     |
| leave_household(confirm)                          | M ohne Eigentümerschaft, bestätigt. Eigene Reservierungen und Mitgliedschaft gemeinsam entfernen.                                                          | ID / OWNER_BOUND                              | F02/F17, TT12/16                     |
| remove_member(target uuid)                        | O, fremdes Mitglied desselben Haushalts. Keine Selbstentfernung. Freigabe wie beim Austritt.                                                               | Ziel-ID / NOT_FOUND                           | F02/F17, TT02/12/16                  |
| dissolve_household(confirm)                       | O, explizite separate Bestätigung, genau eine Mitgliedschaft unter Sperre zählen. Haushalt löschen.                                                        | ID / OWNER_BOUND                              | F02, paralleler Beitritt             |
| set_warning_days(days numeric,v)                  | O, nur ganze 0–30, Vergleich mit Haushaltsversion.                                                                                                         | ID, Version / STALE                           | F19, TT07/19                         |
| create_item(fields jsonb,ack)                     | M, vollständige Charge, Defaults und Regeln gemäss Datenmodell, keine Fremdfelder                                                                          | Chargen-ID, Version / INVALID                 | F03/F05/F10, TT03/06/17              |
| edit_item(id,fields jsonb,v,ack)                  | M, nur aktive Charge, vollständiger editierbarer Feldsatz. Menge ≥ reservierte Summe. Kategorie-/Einheitenwechsel erst nach Freigabe aller Reservierungen. | ID, Version / STALE, RESERVED                 | F03/F07/F10/F17, TT06/17             |
| consume_item(id,amount text,confirm_full boolean) | M, positiver exakter Betrag in bekannter Einheit. Siehe Mengentransaktion.                                                                                 | ID, Version / INSUFFICIENT, CONFIRM_FULL      | F07/F17, TT04/11/13/14               |
| delete_item(id,v,confirm)                         | M, aktive fehlerhafte Charge, bestätigt, keine Reservierung, Version prüfen                                                                                | ID / RESERVED, STALE                          | F07, TT11/13                         |
| set_reservation(id,desired text,v)                | M, absolute eigene Menge in aktueller Einheit, 0 gibt frei, keine Auswahl eines Mitglieds. Version prüfen, gewünschte Menge ≤ Bestand minus fremde Summe.  | Chargen-ID, Version / STALE, INSUFFICIENT     | F17, TT13–17                         |
| create_shopping(fields jsonb)                     | M, Name und optional zusammen Menge/Einheit, startet offen. Vorbelegung eines Namens aus Vorrat benutzt denselben Aufruf.                                  | ID, Version / INVALID                         | F09/F10, TT09                        |
| edit_shopping(id,fields jsonb,v)                  | M, Name und Mengenpaar ersetzen, Version prüfen                                                                                                            | ID, Version / STALE                           | F09, TT09/17                         |
| check_shopping(id,checked boolean,v)              | M, expliziten Zielwert setzen, Version prüfen. Keine Bestandsmutation.                                                                                     | ID, Version / STALE                           | F09, TT09                            |
| delete_shopping(id,v)                             | M, Version prüfen und Eintrag entfernen                                                                                                                    | ID / STALE                                    | F09, TT09/17                         |

Chargenfelder sind name, quantity (Dezimaltext), unit, category, location, expiry_date (ISO-Kalenderdatum), date_type und barcode. Bei Anlage gelten dokumentierte Defaults für fehlende Felder, bei Änderung müssen auch optionale Felder explizit als Wert oder NULL vorliegen. Einkaufsfelder sind name, quantity und unit. Unbekannte Felder ablehnen. ack gehört zur konkreten Datumseingabe. Für Verbrauch zusätzlich die beim Öffnen gelesene Einheit als Parameter unit text übermitteln und unter Sperre vergleichen (STALE). Auch bei früherer Bestätigung darf eine Änderung der Einheit nie die Bedeutung des Betrags ändern.

## Sperrordnung

READ COMMITTED mit kurzen Transaktionen. Pro Mutation zuerst Transaktions-Advisory-Lock für den handelnden Account (stabiler Hash der UUID, Kollision serialisiert nur). Danach höchstens eine Haushaltszeile FOR UPDATE, dann bei Bedarf Einladung, betroffene Chargen nach UUID aufsteigend, danach abhängige Reservierungen, Mitgliedschaften und Quittungs-/Signaländerung. Eine ermittelte ID vor der Sperre ist nur ein Suchhinweis. Nach dem Warten in einer neuen Anweisung Mitgliedschaft, Eigentümer, Ressourcenbezug und Fachdaten erneut lesen. Es gibt keinen nachträglichen Akteur-Lock für die zu entfernende Person. Bei Profilerstellung ohne Haushalt genügt die Akteursperre. Beim Beitritt Budget unter Akteursperre bearbeiten. Bei bereits gelöschtem Haushalt abbrechen. Lesende Einladungsübersicht braucht keine Schreibsperre, ein einzelner autorisierter SELECT genügt.

Alle Schreibwege einschliesslich Beitritt, Freigabe, Löschen, Profile und Einkauf folgen derselben Ordnung. Die Serialisierung je Haushalt ist bei der Zielgrösse vertretbar. Bei Entfernung zuerst alle betroffenen Chargen sperren, Reservierungen löschen und deren Chargenversionen erhöhen, dann Mitgliedschaft entfernen. Auflösung folgt derselben Ordnung. Keine Netzaufrufe in Transaktionen. Deadlock/Serialisierungsabbruch (40P01/40001) vollständig zurückrollen, begrenzt mit derselben op nach kurzem Jitter erneut versuchen. Datenbank-Constraints bleiben zusätzliche Schranken. [PostgreSQL zu expliziten Sperren](https://www.postgresql.org/docs/current/explicit-locking.html)

Unter Chargensperre Gesamtmenge Q, eigene Reservierung E und fremde Summe F lesen. Verbrauch a ist zulässig bei 0 < a ≤ Q−F. Bei a=Q muss confirm_full ausdrücklich wahr sein. Eigene Reservierung um min(E,a) abbauen, leere Zeile löschen, Q um a senken, bei 0 status=consumed. Alle Schritte einschliesslich Versionszähler und Quittung committen gemeinsam. Kein erwartetes v beim additiven Verbrauch. Wird ein Teilverbrauch durch eine Parallelaktion zum Vollverbrauch, verlangt der Server ohne explizite Bestätigung zuerst eine neue Entscheidung.

## Wiederholung nach unklarem Ausgang

Server akzeptiert op mit UUIDv7-Zeit im Fenster letzte 24 Stunden bis höchstens 5 Minuten in der Zukunft. Abgelaufene Schlüssel immer mit OP_EXPIRED ablehnen, auch wenn kein Eintrag mehr vorhanden ist. Quittungen nach mindestens 48 Stunden löschen (indexierter, begrenzter Cleanup bei regulären Mutationen oder täglicher DB-Auftrag). Kein unbefristetes Wachstum bei laufender Nutzung. Client hält denselben Schlüssel und unveränderte Eingaben während der offenen Aktion im RAM. Bei Timeout zuerst neu laden. Bei verlorenem Schlüssel oder abgelaufenem Fenster nur nach Abgleich und neuer bewusster Eingabe handeln.

Nach Akteursperre Quittung auf (user_id,op) prüfen. SHA-256 über kanonische strukturierte Darstellung mit RPC-Name, Kontext, Ziel, normalisierten Nutzwerten, Version und Bestätigungen. Token nur als Digest einbeziehen. Gleiche op mit anderer Operation/anderen Daten ergibt OP_MISMATCH. Bei Übereinstimmung **vor** Prüfung einer inzwischen veralteten Fachversion die gespeicherte Quittung zurückgeben. Zuerst aktuelle Leseberechtigung prüfen (bei Owner-Aktionen Owner prüfen). Für create/join muss das Konto noch im entstandenen Haushalt sein. Bei erfolgreichem leave/dissolve nur die eigene inhaltslose Abschlussbestätigung wiederholen, auch ohne Mitgliedschaft. Ein entfernter Nutzer kann mit alter Quittung keine Fachdaten lesen. Erfolg und Quittung im gleichen Commit, bei Fehler keine Fachmutation. Rate-Limit-Budget ist die ausdrücklich separat zu persistierende Fehlerwirkung. create_invite reproduziert ID und Ablauf, das Zufallsgeheimnis liegt beim Ersteller nur während des Vorgangs im RAM.

## Parallelfälle als Abnahmevertrag

| Gleichzeitige Absichten                                                | Gültiger Ausgang                                                                                                    | Ausgeschlossen                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Zwei Mitglieder verbrauchen je 1 von 2 freien Stück                    | Erster Commit ergibt 1. Zweiter bestätigter Verbrauch ergibt 0. Ohne Vollbestätigung bleibt 1 bis zur Bestätigung.  | Negativbestand, verlorener Abzug, unbestätigter Vollverbrauch |
| A und B reservieren je 2 von 3                                         | Genau einer bei gültigen Ausgangsversionen, anderer STALE bzw. nach Neuladen INSUFFICIENT                           | Summe 4                                                       |
| A hat 2 von 5, verbraucht 3, F=1                                       | Q=2, E=0, F=1                                                                                                       | Freien Bestand zuerst belasten                                |
| A hält 2 von 3, B verbraucht 2                                         | INSUFFICIENT, B darf 1 verbrauchen                                                                                  | Fremdverbrauch trotz Bestätigung oder Owner-Rolle             |
| Entfernung parallel zu eigener Reservierung                            | Reservierung zuerst und dann im Entfernungscommit freigegeben, oder zuerst Entfernung und danach Zugriff verweigert | Verwaiste/neue Reservierung nach Entfernung                   |
| Bearbeitung mit v=4, inzwischen v=5                                    | STALE, aktuelle Werte neu laden und Änderung bewusst erneut erfassen                                                | Überschreiben von v=5                                         |
| Verbrauch committen, HTTP-Antwort verlieren, identische op wiederholen | Dieselbe Quittung, ein Abzug. Geänderter Betrag ergibt OP_MISMATCH                                                  | Zweite Abbuchung                                              |

## Fehlertexte

| Code                                        | Meldung bzw. Reaktion                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AUTH_REQUIRED / FORBIDDEN                   | «Bitte melde dich an.» / «Dir fehlt die Berechtigung.» Haushaltszugang neu prüfen.                                                                     |
| NOT_FOUND                                   | «Dieser Eintrag ist nicht verfügbar.» Gleicher Fehler für fremde und unbekannte Objekt-ID.                                                             |
| INVALID / DATE_ACK                          | «Bitte überprüfe deine Eingabe.» Mit Feldschlüssel konkretisieren. / «Liegt dieses Datum wirklich mehr als fünf Jahre in der Zukunft?»                 |
| STALE / INSUFFICIENT / RESERVED             | «Der Eintrag wurde geändert.» / «Die verfügbare Menge reicht nicht.» / «Gib zuerst die betroffenen Reservierungen frei.» Nur eigene Freigabe anbieten. |
| CONFIRM_FULL / CONFIRM_REQUIRED             | «Gesamte Menge verbrauchen?» / «Bitte bestätige diesen Vorgang.»                                                                                       |
| OWNER_BOUND / ALREADY_MEMBER                | «Der Haushalt kann so nicht verlassen oder aufgelöst werden.» / «Du gehörst bereits zu einem Haushalt.»                                                |
| INVITE_INVALID / RATE_LIMITED / HASH_EXISTS | «Diese Einladung ist ungültig oder abgelaufen.» / «Bitte versuche es später erneut.» / Neuen Einladungsschlüssel erzeugen.                             |
| OP_MISMATCH / OP_EXPIRED / RETRY            | «Diese Anfrage passt nicht zur ursprünglichen Aktion.» / «Bitte prüfe den aktuellen Stand.» / «Bitte versuche es erneut.»                              |

## Implementierter Vertrag für 007

Alle fünf Einstiege liegen in `public` und liefern genau einen `public.rpc_result`. Voraussetzung sind bestätigte Anmeldung, aktueller Haushalt `h` und dessen eigene Mitgliedschaftsgeneration `g`. Pro Benutzerabsicht eine UUIDv7 `op` erzeugen. PostgREST erhält benannte JSON-Felder.

Im generierten TypeScript entsprechen die Rückgaben `Database['public']['CompositeTypes']['rpc_result']`. Auf `ok === true` prüfen. Die API kann Fachfehler mit HTTP 200 transportieren. Für aktive Chargen gilt `Database['public']['Views']['active_inventory']['Row']`. Der Generator markiert berechnete Mengen als nullable. Ohne Reservierungen liefert die SQL-Sicht 0 für die reservierten Mengen.

```sql
create_item(op uuid, h uuid, g uuid, fields jsonb, ack jsonb)
edit_item(op uuid, h uuid, g uuid, id uuid, fields jsonb, v bigint, ack jsonb)
set_reservation(op uuid, h uuid, g uuid, id uuid, desired jsonb, v bigint)
consume_item(op uuid, h uuid, g uuid, id uuid, amount jsonb, unit text,
             confirm_full jsonb, confirmed_v bigint default null)
delete_item(op uuid, h uuid, g uuid, id uuid, v bigint, confirm jsonb)
```

**Typen am HTTP-Rand.** UUIDs sind Strings. `amount`, `desired` und `fields.quantity` sind Dezimalstrings mit ASCII-Ziffern, optional Punkt und ein bis drei Nachkommastellen. Kein Vorzeichen, Exponent, Komma oder Leerraum. Maximal 9999, Zähleinheiten mathematisch ganzzahlig. Führende Nullen und zulässige nachgestellte Nullen werden für die Quittung entfernt. `"01.500"` und `"1.5"` bezeichnen dieselbe Menge. Auch eine vierte Null nach dem Punkt ist ungültig. `ack`, `confirm` und `confirm_full` sind echte JSON-Booleans. SQL-`jsonb` erhält den JSON-Typ bis zur Prüfung. Die generierten `Json`-Argumente sind entsprechend breiter als der fachliche Vertrag. Ungültige UUIDs und unpassende RPC-Argumentnamen können bereits einen HTTP-Transportfehler ergeben.

```ts
type Context = { op: string; h: string; g: string };
type Fields = {
  name: string;
  quantity: string;
  unit: 'Stück' | 'Packung' | 'kg' | 'Liter';
  category:
    | 'Früchte/Gemüse'
    | 'Fleisch/Fisch'
    | 'Brot/Backwaren'
    | 'Trockenwaren'
    | 'Getränke'
    | 'Milchprodukte'
    | 'Sonstiges';
  location:
    'Kühlschrank' | 'Gefrierfach' | 'Vorratsschrank' | 'Sonstiges' | null;
  expiry_date: string | null;
  date_type: 'MHD' | 'Verbrauchsdatum' | 'unbekannt' | null;
  barcode: string | null;
};
type Create = Context & {
  fields: Pick<Fields, 'name'> & Partial<Omit<Fields, 'name'>>;
  ack: boolean;
};
type Edit = Context & { id: string; fields: Fields; v: number; ack: boolean };
type Reserve = Context & { id: string; desired: string; v: number };
type Consume = Context & {
  id: string;
  amount: string;
  unit: Fields['unit'];
} & (
    | { confirm_full: false; confirmed_v?: never }
    | { confirm_full: true; confirmed_v: number }
  );
type Delete = Context & { id: string; v: number; confirm: boolean };
```

| Einstieg                      | Wirkung und Rückgabe                                                                                                                                                                                                            | Fachkonflikte                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `create_item` · F03/F05/F10   | Pflichtname trimmen, fehlende Felder gemäss Datenmodell ergänzen, separate Charge anlegen. Quittung mit ID und Version 1.                                                                                                       | INVALID, DATE_ACK                          |
| `edit_item` · F03/F07/F10/F17 | Alle acht editierbaren Felder einschliesslich NULL übermitteln. Unter Sperre Version und Reservierungen prüfen. Jede erfolgreiche Bearbeitung erhöht die Version.                                                               | INVALID, DATE_ACK, STALE, RESERVED         |
| `set_reservation` · F17       | Eigene absolute Menge auf höchstens Bestand minus fremde Summe setzen. Null löscht die eigene Zeile. Ein bereits erfüllter Zielwert, auch Freigabe ohne Zeile, quittiert die aktuelle Version ohne Änderung.                    | INVALID, STALE, INSUFFICIENT               |
| `consume_item` · F07/F17      | Teilverbrauch additiv in angezeigter Einheit. Eigene Reservierung zuerst abbauen. Beim Vollverbrauch muss die bestätigte Menge dem Gesamtbestand und `confirmed_v` der aktuellen Version entsprechen. Neue Version zurückgeben. | INVALID, STALE, INSUFFICIENT, CONFIRM_FULL |
| `delete_item` · F07           | Aktive, unreservierte Charge bei passender Version nach Bestätigung löschen. Quittung mit ID, ohne Version.                                                                                                                     | INVALID, CONFIRM_REQUIRED, STALE, RESERVED |

Ein Bestätigungsdialog bindet `id`, `unit`, `amount` und `confirmed_v` an den gezeigten Zustand. Ändert sich dieser Zustand, muss die UI neu laden und erneut fragen. Bei einem gewöhnlichen Teilverbrauch `confirmed_v` weglassen. Falls dieser inzwischen den Vorrat leeren würde, antwortet die Datenbank mit CONFIRM_FULL und lässt den Bestand unverändert. Eine erfolgreiche Wiederholung mit identischen Parametern liefert die gespeicherte Quittung.

Alle Mutationen verwenden die bestehende Konto- und Haushaltssperre, danach die Chargensperre. Berechtigung und Generation werden unter der Haushaltssperre erneut gelesen. Fehler liefern `ok=false` und `code`, Erfolg liefert `ok=true`, `code=null`, `id` und gegebenenfalls `version`. Die übrigen Felder des bestehenden Ergebnistyps sind NULL. Gemeinsame Fehler sind AUTH_REQUIRED, FORBIDDEN, INVALID, OP_MISMATCH, OP_EXPIRED und RETRY. Eine unbekannte oder fremde Charge liefert im berechtigten Kontext NOT_FOUND. Bei fachlichem Konflikt die angezeigten Daten neu laden. Die bestehende Zeitgrenze und Bereinigung der Quittungen gelten auch für 007.

Ein neues oder geändertes Datum wird als echtes ISO-Kalenderdatum gegen den aktuellen Tag in Europe/Zurich geprüft. Bis einschliesslich fünf Kalenderjahre ist keine Rückfrage nötig, bis einschliesslich zwanzig Jahre ist darüber `ack=true` erforderlich. Die Datenbank begrenzt beim Addieren von Jahren den Schalttag auf das Monatsende. Ein unverändertes Datum erfordert keine zweite Bestätigung. Der Fingerabdruck enthält Datum und Bestätigung.
