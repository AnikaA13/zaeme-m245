# zäme – MVP-Spezifikation

**Version:** 1.1, Product-Owner-Entscheide vom 25.11.2026

**Zieltermin:** stabile Testversion am 01.12.2026

**Projekt:** Gruppe 23, GBS St. Gallen, Höhle der Löwen / M241/M245

**Stack:** React, TypeScript, Supabase/PostgreSQL, mobile-first PWA

## 1. Vision und Ziele

zäme ermöglicht Haushalten mit mindestens drei Personen, ihren Lebensmittelbestand, Haltbarkeitsdaten und Einkäufe gemeinsam mit möglichst wenig zusätzlichem Pflegeaufwand zu organisieren. Die App soll jederzeit online auf dem eigenen Smartphone nutzbar sein. Ziel ist weniger Lebensmittelverschwendung, weniger doppelte Einkäufe und weniger Mental Load. Diese langfristigen Wirkungen sind noch nicht nachgewiesen.

Zielgruppe: Familien und WGs, insbesondere Haushalte mit mehreren einkaufenden oder konsumierenden Personen. Hauptverantwortliche benötigen Übersicht, Mitverantwortliche schnellen Zugriff unterwegs, selten verantwortliche Personen besonders einfache Verbrauchsaktionen.

### Messbare Produktziele (vorgeschlagene Testziele, keine bisherigen Messwerte)

| ID  | Ziel                                | Messwert                                                                                          |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| G01 | Vorrat finden                       | <= 10 s                                                                                           |
| G02 | Bald fälliges Produkt finden        | <= 5 s                                                                                            |
| G03 | Manuell erfassen                    | Median <= 30 s                                                                                    |
| G04 | Bekanntes Produkt per Scan erfassen | Median <= 20 s                                                                                    |
| G05 | Vollständig verbrauchen             | <= 2 Interaktionen ab Produktdetail inklusive Bestätigung, falls keine Reservierung betroffen ist |
| G06 | Synchronisieren                     | <= 3 s unter stabiler Verbindung                                                                  |
| G07 | Pflegeaufwand                       | Median <= 2/5 (1 wenig, 5 viel)                                                                   |
| G08 | Selbstständige Bedienung            | >= 90 % der definierten Kernaufgaben ohne Hilfe                                                   |

## 2. Evidenz und Produktentscheid

Grundlagen: Gruppe23_Projektsteckbrief.pdf, Validierungsplakat_Lebensmittelmanagement.pdf, Variantenvergleich_zäme.docx, Leistungsnachweis_zäme.docx, zaeme_mobile.html und zehn Prototypentestprotokolle A–D.

- Projektsteckbrief: fehlender gemeinsamer Überblick, doppelte Einkäufe, vergessene Lebensmittel und fehlende Absprachen.
- Validierungsplakat: 48 % positive Antworten zur einfacheren Lebensmittelorganisation; Stichprobengrösse auf dem Plakat nicht ersichtlich. Ablauf-Erinnerungen gefragt, viele nutzen bereits Einkaufslisten. Konsequenzen: Haushalte ab drei Personen, keine Scanpflicht, Haltbarkeit statt weiterer Liste, «Reservieren raus, Bestand rein».
- Mobile: beide Testpersonen erledigten Aufgaben ohne Hilfe; beide fanden den Vorrat über Ablaufhinweise. Pflegeaufwand 4/5 und 2/5; beide konnten sich die Nutzung vorstellen. T01 fand Reservieren vor Verbrauchen; T02 bewertete Reservierung positiv. Scan und Mehrgeräte-Sync waren simuliert.
- ScanStation: drei Tests; nur eine Person würde die Variante nutzen. B01 kritisierte fehlende Eingabekontrollen und Löschwarnung; B02 unklaren Schritt nach dem Scan; B03 schlecht sichtbaren Scan-Einstieg und Überladung.
- FridgeHub: drei Tests, alle ohne Hilfe; Pflegeaufwand jeweils 2/5. Manuelle Eingabe, falsche Einheiten, Icons, Datumsformat und versehentliches Entfernen wurden kritisiert. Zwei würden es nutzen; eine Person aus einem Zweipersonenhaushalt nicht.
- FoodLight: zwei Tests mit denselben Personen wie Mobile; Warnfarben verständlich, betroffene Produkte und Mengen fehlen; beide Pflegeaufwand 4/5. Keine eigenständige Lösung gewünscht.
- Variantenvergleich: Mobile 3,90/5, FridgeHub 2,80, ScanStation 2,60, FoodLight 2,20. Technische und wirtschaftliche Bewertungen sind vorläufige Einschätzungen. Zehn Testdurchläufe sind nicht zehn unabhängige Personen.

### Freigegebene Entscheidungen und Abweichungen

| Thema          | Finaler Entscheid                            | Einordnung                                                                                                                      |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Reservierungen | P0                                           | Abweichung vom Validierungsplakat und früherer P2-Empfehlung; ausdrücklicher PO-Entscheid, Bedarf nicht abschliessend validiert |
| Push           | P1                                           | Von P2 auf P1 angehoben; Nutzerwunsch, keine Wirksamkeitsmessung                                                                |
| Haushalt       | Ein Haushalt pro Konto                       | Unverändert; Einrichtung mit einem Mitglied möglich                                                                             |
| Datum          | Optional                                     | Unverändert; unbekannte Daten nicht erfinden                                                                                    |
| Produktdaten   | Open Food Facts                              | Unverändert; Abdeckung und Lizenz/API-Vorgaben prüfen                                                                           |
| Offline        | Online-only als einfachste Variante          | Präzisierung: keine Offline-Datenbank, keine Schreibqueue, kein privater Offline-Cache                                          |
| Installation   | P0                                           | Von P1 auf P0 angehoben                                                                                                         |
| Warnfrist      | Konfigurierbar pro Haushalt, Standard 3 Tage | Abweichung von fixer Frist; verbindlicher Bereich 0–30 ganze Tage, gemeinsame Einstellung                                       |

## 3. Prioritäten und Scope

P0 = Release-Pflicht; P1 = erst nach stabilen P0-Funktionen; P2 = nicht bis zum Testrelease. Keine neue Funktion ohne PO-Entscheid. Sicherheit und Datenintegrität sind nicht verhandelbar.

| ID  | Funktion                   | Priorität | Abhängigkeit       |
| --- | -------------------------- | --------- | ------------------ |
| F01 | Auth                       | P0        | Supabase           |
| F02 | Haushalte                  | P0        | F01                |
| F03 | Vorrat                     | P0        | F02, F10           |
| F04 | Synchronisierung           | P0        | F02, F03           |
| F05 | Manuelle Erfassung         | P0        | F03, F10           |
| F06 | Barcode                    | P0        | F05, HTTPS         |
| F07 | Bearbeiten/Verbrauchen     | P0        | F03, F04, F10, F17 |
| F08 | Ablaufhinweise             | P0        | F03, F19           |
| F09 | Einkaufsliste              | P0        | F02, F04           |
| F10 | Eingabekontrollen          | P0        | Schema             |
| F11 | Navigation                 | P0        | Kernfunktionen     |
| F12 | Frühere Produkte           | P1        | F05                |
| F13 | Feldvorschläge             | P1        | F05                |
| F14 | Weitere Filter             | P1        | F03                |
| F15 | PWA-Installation           | P0        | HTTPS, App-Shell   |
| F16 | Geführte Einkaufsübernahme | P1        | F05, F09           |
| F17 | Reservierungen             | P0        | F02, F03, F04, F10 |
| F18 | Push-Benachrichtigungen    | P1        | F08, F15, F19      |
| F19 | Konfigurierbare Warnfrist  | P0        | F02, F10           |

F07/F17 werden als gemeinsames Bestandsmodul implementiert, nicht als zyklische Entwicklungsabhängigkeit. F04 umfasst auch Einkauf, Reservierungen und Einstellungen, sobald die jeweiligen Tabellen vorhanden sind.

P2: Rezepte, Bon-OCR, automatische MHD-Erkennung, eigene Icons/Kategorien, Nährwerte, Statistiken, mehrere Haushalte pro Konto, vollständiges Offline, Händlerkonten, native Apps, Hardware, Abos, wiederkehrende Reservierungen, automatische Freigabe und komplexe Berechtigungsrollen.

## 4. Funktionale Anforderungen und Abnahme

Alle Kriterien sind Soll-Kriterien, keine Aussage über bereits erfolgte Umsetzung. IDs sind stabil für Tests und Codex.

### F01 – Authentifizierung (P0)

**Story:** Als Mitglied möchte ich ein persönliches Konto, um auf meinem Gerät auf unseren Haushalt zuzugreifen.

- AK01.1 Registrierung, Anmeldung und Abmeldung mit E-Mail/Passwort über Supabase Auth funktionieren; ggf. E-Mail-Verifikation und Weiterleitung sind konfiguriert.
- AK01.2 Falsche Daten erzeugen verständliche Fehler; Passwort-Zurücksetzung funktioniert über konfigurierten Link.
- AK01.3 Gültige Sitzung bleibt beim Neuladen bestehen.
- AK01.4 Nicht angemeldete Personen können keine Haushaltsdaten lesen/schreiben.
- AK01.5 Nach Logout werden private Daten und Query-Caches gelöscht, Subscriptions beendet.

### F02 – Haushalt (P0)

**Story:** Als Mitglied möchte ich einen Haushalt erstellen oder ihm beitreten, damit wir dieselben Daten nutzen.

- AK02.1 Angemeldete Person kann einen benannten Haushalt erstellen; Erstellung und Mitgliedschaft sind atomar.
- AK02.2 Zwei weitere Konten können via gültigem Einladungslink/-code beitreten; alle drei sehen denselben Haushalt und Mitglieder.
- AK02.3 Ein Konto gehört maximal einem Haushalt an, auch bei parallelen Beitrittsversuchen.
- AK02.4 Einladungen sind zufällig, gehasht gespeichert, standardmässig 7 Tage gültig und widerrufbar; ungültige Einladungen werden abgelehnt. Mehrfachnutzung bis Ablauf/Widerruf genügt.
- AK02.5 Fremde Haushalts-IDs verschaffen keinen Zugriff.
- AK02.6 Mitglieder können austreten; Owner kann andere entfernen. Owner kann nicht austreten, solange andere Mitglieder vorhanden sind (Transfer/Haushaltslöschung ausserhalb MVP; letzter Owner kann über kontrollierten Vorgang Haushalt auflösen). Austritt/Entfernung gibt eigene Reservierungen atomar frei.
- AK02.7 Entfernte Mitglieder verlieren serverseitig sofort Zugriff; UI leert Daten bei nächster Berechtigungsprüfung, spätestens beim Fokus/Refresh. Regelmässige Prüfung (z.B. alle 30 s) während geöffneter App.

### F03 – Gemeinsamer Vorrat (P0)

**Story:** Als Mitglied möchte ich sehen, was vorhanden und verfügbar ist, um unnötige Einkäufe zu vermeiden.
Felder: Name (Pflicht), Menge (Standard 1), Einheit (Stück), Kategorie (Sonstiges), Lagerort optional (Kühlschrank/Gefrierfach/Vorratsschrank/Sonstiges), Datum optional, Datumsart bei Datum (MHD/Verbrauchsdatum/unbekannt), Barcode optional.

- AK03.1 Aktive Einträge zeigen Name, Gesamtmenge, reservierte/freie Menge falls relevant, Einheit und Datumsstatus.
- AK03.2 Namenssuche findet Einträge unabhängig von Gross-/Kleinschreibung.
- AK03.3 Leerer Vorrat bietet klare Hinzufügen-Aktion.
- AK03.4 Gleiches Produkt mit verschiedenen Daten kann getrennt erfasst werden; keine automatische Zusammenführung.
- AK03.5 Daten bleiben nach App-Neustart erhalten.

### F04 – Synchronisierung (P0)

**Story:** Als Mitglied möchte ich Änderungen anderer Personen zeitnah sehen.

- AK04.1 Erstellung, Änderung und Verbrauch sowie Änderungen an Einkauf, Reservierung und Warnfrist erscheinen auf einem zweiten verbundenen Gerät innerhalb von 3 s (stabile Verbindung, Testumgebung dokumentieren).
- AK04.2 Refetch bei Fokus, Wiederverbindung und nach eigener Mutation; Realtime-Ereignisse lösen Refetch der betroffenen Daten aus. Ladezustand und Fehler sichtbar.
- AK04.3 Keine negativen Mengen, Überreservierungen oder stillen verlorenen Updates bei Parallelzugriff.
- AK04.4 Veraltete Bearbeitung wird mit Konflikthinweis abgelehnt; aktuelle Daten laden.
- AK04.5 Fehler/Timeout werden nicht als Erfolg angezeigt; bei unklarem Ergebnis zunächst Refetch, keine blinde Wiederholung.

### F05 – Manuelle Erfassung (P0)

**Story:** Als Mitglied möchte ich Lebensmittel ohne Kamera erfassen, auch unverpackte Produkte und Reste.

- AK05.1 Startseite bietet direkte manuelle Erfassung; ein Formular mit Standardwerten.
- AK05.2 Name, Menge, Einheit und Kategorie sind editierbar; Datum, Lagerort und Barcode dürfen fehlen.
- AK05.3 Nach bestätigtem Speichern erscheint Eintrag im Vorrat.
- AK05.4 Doppeltippen erzeugt keine Duplikate (Button sperren, stabile clientseitige UUID/Idempotenz).
- AK05.5 Median der manuellen Erfassung <= 30 s im Nutzertest.

### F06 – Barcode (P0)

**Story:** Als einkaufende Person möchte ich einen Barcode scannen, um weniger zu tippen.

- AK06.1 Echte Kameraerkennung für EAN-13 auf vorgesehenen iOS-/Android-Geräten; keine Demo-Erkennung.
- AK06.2 Bekannter Barcode liefert editierbaren Produktnamen aus Open Food Facts; kein erfundenes Datum.
- AK06.3 Unbekannter Barcode öffnet manuelles Formular mit Barcode; Kamera verweigert/nicht verfügbar, API-Ausfall oder Timeout (Vorschlag 5 s) bieten klaren manuellen Fallback.
- AK06.4 Speichern erst nach Bestätigung; keine automatische Bestandsänderung durch Scan.
- AK06.5 Kamera-Stream endet bei erkanntem Code, Abbruch, Navigation und Unmount.
- AK06.6 Ziel: 18/20 lesbare EAN-13 erkannt, 14/20 Produktnamen gefunden (separate Kennzahlen, keine garantierte externe Abdeckung); bekannte Produkte Median <= 20 s.
- AK06.7 Open Food Facts attribution, Nutzungsbedingungen, Rate Limits und erforderliche Client-Kennung prüfen; Barcode als einzige notwendige externe Abfrageinformation, keine Haushaltsdaten. Kein Bild-Upload.

### F07 – Bearbeitung und Verbrauch (P0)

**Story:** Als Mitglied möchte ich Mengen und Angaben schnell korrigieren und Lebensmittel verbrauchen.

- AK07.1 Teilverbrauch: 3 Stück minus 1 ergibt 2; vollständiger Verbrauch erfordert Bestätigung, danach nicht mehr im aktiven Vorrat.
- AK07.2 Verbrauch > verfügbare persönliche Menge wird abgelehnt; fremde Reservierungen bleiben geschützt (F17).
- AK07.3 Name, Menge, Kategorie, Einheit, Lagerort, Barcode, Datum und Datumsart korrigierbar. Einheit/Kategorieänderung bei aktiven Reservierungen nur nach deren Freigabe (keine automatische Umrechnung).
- AK07.4 Mengenreduktion unter Gesamtreservierung wird abgelehnt; vollständiges Löschen mit aktiven Reservierungen ist nicht zulässig. Eigene Reservierung kann durch Verbrauch aufgelöst werden.
- AK07.5 Verbrauch prominent und ohne Scrollen im Produktdetail erreichbar; keine konkurrierende primäre Reservierungsaktion.
- AK07.6 Zwei gleichzeitige zulässige Verbrauchsaktionen werden atomar verarbeitet; kein negativer Endbestand.

### F08 – Ablaufhinweise (P0)

**Story:** Als Mitglied möchte ich konkrete bald fällige Produkte erkennen.

- AK08.1 Startseite zeigt Name, Menge und Datum betroffener aktiver Einträge, sortiert nach Datum (älteste zuerst); Link führt zum Eintrag oder gefilterten Vorrat.
- AK08.2 Bei Standardfrist 3: gestern = Datum überschritten; heute bis heute+3 inklusive = Bald fällig; heute+4 = Datum noch nicht erreicht; null = Kein Datum erfasst.
- AK08.3 Datumsschwellen verwenden Europe/Zurich und reine Kalendertage, auch bei Sommerzeitwechsel. Neuberechnung bei Fokus, Tageswechsel und Einstellungsänderung.
- AK08.4 Status als Text und Farbe; MHD und Verbrauchsdatum unterscheiden, keine Garantie der Geniessbarkeit, kein automatisches Entsorgen.
- AK08.5 Frist 0 zeigt heute fällige und vergangene Einträge; unbekannte Daten bleiben neutral.

### F09 – Einkaufsliste (P0)

**Story:** Als einkaufende Person möchte ich gemeinsam fehlende Produkte verwalten.

- AK09.1 Erstellen, Bearbeiten, Abhaken, Wiederöffnen und Entfernen von Einträgen; mindestens Name, optionale Menge/Einheit als Paar.
- AK09.2 Offene und erledigte Einträge unterscheiden; Änderungen auf allen Geräten sichtbar.
- AK09.3 Aus Vorrat kann Name vorausgefüllt auf Liste gesetzt werden.
- AK09.4 Abhaken erzeugt keinen automatischen Vorratseintrag; tatsächliche Menge und Datum müssen bewusst erfasst werden.

### F10 – Eingabekontrollen (P0)

**Story:** Als Mitglied möchte ich falsche Eingaben erkennen, bevor sie den Bestand verfälschen.

- AK10.1 Name getrimmt 1–100 Zeichen; Menge >0 und <= 9999; Stück/Packung ganzzahlig, kg/Liter bis 3 Nachkommastellen; falsche Eingaben ablehnen statt runden.
- AK10.2 Kategorien und Einheiten: Früchte/Gemüse, Fleisch/Fisch, Brot/Backwaren, Trockenwaren: Stück/Packung/kg; Milchprodukte und Sonstiges zusätzlich Liter; Getränke: Stück/Packung/Liter. Kategorieänderung prüft Einheit.
- AK10.3 Datum gültig oder leer; vergangene Daten zulässig. Plausibilitätswarnung bei mehr als 5 Jahren in der Zukunft (bewusst bestätigbar); technische Obergrenze 20 Jahre ab Erfassung/Änderung, nicht als täglich neu ausgewertetes DB-CHECK. Datumstyp bei vorhandenem Datum erforderlich.
- AK10.4 Barcode optional, für Scan EAN-13 inklusive Prüfziffer; manueller Barcode nur unterstütztes Format. Kein Datum aus Standard-EAN ableiten.
- AK10.5 Verbrauch und Reservierung positiv, zur Einheit passend, innerhalb serverseitig berechneter Grenzen.
- AK10.6 Ungültige direkte API-Schreibversuche werden ebenso abgelehnt; UI- und Serverregeln konsistent.
- AK10.7 Warnfrist ganzzahlig 0–30, Haushaltsname/Anzeigename nicht leer (max. 100 Zeichen).

### F11 – Navigation (P0)

**Story:** Als selten verantwortliche Person möchte ich ohne Anleitung die Kernaktionen finden.

- AK11.1 Fünf beschriftete Einträge mit zugänglichen Icons in der Reihenfolge Start, Vorrat, Hinzufügen, Einkauf, Haushalt. Hinzufügen öffnet zentral und hervorgehoben die Erfassung per Scan oder manueller Eingabe. Abbruch bringt zur vorherigen Ansicht zurück. Die vier dauerhaften Ziele sind direkt erreichbar, das aktive Ziel ist markiert. Safe Area und mindestens 44 × 44 CSS-px auch bei 320 px prüfen.
- AK11.2 Start zeigt kurze Zweckbeschreibung, Ablaufhinweise, Scan und manuelle Erfassung; bei 390px Testviewport sind Kernaktionen ohne verdeckende Navigation zugänglich.
- AK11.3 Keine separate doppelte Ablaufseite; Filter in Vorrat.
- AK11.4 Alle sichtbaren Aktionen funktionieren, inklusive Fehler-/Leer-/Ladezuständen. Keine Demo-Bedienelemente oder simulierten Nutzerwechsel.
- AK11.5 Branding: echtes Logo aus Projektassets, Violett/Mint/Creme/Koralle; kein Smartphone-Demorahmen. Schweizer Standarddeutsch.

### F15 – PWA-Installation (P0)

**Story:** Als Mitglied möchte ich zäme vom Startbildschirm öffnen.

- AK15.1 Produktions-HTTPS, Web App Manifest mit Name, Kurzname, start_url, scope, standalone, passenden 192/512px Icons und maskable Icon.
- AK15.2 Installation auf dokumentiertem Android Chrome und Hinzufügen zum Home-Bildschirm auf iOS Safari erfolgreich; iOS-Anleitung statt erzwungenem Browser-Prompt.
- AK15.3 App öffnet im Standalone-Modus und Auth/Kernfunktionen funktionieren online.
- AK15.4 Service Worker (falls für Installierbarkeit/Tooling benötigt) cached höchstens öffentliche statische Assets, niemals authentifizierte API-Antworten. Offline zeigt verständlichen Hinweis, keine Offline-Schreibvorgänge. Update/Reload verliert keine bestätigten Daten.

### F17 – Reservierungen (P0, bewusst klein)

**Story:** Als Mitglied möchte ich eine Menge eines Lebensmittels für mich vormerken, damit andere wissen, dass diese Menge vorgesehen ist.
**Geschäftsregel:** Reservierung ist eine mengenbezogene Zuordnung zu einem Mitglied, keine physische Verbrauchsgarantie. Gesamtbestand bleibt unverändert. Freie Menge = Gesamtmenge minus Summe aktiver Reservierungen. Persönlich verbrauchbare Menge = freie Menge plus eigene Reservierung. Keine Reservierungen für Dritte, keine Ablaufzeit, keine Erinnerungen, keine Notizen, keine Historienansicht.

- AK17.1 Bei 3 Stück kann A 2 reservieren; alle sehen Gesamt 3, reserviert 2 (A), frei 1.
- AK17.2 B kann höchstens 1 reservieren oder verbrauchen; Versuch 2 abzulehnen mit Hinweis auf A. Keine fremde Freigabe durch reguläre Mitglieder.
- AK17.3 A kann eigene Reservierung ändern oder freigeben; 0 bedeutet Freigabe. Pro Produktcharge und Mitglied höchstens eine aktive Reservierung.
- AK17.4 A verbraucht 1 aus eigener Reservierung zuerst: Gesamt 2, eigene Reservierung 1, freie Menge 1. Verbrauch oberhalb eigener Reservierung nutzt freie Menge; fremde Mengen bleiben erhalten.
- AK17.5 Zwei parallele Versuche, jeweils 2 von 3 freien Stück zu reservieren: höchstens einer erfolgreich; kein Überbuchen.
- AK17.6 Vollständiges Entfernen mit fremder Reservierung wird blockiert. Eigene Reservierung darf durch bestätigten vollständigen Verbrauch aufgelöst werden, sofern keine fremden Reservierungen bestehen.
- AK17.7 Mitgliedsaustritt/-entfernung gibt dessen Reservierungen in derselben Transaktion frei. Owner hat keine allgemeine Berechtigung, fremde Reservierungen zu ändern.
- AK17.8 Reservierungen erscheinen im Produktdetail und kompakt im Vorrat, nicht als eigener Navigationsbereich. Verbrauch bleibt primäre Aktion.
- AK17.9 Fremder Haushalt und manipulierte user_id können keine Reservierungen lesen/ändern; serverseitige Eigentümerprüfung.

### F19 – Warnfrist einstellen (P0)

**Story:** Als Haushaltsmitglied möchte ich festlegen, wie früh wir vor Haltbarkeitsdaten gewarnt werden.

- AK19.1 Neuer Haushalt hat 3 Tage Standardfrist.
- AK19.2 Owner ändert unter Haushalt die Frist auf eine ganze Zahl 0–30, andere Mitglieder sehen den Wert; nur Owner darf ändern (bewusst vereinfachte Berechtigung).
- AK19.3 Bei Frist 7 ist heute+7 bald fällig, heute+8 nicht; bei Frist 0 nur heute/überfällig. Änderung wirkt auf alle Geräte nach Sync ohne neue Dateneingabe.
- AK19.4 -1, 31 und 2.5 werden im UI und Backend abgelehnt; Wert bleibt nach Neustart bestehen.
- AK19.5 P1-Push verwendet dieselbe Haushaltsfrist.

## 5. P1 – optionale Erweiterungen

| ID  | User Story und Akzeptanzkriterium                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F12 | Frühere Produkte erneut auswählen: Name/Kategorie/Einheit übernehmen, Datum und Menge neu prüfen.                                                                                                                                                                                                                                                                                                                                                                                          |
| F13 | Passende Feldvorschläge: korrigierbar, kein erfundenes Datum.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F14 | Kategorie-/Lagerortfilter: nur passende Einträge, Reset vorhanden.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F16 | Abgehakten Einkauf geführter Übernahme zuführen: Formular vorausgefüllt, erst nach Bestätigung speichern.                                                                                                                                                                                                                                                                                                                                                                                  |
| F18 | Optional Push aktivieren/deaktivieren: ausdrückliche Einwilligung pro Gerät; höchstens eine tägliche zusammengefasste Warnung pro Gerät mit betroffenen Namen, nur bei vorhandenen fälligen Produkten. Haushaltsfrist nutzen, Zeitzone Europe/Zurich, keine privaten Inhalte standardmässig auf Sperrbildschirm (generischer Hinweis, Details nach Auth); keine Push-Pflicht. Test: erlaubtes Gerät erhält Warnung, abgemeldetes/widerrufenes Gerät nicht; keine Doppelzustellung pro Tag. |

Push erfordert serverseitig geplanten Versand, sichere Subscription-Verwaltung und plattformspezifische Tests. Nicht starten, bevor alle P0 stabil sind. Empfohlene P1-Reihenfolge F12, F13, F14, F16, F18; Push ist Nutzerwunsch, aber technisch aufwendiger als Wiederverwendung.

## 6. Nichtfunktionale Anforderungen

| ID   | Anforderung/Abnahme                                                                                                                                                       | Prio |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| NF01 | RLS auf allen privaten Tabellen; direkte fremde SELECT/INSERT/UPDATE/DELETE und RPC-Zugriffe abgelehnt.                                                                   | P0   |
| NF02 | Datenminimierung: E-Mail, Anzeigename, notwendige Haushaltsdaten; keine Kamerabilder, keine Secrets/PII in Logs.                                                          | P0   |
| NF03 | Vorrat mit 200 Einträgen lädt <=3 s auf dokumentiertem Testgerät bei stabiler Verbindung.                                                                                 | P0   |
| NF04 | 320–1440 CSS-px ohne horizontales Scrollen.                                                                                                                               | P0   |
| NF05 | iOS Safari und Android Chrome auf dokumentierten Testgeräten; Kamera und Standalone separat prüfen.                                                                       | P0   |
| NF06 | Primäre Touch-Ziele >=44x44 CSS-px.                                                                                                                                       | P0   |
| NF07 | Labels, sichtbarer Fokus, Status nicht nur Farbe, WCAG-AA-Kontrast als Ziel für Text.                                                                                     | P0   |
| NF08 | Keine stillen Datenverluste, keine falschen Speichererfolge; Konflikte verständlich.                                                                                      | P0   |
| NF09 | TypeScript strict, UI/Geschäftslogik getrennt, reproduzierbare Migrationen.                                                                                               | P0   |
| NF10 | de-CH, TT.MM.JJJJ, Europe/Zurich.                                                                                                                                         | P0   |
| NF11 | Online-only: Offline-Hinweis, keine Offline-Schreibqueue oder private persistente Caches; bereits im RAM geladene Daten nur als veraltet anzeigen; bei Reconnect refetch. | P0   |
| NF12 | HTTPS-Deployment, keine service_role im Client, keine Secrets in Git.                                                                                                     | P0   |
| NF13 | Lint, Typecheck, Unit-/Integrationstests und Build erfolgreich; kritische RLS-/Parallelitätstests.                                                                        | P0   |
| NF14 | Installierbare PWA gemäss F15.                                                                                                                                            | P0   |

## 7. Technische Architektur

React + TypeScript strict + Vite; Supabase Auth, PostgreSQL, RLS, Realtime. Vorschläge: React Router, Zod, @zxing/browser, vite-plugin-pwa, Vitest, Playwright; bestehende passende Infrastruktur bevorzugen. HTTPS-Hosting z.B. Vercel/Netlify. Kein separates Node-Backend erforderlich. Open Food Facts über kleine Lookup-Abstraktion, ggf. Edge Function für nötige API-Kennung/Rate-Limit/CORS. Bibliotheks- und API-Versionen vor Implementierung anhand offizieller Dokumentation prüfen.

### Datenmodell

Der Umsetzungsvorschlag in [DATABASE_SPEC.md](DATABASE_SPEC.md) präzisiert die folgende fachliche Übersicht. Nach der Implementierung führen versionierte Migrationen das Schema.

| Tabelle           | Wesentliche Felder und Constraints                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| profiles          | id UUID PK = auth.users.id, display_name, created_at                                                                                                                                                                                                                                  |
| households        | id UUID PK, name, created_by, warning_days integer NOT NULL DEFAULT 3 CHECK 0–30, version, timestamps                                                                                                                                                                                 |
| household_members | household_id, user_id, Rolle aus households.owner_id abgeleitet, joined_at; PK(household_id,user_id), UNIQUE(user_id); ein Owner pro Haushalt via kontrollierter RPC/Constraint                                                                                                       |
| household_invites | id, household_id, token_hash UNIQUE, expires_at, revoked_at, created_by; kein öffentlicher Token-Lesezugriff                                                                                                                                                                          |
| inventory_items   | id UUID PK, household_id, name, quantity numeric, unit, category, location nullable, expiry_date date nullable, date_type nullable, barcode nullable, status active/consumed, version integer, created_by, timestamps; positive aktive Menge, verbraucht = 0; unique(household_id,id) |
| reservations      | id UUID PK, household_id, inventory_item_id, user_id, quantity numeric >0, timestamps; UNIQUE(inventory_item_id,user_id); zusammengesetzte FK auf Inventar und Mitgliedschaft; aktive Einträge nur, Freigabe löscht Zeile                                                             |
| shopping_items    | id UUID PK, household_id, name, quantity nullable, unit nullable, checked boolean, version, timestamps                                                                                                                                                                                |

Mengen mit exakter numeric-Arithmetik; keine implizite Rundung durch numeric scale vor Validierung. Datum als date, Zeitstempel timestamptz. Indizes household_id, expiry_date, reservation inventory_item_id, Membership-Lookups. UUIDs für idempotente Erstellung. Reservierte Summe wird aus Reservierungen abgeleitet, nicht als unabhängig editierbarer Bestand gespeichert. P1-Push-Tabellen erst bei tatsächlicher Umsetzung hinzufügen.

### Autorisierung und Transaktionen

- RLS-Mitgliedschaft serverseitig, nicht aus Client-Claims/gewählter Haushalts-ID ableiten. Profiles nur selbst und gemeinsame Mitglieder lesbar; keine fremden E-Mail-Adressen offenlegen.
- Household create/join/leave/remove, Einladungen und Owner-Einstellungen über geprüfte RPCs. Invite-Token ausreichend zufällig, nur Hash speichern; Rate-Limit für Redemption. SECURITY DEFINER nur wenn nötig, fixer search_path, vollständig qualifizierte Tabellen, explizite auth.uid()- und Mitgliedschaftsprüfung, EXECUTE nur für benötigte Rollen.
- Keine direkten Client-Mutationen auf Inventar/Reservierungen, die Mengeninvarianten umgehen können; RLS plus Grants/RPC-Zugriff. Auch Besitzerrolle darf diese Regeln nicht umgehen.
- Jede Bestands-/Reservierungsänderung sperrt dieselbe Inventarzeile (SELECT FOR UPDATE) innerhalb einer Transaktion, prüft Mitgliedschaft, Status, Einheit, Menge und Reservierungssumme; bei Mehrzeilenoperationen konsistente Sperrreihenfolge. Auch Mitgliedsentfernung/Freigabe synchronisiert mit diesen Operationen. Mitgliedschaft und Änderungen so koordinieren, dass ausgeschiedene Personen keine neuen Reservierungen erzeugen können.
- Die Schreibverträge für absolute eigene Reservierung (0 gibt frei), additiven Verbrauch, versionierte Bestandskorrektur und Einkauf stehen in [RPC_SPEC.md](RPC_SPEC.md).
- Realtime für autorisierte Tabellen aktivieren; bei Löschereignissen keine privaten Payloads offenlegen; bei Event refetch, zusätzlich Fokus/Reconnect und Mitgliedschaft prüfen. Kein Vertrauen auf Realtime als einzige Konsistenzquelle.

### Online-only und PWA

Keine IndexedDB für Haushaltsdaten, kein Offline-Queueing, keine Konfliktsynchronisierung nach Offline-Änderungen. Auth-Session gemäss Supabase SDK darf persistieren. Ohne Verbindung Schreibaktionen deaktivieren oder klar fehlschlagen lassen; bei unklarem Serverergebnis erneut laden. Service Worker höchstens für statische App-Shell, niemals Supabase-/Auth-/Produkt-API-Caches. Installierbarkeit ist nicht gleich Offline-Funktionalität.

## 8. Traceability: Erkenntnis → Verbesserung

| Quelle                                | Erkenntnis                                                                           | Anforderung                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Validierungsplakat                    | Haltbarkeit gefragt, vorhandene Einkaufslisten                                       | F08, F09 minimal, F19 (Frist selbst nicht validiert)                               |
| Validierungsplakat                    | Keine Scanpflicht                                                                    | F05, F06 Fallback                                                                  |
| Validierungsplakat / Mobile T02 / T01 | Reservieren früher verworfen, später positiv bewertet bzw. mit Verbrauch verwechselt | F17 PO-Entscheid; F07 primär; gezielt nachvalidieren                               |
| Mobile T01/T02                        | Ablaufhinweise direkt gefunden, Navigation nicht genutzt                             | F08, F11                                                                           |
| Mobile T01                            | Aufwand 4/5, Lagerort schwierig, frühere Produkte gewünscht                          | F05, F06, F12, F13; Lagerort optional                                              |
| Mobile T02                            | Alle müssen mitmachen; Zweck anfangs unklar                                          | F01, F02, F04, F11                                                                 |
| ScanStation B01                       | Fehlende Löschwarnung, MHD nicht editierbar, unrealistische Eingaben                 | F07, F10                                                                           |
| ScanStation B02/B03                   | Scanablauf und Einstieg unklar, doppelte Seiten                                      | F06, F11                                                                           |
| ScanStation B01/B02                   | Push gewünscht                                                                       | F18, P1                                                                            |
| FridgeHub T01/T02/T03                 | Manuelle Eingabe aufwendig, Einheiten/Datumsformat problematisch                     | F05, F06, F10, NF10                                                                |
| FridgeHub T02/T03                     | Versehendliches Entfernen/Undo-Wunsch                                                | F07 Bestätigung (Undo nicht P0)                                                    |
| FridgeHub zusammenfassende Auswertung | Zwei fanden gemeinsame Einkaufsliste hilfreich                                       | F09                                                                                |
| FridgeHub T03 / ScanStation B01/B02   | Personenbezogene Zuordnung gewünscht                                                 | F17 als begrenzte Lösung, nicht gleichbedeutend mit validierter Mengenreservierung |
| FoodLight T01/T02                     | Farben verständlich, konkrete Produkte fehlen                                        | F08                                                                                |
| Variantenvergleich                    | Echte Synchronisierung/Barcode offen                                                 | F04, F06                                                                           |
| PO-Entscheide 25.11.                  | Installation, konfigurierbare Frist, Reservierungen zwingend                         | F15, F19, F17                                                                      |

## 9. Offene Annahmen und Risiken

| ID  | Annahme/Risiko                                         | Prüfung/Massnahme                                                                       |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| H01 | Alle Mitglieder pflegen Bestand regelmässig            | Mehrtägiger Haushaltstest, Beteiligung je Mitglied                                      |
| H02 | Pflegeaufwand bleibt gering                            | Zeitmessung und tägliche Rückmeldung                                                    |
| H03 | Scan spart tatsächlich Zeit                            | Vergleich Scan/manuell bei realen Produkten                                             |
| H04 | Open Food Facts deckt Schweizer Produkte ab            | 20 reale Produkte, getrennte Scan-/Lookup-Quote                                         |
| H05 | Mehrgeräte-Sync und Parallelität zuverlässig           | Drei Konten, gleichzeitige Aktionen                                                     |
| H06 | Digitaler und physischer Bestand stimmen überein       | Stichprobenabgleich Menge/Vorhandensein                                                 |
| H07 | Ablaufhinweise führen zu rechtzeitigem Verbrauch       | Alltagstest, konkrete Beispiele                                                         |
| H08 | Lebensmittelverschwendung und doppelte Einkäufe sinken | Längerer Vorher-Nachher-Vergleich, nicht aus Kurztest ableiten                          |
| H09 | Minimale Einkaufsliste genügt                          | Einkaufsszenario                                                                        |
| H10 | Standard 3 Tage/konfigurierbare Frist sinnvoll         | Test verschiedener Fristen, Feedback                                                    |
| H11 | PWA-Installation praktikabel                           | iOS-/Android-Gerätetests                                                                |
| H12 | Reservierungen verhindern Konflikte ohne Mehrpflege    | Konkrete Alltagssituationen, Nutzungshäufigkeit, Fehlbedienung und Aufwand erfassen     |
| H13 | Visuelle Hinweise reichen ohne Push                    | Alltagstest; Push P1 nur bei Kapazität                                                  |
| H14 | Online-only genügt auch unterwegs                      | Netzunterbruch beim Einkauf testen; keine Offline-Zusage                                |
| R01 | P0-Ausweitung gefährdet Termin                         | Reservierungen schlank, Installation früh testen, P1 streichen, Scope-Änderungen nur PO |
| R02 | RLS/RPC-Fehler gefährden Privatsphäre                  | Negative Zugriffstests vor Deployment                                                   |
| R03 | Fehlende Auth-Mail/Hosting-Konfiguration               | Frühzeitig reale Registrierung und HTTPS testen                                         |

## 10. Testplan und Release

### Technische Abnahmetests

| ID   | Szenario                                                             | Erwartung                                                         |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| TT01 | Drei Konten einem Haushalt beitreten                                 | Gemeinsame Daten, maximal eine Mitgliedschaft pro Konto           |
| TT02 | Fremdes Konto/unauthenticated mit bekannten IDs, direkte API und RPC | Alle privaten Zugriffe abgelehnt                                  |
| TT03 | A erfasst Produkt, B/C online                                        | <=3 s sichtbar                                                    |
| TT04 | Zwei Mitglieder verbrauchen je 1 von 2 freien Stück                  | Endbestand 0, kein verlorenes Update                              |
| TT05 | Unbekannter Barcode, verweigerte Kamera, API-Timeout                 | Manuelle Erfassung bleibt möglich                                 |
| TT06 | 1.4 Packungen, -1, 0, falsche Einheit, ungültiges Datum              | UI und Backend lehnen ab                                          |
| TT07 | Ablauf gestern/heute/+3/+4/null; Frist 0/7/30, Tageswechsel          | Richtige Status und gleiche Frist auf allen Geräten               |
| TT08 | Verbindung aus, Schreibversuch, Reconnect                            | Kein falscher Erfolg, aktueller Refetch                           |
| TT09 | Einkauf abhaken                                                      | Sync, kein automatischer Vorratseintrag                           |
| TT10 | Logout, Neustart, Passwortreset                                      | Keine privaten Restdaten nach Logout; gültige Sitzung persistiert |
| TT11 | Vollverbrauch ohne Bestätigung                                       | Keine Änderung                                                    |
| TT12 | Mitglied entfernen, offene Reservierung                              | Zugriff weg, Reservierung freigegeben                             |
| TT13 | A reserviert 2 von 3, B versucht 2 zu verbrauchen                    | Abgelehnt; B kann 1 verbrauchen                                   |
| TT14 | A verbraucht aus eigener Reservierung                                | Gesamt- und Reservierungsmenge sinken atomar                      |
| TT15 | Zwei konkurrierende Reservierungen je 2 von 3                        | Höchstens eine erfolgreich                                        |
| TT16 | Reservieren parallel zu Verbrauch/Austritt                           | Keine Überbuchung, keine verwaisten Reservierungen                |
| TT17 | Veraltete Bearbeitung und doppelte Anfrage                           | Konflikt bzw. idempotente Wirkung                                 |
| TT18 | Android Chrome/iOS Safari Installation und Start                     | Standalone online nutzbar, Kamera geprüft                         |
| TT19 | Owner ändert Frist, Member versucht direkte Änderung                 | Owner erfolgreich, Member abgelehnt                               |
| TT20 | PWA offline / Logout / fremder Nutzer                                | Kein persistenter privater API-Cache                              |

### Nutzertest

Empfehlung: zwei Haushalte mit mindestens drei Personen, möglichst Familie und WG. Ohne Funktionsanleitung Aufgaben lösen: beitreten, Vorrat finden, bald fälliges Produkt erkennen, manuell und per Barcode erfassen, Teilverbrauch, Vollverbrauch, Einkauf, Reservierung/Freigabe, fremde Reservierung erkennen, Warnfrist einstellen (Owner), PWA installieren. Zeiten, Hilfe, Fehler, Scan-/Lookup-Erfolg und subjektiven Aufwand getrennt dokumentieren. Pro Aufgabe tatsächliche Beobachtung, keine erfundenen Messwerte.

Mehrtägiger Test 01.–05.12. (Vorschlag): tägliche Beteiligung, Reservierungsnutzung, nicht erfasste Produkte, Aufwand und Bestandstreue prüfen. Ziel >=90 % kontrollierter Produkte hinsichtlich Menge/Vorhandensein korrekt; alle drei Mitglieder nehmen Änderungen vor. Kein Nachweis langfristiger Food-Waste-Reduktion durch diesen Kurztest. Präsentationsmappe gemäss Aufgabenstellung bis 07.12.2026 23:59.

### Umsetzung und Definition of Done

- 25.11.: Repository, Schema, RLS, Auth, frühes PWA-/Kamera-Spike.
- 26.11.: Haushalte, Vorrat, manuelles Formular, Validierung.
- 27.11.: gemeinsames Bestands-/Reservierungsmodul, atomare Verbrauchslogik, Sync.
- 28.11.: Barcode, Open Food Facts, Ablaufhinweise und Warnfrist.
- 29.11.: Einkaufsliste, PWA-Installation, Integration, reale Gerätetests.
- 30.11.: Code Freeze, Sicherheits-/Parallelitätstests, Deployment, Fehlerkorrekturen.
- 01.12.: Release-Gate, Beginn Nutzertest.

Vier parallele Arbeitsbereiche: Backend/Auth/RLS; Vorrat/Reservierungs-UX; Erfassung/Scan/PWA; Einkauf/Integration/QA. Schema und RPC-Verträge zuerst abstimmen. Historischer Terminansatz. Der aktuelle Abhängigkeitsplan steht in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Bei Zeitnot P1 vollständig streichen, keine Sicherheitsabstriche. Nicht erfüllte P0-Kriterien explizit als Blocker dokumentieren; Teilversion nicht als vollständiges MVP ausgeben.

Done: Akzeptanzkriterien erfüllt, Datenbank real angebunden, Fehlerzustände behandelt, Tests grün, mobile Geräte geprüft, kein offener kritischer Fehler. Release nur bei allen P0 erfüllt. Dokumentiere tatsächliche Testergebnisse und Abweichungen in docs/TEST_REPORT.md und docs/IMPLEMENTATION_STATUS.md.

## 11. Quellen und Grenzen

Interne Quellen: Validierungsplakat (S. 1), Gruppe23_Projektsteckbrief (S. 1), Variantenvergleich (2.5.3–2.5.8), Leistungsnachweis (Variantenbeschreibungen), Mobile T01/T02 (15.11.), ScanStation B01–B03 (14.11.), FridgeHub T01–T03 (15.11.), FoodLight T01/T02 (15.11.), zaeme_mobile.html als UX-Referenz, Aufgabenstellung Die Höhle der Löwen V2026-02 (1.2.3). Die Prototypen wurden nicht als produktionsreife Software auditiert. Technische Implementierung, externe API-Verfügbarkeit und physische Gerätetests sind noch nicht verifiziert. Schwellenwerte, Mengenlimits, Einladungsdauer, Owner-Regeln, gemeinsame Warnfrist und Reservierungssemantik sind konkrete neue Spezifikationsentscheidungen zur Vereinfachung, keine empirisch validierten Ergebnisse. KI-unterstützter Requirements-Entwurf auf Grundlage der Projektunterlagen und PO-Entscheide; durch Projektgruppe zu prüfen.
