# Vorratsoberfläche und Anschluss für 009–011

**Anschlussstand 010B.** Die zentrale Aktion öffnet jetzt die Auswahl unter `/capture`, der Scanner liegt unter `/capture/scan`. Die folgende Tabelle dokumentiert den Stand von 008. Das manuelle Formular und sein Eingabevertrag gelten weiter. [Scannervertrag](TASK_010B_VERTRAG.md)

## Wege durch die App

Ein bestätigtes Konto mit Profil und aktueller Mitgliedschaft erreicht die Startseite unter `/`. Die drei dringendsten datierten Chargen führen ins Detail. Der Link zu allen Hinweisen öffnet `/inventory?ablauf`. `/inventory` sucht Produktnamen inklusive Sonderzeichen als wörtlichen Text im vollständig geladenen Vorrat. Die Liste blendet zunächst 30 Treffer ein. Gleiche Namen bleiben getrennte Chargen. Beim Zurückkehren bleiben Suchbegriff, Filter und Scrollposition innerhalb des Mitgliedschaftskontexts im RAM.

| Ziel       | Weg                                | Aktion                                        |
| ---------- | ---------------------------------- | --------------------------------------------- |
| Start      | `/`                                | Ablaufhinweise, Vorrat und manuelle Erfassung |
| Vorrat     | `/inventory`                       | Alle Chargen oder Ablaufhinweise              |
| Hinzufügen | `/capture/manual`, auch `/capture` | Editierbares Formular öffnen                  |
| Einkauf    | `/shopping`                        | Hinweis zur ausstehenden Einkaufsliste        |
| Haushalt   | `/household`                       | Bestehende Haushaltsverwaltung                |

`/inventory/:id` zeigt den Gesamtbestand, den reservierten Anteil, die eigene Reservierung, den freien und den persönlich verfügbaren Bestand. Die Unterwege `edit`, `consume` und `reserve` führen ins passende Formular. Verbrauchen oder das Entfernen nach überschrittenem Verbrauchsdatum ist die primäre Detailaktion. Die Löschbestätigung für einen fehlerhaften Eintrag ist im Bearbeitungsformular untergebracht.

## Lesen und Aktualisieren

`src/features/inventory/read.ts` bindet alle Requests an das erfasste JWT, die Haushalt-ID und das Abbruchsignal. Die Anzeige setzt denselben Benutzer, Haushalt, dieselbe Generation und dasselbe gültige Signal voraus. `readInventory` liest die Sicht `active_inventory` mit exklusivem ID-Cursor in Seiten zu 100. Sortierung und Filterung folgen nach dem letzten Blatt. Datierte Chargen werden nach Datum, Name und ID geordnet, undatierte zuletzt. Die vier Mengenaggregate stammen direkt aus der Sicht.

`readOwners` bündelt sichtbare reservierte Chargen in Gruppen von höchstens 40 IDs. Es liest alle Reservierungsseiten, löst autorisierte Anzeigenamen gruppenweise auf und vergleicht anschliessend die Chargenversionen. Bei einem Konflikt verwirft die Oberfläche abhängige Ergebnisse und lädt neu. Wiederholte Konflikte und Ladefehler führen zu einem gekennzeichneten Zustand mit Wiederholung. Der Detailabruf prüft vor und nach den abhängigen Reads dieselbe einzelne Charge.

`useResource` besitzt das aktuelle Leseergebnis im React-Zustand der geöffneten Ansicht. Eintritt, Fokus, Wiederverbindung und explizite Aktualisierung lösen Reads aus. Eine überholte Antwort darf den aktuellen Zustand nicht ersetzen. `invalidateInventory()` aus `resource.ts` invalidiert die montierten Vorratsansichten nach einer Mutation. Task 009 kann nach einem autorisierten Haushaltssignal dieselbe Funktion aufrufen. Ein Wechsel von `home.warning_days` aktualisiert die Klassifizierung beim Rendern. Einkauf erhält den vorhandenen vierten Navigationseintrag. Eine echte Aktion «Auf Einkaufsliste setzen» gehört in die sekundären Aktionen von `Detail`.

## Schreiben und Konflikte

`writes.tsx` koordiniert Benutzerabsichten je RPC und Charge. Alle fünf Mutationen verwenden `mutate` und dessen Quittungsprüfung. Das Formular übergibt Haushalt und Generation, vollständige editierbare Felder sowie Dezimaltexte. Bearbeiten, Löschen und die absolute eigene Reservierungsmenge binden die Version. Bei einem Bearbeitungskonflikt lassen sich die aktualisierten Werte einsehen und als Grundlage übernehmen. Der Benutzer muss danach erneut speichern. Teilverbrauch sendet keine bestätigte Version. Der modale Vollverbrauch bindet die konkrete Menge, Einheit und Version. Bei neuer Version verfällt der Dialog.

Ein offener Auftrag hält seine normalisierten Parameter im RAM. Navigieren lässt ihn bestehen. Die identische Wiederholung läuft mit der ursprünglichen Operations-ID. Zum bewussten Abschliessen liest die Oberfläche über `reviewPending` und zusätzlich den vollständigen Vorrat. Ein passender Name beweist keine Zuordnung zur Operation. Die Auflösung erfolgt nur nach ausdrücklichem Abgleich. Bei verlorener Anlageabsicht nach Dokumentneustart erinnert ein einzelnes sitzungslokales Flag an den Abgleich. Es enthält keine Produkt-, Personen- oder Operationsdaten. Eine quittierte Mutation mit fehlgeschlagenem Nachlesen bietet einen reinen Leseversuch. Kontextverlust verwirft die offenen Daten.

## Eingabe und Kalender

`domain.ts` normalisiert Komma oder Punkt, höchstens drei Nachkommastellen und mathematisch ganze Zähleinheiten. Mengenvergleiche und Differenzen verwenden ganze Tausendstel. Namen, Kategorie/Einheit, EAN-13, optionale Felder und Datumsgrenzen werden vor dem RPC geprüft. Der Server entscheidet verbindlich. Ein geändertes Datum mehr als fünf Kalenderjahre in der Zukunft benötigt eine eigene Bestätigung. Die technische Obergrenze liegt bei zwanzig Kalenderjahren. Bei fehlendem Datum werden Datum und Art gemeinsam NULL.

`today()` bestimmt den Kalendertag in Europe/Zurich. ISO-Daten bleiben Kalenderdaten. Die Differenz der Tagesnummern bestimmt «Heute», «Morgen» oder die Zahl der über-/verbleibenden Tage. Die Warnfrist ist inklusive. Ein Timer bestimmt den nächsten Zürcher Tageswechsel. Fokus und Wiederverbindung berechnen den Tag ebenfalls neu.

## Erfassung ab Task 010

`ProductForm` in `src/features/capture/ProductForm.tsx` akzeptiert das optionale `seed: CaptureInput`. `captureDraft` übernimmt den EAN-13-Text einschliesslich führender Nullen. `lookup.outcome` unterscheidet `unknown`, `unavailable` und `verified`. Nur bei `verified` sind ein geprüfter Name und eine unterstützte Kategorie vorbelegbar. Leere Metadaten führen in dasselbe manuelle Formular. Alle Werte bleiben editierbar. Herkunftsziel und Fokus-ID hält `useCapture` für den aktiven Sitzungskontext. Abbrechen kehrt zum Auslöser zurück. Eine Kamera- oder Nachschlageschnittstelle existiert in 008 noch nicht.

## Betrieb und offene Abnahmen

Offline bleiben bereits angezeigte Daten im Arbeitsspeicher und werden als veraltet gekennzeichnet. Änderungen benötigen eine Verbindung. Für Task 011 dürfen Service Worker nur öffentliche statische Ressourcen cachen. Private API-Antworten, Aufträge und Eingaben gehören weder in Caches noch in IndexedDB. Die Anwendung verwendet native Datumseingaben und Dialoge. Betrieb mit realer Softwaretastatur, VoiceOver/TalkBack, iOS Safari, Kamera, Standalone-Modus und Installation benötigt Gerätetests. Eine schnelle Synchronisation über verschiedene Geräte folgt in 009. Alphabetische Alternativsortierung und zusätzliche P1-Filter sind zurückgestellt.
