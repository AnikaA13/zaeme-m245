# Übergabe von 007.1 an Task 008

Der Branch `integration/m3-auth-inventory` verbindet die Haushaltsoberfläche mit der Vorratsdatenbank. Die Inventaroberfläche und die Navigation Start — Vorrat — Hinzufügen — Einkauf — Haushalt gehören zu 008.

## Schreiben

Die Oberfläche ruft `mutate(name, args)` aus `src/lib/operations/rpc.ts` auf. Die folgende Tabelle nennt die Argumente des Clients. Jeder Aufruf erhält intern zusätzlich `op uuid` und liefert `public.rpc_result`. `h` und `g` stammen aus dem Haushalt und der Mitgliedschaftsgeneration, unter denen der Benutzer die Eingabe bestätigt hat.

| RPC               | Clientargumente                                      | Geprüfte Erfolgsquittung                                                               |
| ----------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `create_item`     | `h, g, fields, ack`                                  | Neue Chargen-ID, Version 1                                                             |
| `edit_item`       | `h, g, id, fields, v, ack`                           | Dieselbe ID, Version v + 1                                                             |
| `set_reservation` | `h, g, id, desired, v`                               | Dieselbe ID und positive Version, bei unverändertem Zielwert bleibt die Version gleich |
| `consume_item`    | `h, g, id, amount, unit, confirm_full, confirmed_v?` | Dieselbe ID und positive Version                                                       |
| `delete_item`     | `h, g, id, v, confirm`                               | Dieselbe ID, Version NULL                                                              |

`fields.quantity`, `desired` und `amount` als exakte Dezimalstrings wie `"1.025"` übermitteln. `ack`, `confirm` und `confirm_full` sind JSON-Booleans. Absolute Änderungen binden `v` an die angezeigte Version. Beim Teilverbrauch `confirm_full: false` setzen und `confirmed_v` weglassen. Bei CONFIRM_FULL zuerst die Charge neu laden und den Vollverbrauch erneut zur Entscheidung vorlegen. Erst eine bewusste Zustimmung bindet Menge, Einheit und `confirmed_v` an den angezeigten Stand. DATE_ACK verlangt die Prüfung des Datums. INSUFFICIENT und RESERVED verlangen einen erneuten Blick auf verfügbare und reservierte Mengen. Der [RPC-Vertrag](RPC_SPEC.md) enthält die SQL-Signaturen, Feldsätze, Defaults und Grenzwerte.

## Offene Operationen und Sitzungswechsel

- Ein bewusster Submit startet eine Operation. Bis zur Quittung und Sitzungsnachprüfung sperrt der Client dieselbe Aktion auf derselben Charge. Andere Chargen bleiben bearbeitbar. Neue Anlagen teilen einen offenen Anlagevorgang pro Sitzung.
- Bei TRANSPORT bleibt der ursprüngliche Auftrag mit seiner UUIDv7 im RAM. Der Client liest den autorisierten Zustand erneut. Ein bewusst ausgelöster identischer Retry verwendet dieselbe UUID. Eine geänderte Eingabe liefert UNRESOLVED. Ein abgelaufener Schlüssel liefert OP_EXPIRED.
- Für die Entscheidung über einen offenen Auftrag liefert `await reviewPending(name, args)` die ursprüngliche ID in `op`, die aktuell gelesenen Zeilen in `items` und die Funktion `resolve()`. Bei einer Anlage enthält die Abfrage höchstens die ersten 100 Chargen. Das Fehlen einer Charge auf dieser Seite beweist keinen Fehlschlag. Bei Bedarf die vollständige Liste durchsuchen. Solange der Ausgang unklar bleibt, die ursprüngliche Eingabe behalten. Nach geklärtem Zustand und ausdrücklicher Entscheidung darf die UI `resolve()` aufrufen. Das schliesst genau diesen Auftrag lokal ab. Erst ein weiterer Submit sendet einen neuen Schreibauftrag.
- Nach einer gültigen Quittung die betroffene Liste oder Detailansicht aktualisieren. REFRESH_FAILED bedeutet, dass die Änderung quittiert wurde und der aktuelle Zustand erneut gelesen werden muss. Feldfehler, rohe SQL-Ausgaben und fehlende Antworten dürfen keinen Speichererfolg auslösen.
- Vor jedem eigenen asynchronen Lesevorgang `activeScope()` erfassen, dessen Signal an den Request binden und vor Anzeige, Navigation oder Meldung erneut prüfen. Kontowechsel, Logout und Mitgliedschaftswechsel verwerfen offene Aufträge. Bei Erstellung und Beitritt prüft der Client genau einen Übergang zum quittierten Haushalt. Bei Austritt und Auflösung prüft er den Übergang ins Onboarding. Epochengleichheit allein reicht für eine Haushaltsaktion nicht aus.

## Lesen

Mit dem angemeldeten Client `active_inventory` lesen. Die Sicht prüft die RLS-Rechte des Aufrufers auf Chargen und Reservierungen. Ihre Mengen entstehen pro Charge vor der Seitengrenze.

```ts
const columns =
  'id,household_id,name,quantity,unit,category,location,expiry_date,date_type,barcode,version,reserved_quantity,own_quantity,free_quantity,consumable_quantity';
let list = db.from('active_inventory').select(columns).eq('household_id', h);
if (lastId) list = list.gt('id', lastId);
if (pattern) list = list.ilike('name', pattern);
const page = await list.order('id').limit(100).abortSignal(scope.signal);
```

Für die Namenssuche ein ILIKE-Muster für den Suchbegriff als separaten Filterwert übergeben. Bei einem neuen Suchbegriff den Cursor leeren. Für die Folgeseite die letzte ID verwenden. Für das Detail dieselben Spalten mit `.eq('household_id', h).eq('id', id).maybeSingle()` lesen. Bei einer fehlenden aktiven Charge die Liste aktualisieren. Eine berechtigte Statusprüfung kann `inventory_items` lesen.

Personen mit Reservierung über `reservations.select('id,user_id,quantity').eq('household_id', h).eq('inventory_item_id', id).order('id').limit(100)` laden. Weitere Seiten mit `gt('id', lastId)` holen, Anzeigenamen für die gelesenen IDs über `profiles` auflösen. Die Chargenversion vor der ersten und nach der letzten abhängigen Abfrage vergleichen. Bei Versionswechsel alle Teilseiten verwerfen und neu laden. Bei Zugriffsverlust private Ergebnisse verwerfen. Für Summen verwendet die Oberfläche ausschliesslich die vier Mengenfelder der Sicht.
