# Task 009B · Einkauf, Warnfrist und Synchronisation

## Lesen und Blättern

Den aktuellen Benutzer, die eigene Mitgliedschaft `{ household_id: h, generation: g }` und den flüchtigen Sitzungskontext vor jeder Aktion erfassen. Die bestätigte Auth-Sitzung und der öffentliche Projektschlüssel genügen. RLS ermittelt den Haushalt aus der aktuellen Mitgliedschaft. Eine entfernte Person kann ihre Zugehörigkeit über eine leere Antwort auf die eigene Mitgliedschaftsabfrage erkennen.

`shopping_items` liefert `id,household_id,name,quantity,unit,checked,version,created_at,updated_at`. IDs sind UUIDs, Mengen PostgreSQL-`numeric`, Versionsnummern positive `bigint` und Zeitstempel `timestamptz`. Die SDK-Zeilentypen verwenden für Mengen und Versionen JavaScript-`number`. Vor Wiederverwendung als Versionsparameter eine positive sichere Ganzzahl verlangen. Bei Überschreitung die Schreibaktion sperren. Bei Einrichtung mit nativen JSON-Zahlentypen dieselbe Grenze für den Revisionsvergleich beachten, bei Bedarf die Revision als Text abfragen und mit `BigInt` vergleichen.

Für offen und erledigt je eine Abfrage auf `shopping_items` mit obiger Spaltenliste, `.eq('household_id', h).eq('checked', checked).order('id').limit(100)`. Ab der zweiten Seite `.gt('id', letzteId)` ergänzen. Beim Filter- oder Kontextwechsel den Cursor löschen. Detail mit Haushalts- und ID-Filter und `.maybeSingle()` lesen. Bei Signalwechsel während einer mehrseitigen Abfrage beide Listen neu aufbauen.

## Schreibvertrag

Alle vier Funktionen im Schema `public` liefern einen einzelnen `public.rpc_result`. Benannte PostgREST-Argumente verwenden. In den generierten Typen sind UUIDs `string`, JSONB-Argumente `Json` und `bigint`-Parameter `number`. Alle hier aufgeführten Argumente sind erforderlich.

| RPC               | SQL-Argumente in Deklarationsreihenfolge                    | Erfolgsquittung         |
| ----------------- | ----------------------------------------------------------- | ----------------------- |
| `create_shopping` | `op uuid, h uuid, g uuid, fields jsonb`                     | Neue ID, Version 1      |
| `edit_shopping`   | `op uuid, h uuid, g uuid, id uuid, fields jsonb, v bigint`  | ID und aktuelle Version |
| `check_shopping`  | `op uuid, h uuid, g uuid, id uuid, checked jsonb, v bigint` | ID und aktuelle Version |
| `delete_shopping` | `op uuid, h uuid, g uuid, id uuid, v bigint`                | ID und Version NULL     |

Die generierten `Args` aus [database.types.ts](../src/database.types.ts) lauten:

```ts
type CreateShopping = { fields: Json; g: string; h: string; op: string };
type EditShopping = {
  fields: Json;
  g: string;
  h: string;
  id: string;
  op: string;
  v: number;
};
type CheckShopping = {
  checked: Json;
  g: string;
  h: string;
  id: string;
  op: string;
  v: number;
};
type DeleteShopping = {
  g: string;
  h: string;
  id: string;
  op: string;
  v: number;
};
type Receipt = Database['public']['CompositeTypes']['rpc_result'];
```

`fields` enthält `name` und ausschliesslich das optionale Paar `quantity` und `unit`. Bei Anlage dürfen die optionalen Werte fehlen. Bei Bearbeitung alle drei Schlüssel senden. Beide optionalen Felder mit NULL leeren. Namen nach kanonischer Leerraumbehandlung auf 1–100 Unicode-Codepunkte prüfen. Gleichnamige Wünsche erhalten eigene IDs. Eine Namensvorbelegung aus dem Vorrat benutzt denselben Anlage-RPC.

Mengen als positive Dezimalstrings mit Punkt bis 9999 senden, z. B. `"0.125"`. Komma in der Eingabe vor dem Senden normalisieren. Höchstens drei Nachkommastellen, für Stück und Packung ist ein ganzzahliger Wert erforderlich. Weitere Einheiten sind kg und Liter.

`checked` akzeptiert nur die JSON-Booleans `true` und `false`. Ein neuer Wunsch startet offen. Abhaken und Wiederöffnen wirken ausschliesslich auf den Wunsch. Bei bestehendem Zielzustand und passender Version bleiben Version und Signal gleich. Dasselbe gilt beim Speichern identischer Einkaufsfelder. Eine veraltete Version liefert auch bei gleichem Zielzustand STALE. Löschen verlangt die beim Bestätigen sichtbare Version. Gleiche UUIDv7 und kanonische Eingaben liefern dieselbe Quittung im gültigen Kontext. OP_MISMATCH bezeichnet eine wiederverwendete ID mit anderem Auftrag.

Den bestehenden Operationsclient aus Task 008 für diese vier Aktionen erweitern. UUIDv7 pro Absicht, Ziel und Sitzung im RAM halten. Bei unklarer Antwort dieselben Eingaben und dieselbe ID wiederholen. Bei RETRY begrenzt mit Jitter wiederholen. OP_EXPIRED, STALE, NOT_FOUND oder FORBIDDEN verlangen erneutes autorisiertes Lesen und gegebenenfalls eine neue bewusste Entscheidung. INVALID bezeichnet einen ungültigen Feldsatz. Beim Aufruf und nach Quittung, Mitgliedschaftsprüfung und Refetch dieselbe Benutzer-ID, Sitzung, Haushalts-ID und Mitgliedschaftsgeneration verlangen. Eine erfolgreiche Quittung gefolgt von einem Lesefehler bedeutet «gespeichert, Stand noch nicht aktualisiert». Weitere Details stehen im [Vertrag für Task 008](TASK_008_VERTRAG.md).

## Warnfrist

`set_warning_days(op uuid,h uuid,g uuid,days jsonb,v bigint)` erwartet eine JSON-Zahl mit ganzzahligem Wert von 0 bis 30. Vorgabe 3. Ausschliesslich die Eigentümerin oder der Eigentümer darf speichern. Als `v` die gelesene **Haushaltsversion** verwenden. Erfolg quittiert Haushalts-ID und neue Haushaltsversion. Die aktualisierte Frist und die abhängigen Ablaufansichten erneut lesen. Der bestehende RPC erhöht auch beim erneuten Speichern desselben Werts mit neuer Absicht die Haushaltsversion.

## Abonnieren und nachladen

Eine Signalzeile enthält ausschliesslich `id uuid PRIMARY KEY` und `revision bigint NOT NULL`. Bei Auflösung bleibt die ID reserviert. Die Revision dient der Invalidierung. Mehrere Änderungen in einer Transaktion können mehrere Revisionen erzeugen. Eine Zahlendifferenz gibt keine verlässliche Auskunft über die Anzahl Benutzeraktionen.

Beispiel für den bestehenden angemeldeten Supabase-JS-Client 2.119.2. Die Callback-Funktionen gehören zur Implementierung von 009B.

```ts
await db.realtime.setAuth(session.access_token);
if (!aktuellerKontext()) return;
const channel = db
  .channel(`haushalt-${h}-${g}`, {
    config: { postgres_changes_options: { wait: true } },
  })
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'household_signals',
      filter: `id=eq.${h}`,
    },
    () => {
      if (aktuellerKontext()) vormerken();
    },
  )
  .subscribe((status) => {
    if (!aktuellerKontext()) return;
    if (status === 'SUBSCRIBED') vormerken();
    else if (['CLOSED', 'TIMED_OUT', 'CHANNEL_ERROR'].includes(status))
      standVeraltet();
  });
```

1. Zuerst das Abonnement mit `postgres_changes_options.wait` einrichten. Damit wartet die Kanalbestätigung auf die Registrierung bei PostgreSQL. Bei jedem SUBSCRIBED, einschliesslich Reconnect, die eigene Mitgliedschaft und die aktuelle Signalrevision abrufen. Die seit Anmeldung vorgemerkten Ereignisse behalten. Bei langsamer Verbindung darf die UI bereits autorisierte Daten laden und den Synchronisationsstatus anzeigen.
2. Vor dem Lesen der Fachseiten die Revision lesen, nach dem letzten Teilresultat erneut lesen. Nur ein vollständiges Ergebnis derselben Generation und Revision anzeigen. Bei abweichender Revision oder zwischenzeitlichem Ereignis einen weiteren Durchlauf einplanen. Während eines laufenden Abrufs reicht eine einzige Vormerkung. Ereignisse kurz bündeln, ohne die Aktualisierung bei kontinuierlichen Änderungen unbegrenzt aufzuschieben.
3. Nach bestätigter Mutation, Fokus, Netzrückkehr und Wiederverbindung immer autorisiert neu lesen. Verpasste Ereignisse werden über den aktuellen Datenstand aufgeholt. Bei unterbrochenem Kanal letzten erfolgreichen Abgleich anzeigen und mit begrenztem Backoff neu verbinden. Auch während ruhiger Sitzungen die Mitgliedschaft periodisch neu prüfen, weil ein entfernter Client kein weiteres Haushaltssignal erhalten darf.
4. Bei Logout, Kontowechsel, Austritt, Auflösung oder neuer Mitgliedschaft zuerst die lokale Generation ungültig machen. Requests abbrechen, Timer und Vormerkungen entfernen, privaten Zustand leeren und `await db.removeChannel(channel)` ausführen. Veraltete Callbacks anhand Sitzung, Benutzer, Haushalt, Mitgliedschaftsgeneration und Abfragegeneration verwerfen. Den neuen Kanal erst an den bestätigten neuen Kontext binden. Der angemeldete SDK-Client aktualisiert sein Realtime-Token bei Sitzungsrefresh. Bei erneutem Beitritt darf auch ein noch gültiges JWT desselben Kontos wieder lesen. Schreibaufträge mit der früheren Mitgliedschaftsgeneration bleiben gesperrt. Deshalb frühere Kanäle und offene Aufträge beim Kontextwechsel räumen.

## Nachweise und offene Abnahme

Die lokalen Messwerte, Abnahmegrenzen und Sicherheitsprüfungen stehen im [Testbericht](TEST_REPORT.md). Task 009B prüft die sichtbare Änderung auf zwei Geräten innerhalb von drei Sekunden einschliesslich autorisiertem Refetch, die Bereinigung privater Ansichten bei Kontextverlust, Einkauf und Warnfrist im Browser sowie die Abnahme gegen den späteren Hosted-Stack. F04 bleibt bis zu dieser Prüfung offen.
