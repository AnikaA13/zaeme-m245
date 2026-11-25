# zäme — UX/UI implementation specification

**Product:** zäme – Vorrat und Einkauf für den ganzen Haushalt

**Project:** GBS – Höhle der Löwen, Group 23, M245

**Version:** 1.1 · 25. November 2026
**Audience:** Codex Prompt Engineer, Codex, developers and UX reviewers

**Status:** Implementation baseline; proposed defaults require team review, not a claim of formal design approval.

## 1. Status, scope and decision authority

Die Fachregeln und Prioritäten stehen in [MVP_SPEC.md](MVP_SPEC.md). Diese Spezifikation beschreibt Gestaltung und Bedienung. Die Gruppenprüfung steht aus.

| Label    | Meaning                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQUIRED | Explicit project/user requirement or established product scope; implement for the agreed MVP.                                                                      |
| DEFAULT  | Concrete design decision proposed in the latest UX concept. Use as the implementation baseline unless the team changes it; formal group approval is not evidenced. |
| OPTIONAL | Enhancement; do not block the MVP or add it without scope approval.                                                                                                |
| OPEN     | Decision or feasibility question still requiring verification; document the chosen resolution.                                                                     |

The chosen product is **zäme Mobile**, not ScanStation, FridgeHub or FoodLight. Primary audience: households of three or more people, especially families and shared flats. Do not prohibit smaller households or require three members before use.

### 1.1 Required product scope and delivery order

- **P0** umfasst alle im MVP als P0 gekennzeichneten Funktionen, darunter echte Authentifizierung, Haushalt, persistenter Vorrat, Scan, Einkauf, Reservierungen, Warnfrist, Synchronisierung und Installation.
- **P1** umfasst frühere Produkte, intelligente Feldvorschläge, zusätzliche Filter, geführte Einkaufsübernahme und Push nach stabiler P0-Abnahme.
- Rezepte, Bon-/Datums-OCR, eigene Kategorien/Icons, Nährwerte, mehrere Haushalte und vollständige Offline-Synchronisierung sind ausgeschlossen.

Alle sichtbaren Produktaktionen verwenden echte Daten und bestätigte Schreibvorgänge.

## 2. Evidence and source references

The original project files are the authority for historical observations and visual identity. Filenames below are the supplied source names; their eventual repository locations may differ. Keep originals unchanged. Do not expose test participant details in public application assets.

| Source                                                                                                                          | Relevance                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `zaeme_mobile.html`                                                                                                             | Primary interaction and visual reference: overview, stock, shopping, household, scan and reservation dialogs.      |
| `Gruppe23_Projektsteckbrief.pdf`, p. 1                                                                                          | Official problem statement, logo, violet/mint/cream visual reference, shared household motivation.                 |
| `Validierungsplakat_Lebensmittelmanagement.pdf`, p. 1                                                                           | Earlier validation: focus on stock and expiry rather than another list, no scan requirement, target households 3+. |
| `Variantenvergleich_zäme.docx`, sections 2.5.4–2.5.8                                                                            | Comparison, choice of Mobile, limitations and next steps.                                                          |
| `Leistungsnachweis_zäme.docx`                                                                                                   | Description of the four prototype concepts.                                                                        |
| `zaeme_scanstation.html`, `zaeme_fridgehub.html`, `zaeme_foodlight.html`                                                        | Secondary UX and colour references only.                                                                           |
| `zaeme_Prototypentest_Mobile_App_TO1.docx`, `zaeme_Prototypentest_Mobile_App_TO2.docx`                                          | Mobile T01/T02, 15 November 2026.                                                                                  |
| `zäme_scanstation_B01.docx`, `zäme_scanstation_B02.docx`, `zäme_ScanStation_B03.docx`                                           | ScanStation B01–B03, 14 November 2026.                                                                             |
| `zaeme_Prototypentest_FridgeHub_T01.docx`, `zaeme_Prototypentest_FridgeHub_T02.docx`, `zaeme_Prototypentest_FridgeHub_T03.docx` | FridgeHub T01–T03, 15 November 2026.                                                                               |
| `zaeme_Prototypentest_FoodLight_T01.docx`, `zaeme_Prototypentest_FoodLight_T02.docx`                                            | FoodLight T01/T02, 15 November 2026.                                                                               |

### 2.1 Evidence-to-design traceability

| ID    | Historical observation                                                                                                        | Implementation consequence                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| UX-01 | Mobile T01 rated estimated maintenance effort 4/5; T02 2/5.                                                                   | Pflichtfelder begrenzen, Scan und Verbrauch kurz halten. Wiederverwendung ist P1.                                             |
| UX-02 | Both Mobile participants reached stock through expiry items rather than bottom navigation; both completed tasks without help. | Preserve actionable overview; make stock navigation obvious. This is an improvement opportunity, not proof navigation failed. |
| UX-03 | Mobile T01 found Reserve before Consume.                                                                                      | Make Consume the primary action; separate the semantics.                                                                      |
| UX-04 | Mobile T02 initially explored to understand the purpose.                                                                      | One concise welcome explanation, no mandatory tutorial.                                                                       |
| UX-05 | Mobile T02 emphasised that all members must participate.                                                                      | Frictionless invitation and genuine shared state.                                                                             |
| UX-06 | ScanStation B02 did not immediately understand confirmation after scanning.                                                   | Explicit review and single clear save button.                                                                                 |
| UX-07 | ScanStation B03 did not immediately find scan area; B01 liked scan/manual options.                                            | Prominent scan entry; manual alternative always available.                                                                    |
| UX-08 | ScanStation B01/B03 considered stock and expiry views redundant.                                                              | One inventory with expiry filter.                                                                                             |
| UX-09 | FridgeHub T02 accidentally marked an item fully consumed; T03 wanted undo.                                                    | Vollverbrauch bestätigen und Ergebnis anzeigen.                                                                               |
| UX-10 | FridgeHub T02/T03 criticised unsuitable units; T02 noted fractional packages.                                                 | Unit-aware numeric validation.                                                                                                |
| UX-11 | FridgeHub T01 preferred direct date entry; T03 found date editing cumbersome.                                                 | Editable date input with keyboard and picker.                                                                                 |
| UX-12 | Both FoodLight participants understood colours but lacked product identity and quantity; effort 4/5 each.                     | Combine text, colour, item name and quantity; no colour-only warning.                                                         |
| UX-13 | Mobile T01 wanted prior products reusable and easier storage selection.                                                       | Wiederverwendung und Vorschläge als P1 prüfen.                                                                                |
| UX-14 | Mobile T02 liked reservations; FridgeHub T03 wanted member assignment.                                                        | Keep reservations visible but secondary.                                                                                      |
| UX-15 | ScanStation B01 found missing quantity/date constraints and uneditable MHD.                                                   | Validate inputs and allow date correction.                                                                                    |
| UX-16 | FridgeHub T01/T02 reported misleading icons.                                                                                  | Use neutral icon if no reliable product-specific icon exists.                                                                 |

**Evidence limits:** ten prototype test runs (2 Mobile, 3 ScanStation, 3 FridgeHub, 2 FoodLight); the two Mobile participants also tested FoodLight. These were short concept tests, not ten distinct confirmed users. Actual camera recognition, cross-device synchronisation, long-term adoption and food waste reduction were not validated. Individual Mobile task durations were not measured. Do not invent measurements or claim the proposed changes are validated.

Earlier validation proposed removing reservations; subsequent Mobile testing and the current explicit requirements retain them. Keep them secondary, without a dedicated navigation tab. Shopping remains in scope but inventory and expiry are the product's central value.

### 2.2 Existing Mobile source audit

`zaeme_mobile.html` contains a simulated phone frame, status bar, localStorage state, predefined scan products and an embedded SVG logo. Relevant functions include `home`, `stock`, `shopping`, `household`, `scanResultHTML`, `renderModal`, `saveStock` and `saveReservation`. Reuse their interaction concepts, not necessarily their code or storage model. The stylesheet contains older green definitions and later brand overrides (including #1C1840, #4B3FA8, #CBEDD6, #FEFDF3 and #FF7A7A). Consolidate these into the canonical proposed tokens below. Some existing text and icon controls are small; the target app replaces them with accessible sizes. This is a static source review, not a runtime or new usability test.

## 3. Design principles

1. **Less maintenance than benefit:** make common actions short; avoid repeated metadata entry.
2. **Actionable overview:** identify the actual products requiring attention, not only a count.
3. **Scan-first, never scan-only:** camera entry is prominent; manual entry remains equally capable.
4. **Clear action semantics:** consume changes quantity, reserve communicates intent, edit corrects data, delete removes an erroneous record.
5. **Shared truth:** display household membership and accurate persistence/sync status; no misleading success.
6. **Forgiving interactions:** recover from mistakes; preserve input on failure; avoid silent destructive changes.
7. **Accessible and calm:** use consistent hierarchy, plain Swiss German-standard UI copy, text plus colour, no decorative clutter.
8. **Minimal scope:** no unrelated functionality in the MVP.

## 4. Branding and design tokens

**REQUIRED:** use the original zäme logo and violet, mint, cream, restrained coral brand identity. **DEFAULT:** the following canonical tokens harmonise the supplied prototypes; they are proposed values, not a pixel-perfect logo measurement. Do not recolour the original logo.

```css
:root {
  color-scheme: light;
  --color-brand-dark: #1c1840;
  --color-primary: #4b3fa8;
  --color-primary-hover: #3d3295;
  --color-primary-soft: #ede9fa;
  --color-mint: #cbecd6;
  --color-coral: #ff7a7a;
  --color-background: #fbf9f1;
  --color-surface: #ffffff;
  --color-border: #e8e5e9;
  --color-control-border: #91899f;
  --color-text: #1c1840;
  --color-text-secondary: #625d76;
  --color-success: #227451;
  --color-success-bg: #dff4e7;
  --color-warning: #855112;
  --color-warning-bg: #fff0ca;
  --color-danger: #a12b38;
  --color-danger-bg: #ffe4e7;
  --color-neutral-bg: #eeedf0;
  --font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-size-caption: 0.875rem;
  --font-size-body: 1rem;
  --font-size-heading: 1.25rem;
  --font-size-page-title: 1.75rem;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-input: 12px;
  --radius-button: 12px;
  --radius-card: 16px;
  --radius-dialog: 24px;
  --touch-target-min: 44px;
  --button-height: 48px;
  --shadow-card: 0 2px 8px rgba(28, 24, 64, 0.05);
}
```

Use primary violet for primary actions and active navigation, dark violet for text, mint for supportive surfaces, cream for the app canvas, and white for cards/forms. Coral is a decorative accent, not a default error or text colour. Use darker semantic status foregrounds on pale semantic backgrounds. Verify contrast in actual rendered states, including focus and input boundaries.

### 4.1 Typography (DEFAULT)

| Role                             | Size at 16px root |                Weight | Line height |
| -------------------------------- | ----------------: | --------------------: | ----------: |
| Page title                       |              28px |                   700 |        1.25 |
| Section heading                  |              20px |                   600 |        1.35 |
| Body, field input, button        |              16px | 400 / 600 for actions |  1.5 / 1.25 |
| Label, caption, product metadata |              14px |               400–600 |        1.45 |

Use relative text units and allow wrapping. Never hide required information in tiny text. Use Inter if available and appropriately licensed; otherwise use the system stack. No font download is required to make the UI functional.

### 4.2 Spacing and layout (DEFAULT)

- 4px base grid; use 16px page padding, 12–16px card padding, 8–12px internal gaps and 24px section gaps.
- Compact single-column product rows; avoid oversized hero banners and decorative statistics above expiry items.
- One dominant action per task surface; secondary actions remain visibly distinct.
- Use subtle card shadows and borders, not heavy gradients. Keep consistent corner radii.
- Full viewport app layout; remove the prototype's fake handset, notch and status bar.
- Fixed/sticky bottom navigation for top-level screens, with content clearance and safe-area padding. Dialogs and full-screen tasks must not expose unrelated navigation actions behind them.
- No nested scrolling for ordinary pages. Keep form actions reachable when keyboard is open.

## 5. Information architecture and navigation

**PO-Entscheid vom 25.11.2026:** Fünf beschriftete Einträge in dieser Reihenfolge: **Start, Vorrat, Hinzufügen, Einkauf, Haushalt**. Hinzufügen ist die hervorgehobene mittlere Aktion für echten Scan und manuelle Erfassung. Abbruch stellt Herkunftsziel und Fokus wieder her. Nur das aktive der vier dauerhaften Ziele erhält `aria-current`. Safe-Area-Abstand, lesbare Beschriftungen und mindestens 44 × 44 CSS-px je Eintrag auch bei 320 px prüfen.

| Entry      | Screen / action                                             | Suggested route (not required) |
| ---------- | ----------------------------------------------------------- | ------------------------------ |
| Start      | Übersicht mit Ablaufhinweisen, Scan und manueller Erfassung | `/`                            |
| Vorrat     | Inventory, search, filters                                  | `/inventory`                   |
| Hinzufügen | Scanner / manual capture                                    | `/add`                         |
| Einkauf    | Shared shopping list                                        | `/shopping`                    |
| Haushalt   | Mitglieder, Einladungen, Profil und Warnfrist               | `/household`                   |

Other suggested routes: `/welcome`, `/auth`, `/household/create`, `/household/join`, `/inventory/:id`, `/inventory/:id/edit`. Consume and reserve can be modal routes or accessible bottom sheets.

- No separate top-level expiry or reservations tab. Overview expiry link opens inventory with the matching filter; the complete inventory link clears that filter.
- Use the same product details component from every entry point.
- Preserve search/filter/scroll state when returning from a detail screen. Browser back and native back must behave predictably.
- Unauthenticated users enter welcome/auth; users without membership enter create/join; active members enter overview. Preserve invitation intent across authentication.

## 6. Screen-by-screen requirements

Alle Produktansichten verwenden echte Daten. German labels below are the UI copy baseline. Routes and sheet presentation are DEFAULT, not mandatory implementation technology.

### S01 — Welcome / authentication

- Original logo; title «Gemeinsam alles im Blick.»; one sentence: «Wisst, was ihr zu Hause habt, was bald abläuft und was ihr noch einkaufen müsst.»
- Primary «Haushalt erstellen», secondary «Haushalt beitreten», link «Anmelden».
- Request only necessary identity data and display name. No compulsory multi-page tutorial. Returning signed-in members skip welcome.
- E-Mail/Passwort mit Registrierung, Anmeldung, Abmeldung, Passwortreset und gültiger persistenter Sitzung. Nach einem Anmeldefehler bleibt die Beitrittsabsicht erhalten.

### S02 — Create / join household

- Create: household name, submit, then overview; invitation available without requiring immediate invitations.
- Join: accept invite link or code; display intended household name after safe verification; confirm membership; then overview.
- Reject invalid/expired/revoked invitations, prevent duplicate membership and unauthorized access. Explain how to request a new invitation.
- Die Datenbank erlaubt höchstens einen Haushalt pro Konto. Onboarding ohne Haushalt und Gründung zu zweit oder alleine sind möglich.

### S03 — Overview

- Kopfbereich mit Originallogo und aktivem Haushaltsnamen. Haushaltsverwaltung über den fünften Navigationseintrag öffnen.
- First content section: «Bald verbrauchen» / «Haltbarkeitsdaten prüfen» with two or three most urgent entries, sorted by date, expired first. Show name, quantity, status and relevant date type. For past use-by dates, safety wording replaces consumption encouragement.
- «Alle Ablaufhinweise anzeigen» opens the urgent inventory filter, including overdue entries.
- Prominent «Lebensmittel scannen» action; visible «Manuell hinzufügen» alternative.
- Direct link «Gesamten Vorrat anzeigen» and compact shopping access. Counts, if shown, count inventory entries or open shopping items consistently and are explicitly labelled; never replace product detail with counts.
- Empty/unknown-date states must not imply all food is safe. Do not force scrolling past a large decorative banner to see the next urgent product.

### S04 — Inventory

- Title «Vorrat»; add action; labelled search by product name; list of shared inventory entries.
- Suche und Fristfilter für den Link von Start anbieten. Zusätzliche Filter und Sortieroptionen folgen als P1 gemäss F14.
- Default ordering: overdue, nearest date, later dates, unknown last; stable secondary ordering by name/ID. Alternative alphabetical sort.
- Each row: product name, quantity/unit, storage if known, labelled expiry status, reservation owner and quantity if present; accessible detail link.
- Same product with different expiry dates must remain distinguishable (separate lots or explicit grouped subrows). Do not merge incompatible dates/units/reservations.
- Preserve search, filters and scroll on return. No result state offers clearing filters.

### S05 — Barcode scanner

- Full-screen task with title «Lebensmittel hinzufügen», back, live preview, scan frame and «Halte den Barcode in den Rahmen.»
- Request camera permission only on entry to scan; prefer rear camera; automatically decode supported barcodes without a shutter button.
- Stop/pause scanning on successful decode; prevent repeated frames creating duplicates. Release camera on close, route change and manual fallback. Flashlight only if device supports it.
- Display recognition/loading feedback, then open S06 with known metadata. Unknown product or lookup failure opens manual capture with barcode and any verified values retained.
- «Manuell erfassen» remains visible and functional regardless of camera permission or lookup status. Offer retry and settings guidance if appropriate.
- Real camera support depends on secure context and supported browsers; never substitute a fake scan as production success.

### S06 — Add / review product

- Header «Produkt prüfen» after recognition; «Lebensmittel hinzufügen» for manual path.
- Name, Menge, Einheit und Pflichtkategorie bearbeiten. Lagerort, Datum mit Datumsart und Barcode sind optional. Frühere Produktdaten erst mit P1 übernehmen.
- Display «Produkt erkannt» only on genuine product lookup success; a decoded unknown barcode is not a recognised product.
- One primary button «Zum Vorrat hinzufügen»; no automatic save on scan. On confirmed persistence: «[Produkt] wurde zum Vorrat hinzugefügt.» with «Weiter scannen» and «Zum Vorrat».
- Vorschläge aus früher erfassten Produkten gehören zu P1. Optional fields must not block save; unknown date is explicit. Keep data on failed save.

### S07 — Product details

- Back, product name, storage, quantity/unit, exact date and status, total/reserved/free quantity, members holding reservations.
- Primary «Verbrauchen» (or a neutral removal action for expired use-by items); secondary «Bearbeiten» and «Reservieren», visually and semantically distinct.
- Secondary text action «Auf Einkaufsliste setzen». Deletion of erroneous entries only via edit with confirmation.
- Display updates from other devices; if item was removed, explain and return to inventory safely.

### S08 — Edit product

- Reuse S06 form with current values. Primary «Änderungen speichern».
- Changing name/date/storage must not inadvertently change consumption history or another lot.
- Reduktion unter die reservierte Summe sperren. Einheit und Kategorie erst nach Freigabe aller Reservierungen wechseln.
- Vor Verwerfen ungesicherter Änderungen warnen. Fehlerhaften Eintrag nur nach Bestätigung und ohne aktive Reservierungen löschen.

### S09 — Consume (sheet/dialog or screen)

- «Wie viel hast du verbraucht?» with available total, unit, quantity control and primary «Verbrauch bestätigen».
- Default 1 for discrete units; choose sensible step for weight/volume, bounded by remaining quantity. «Alles verbraucht» fills full amount for explicit confirmation.
- Jeder Vollverbrauch erfordert eine ausdrückliche Bestätigung, auch beim letzten einzelnen Stück.
- Eigene Reservierung zuerst abbauen, danach freien Bestand. Fremde Reservierungen sind auch für den Owner geschützt.
- Bestätigte Menge anzeigen. Bei null verschwindet die Charge aus dem aktiven Vorrat. Bei überschrittenem Verbrauchsdatum auf das Datum hinweisen und keinen Verzehr empfehlen.

### S10 — Reserve (sheet/dialog or screen)

- Nur Menge für das angemeldete Mitglied wählen. Eigene Reservierung ändern oder freigeben.
- Show total, already reserved and remaining free quantity. Prevent total reservations exceeding stock.
- Display «[Menge] für [Name] reserviert» in stock/details. Allow reservation editing/release with clear confirmation where relevant.
- Die Gesamtmenge bleibt beim Reservieren unverändert. Ein Vollverbrauch mit fremder Reservierung ist gesperrt.

### S11 — Shopping list

- «Einkaufsliste»; open items, quantity/unit, add/edit and checkbox with accessible item name.
- Checked items move to «Eingekauft» and can be reactivated. Checking does not create inventory automatically.
- P1: Geführte Übernahme öffnet das vorbefüllte Formular. Erst ein bestätigter Speichervorgang erstellt Vorrat.
- Product detail can add shopping entry; no silent merging that changes user-entered quantity. No recipes/budget features.

### S12 — Household and profile

- Active household name, actual members and own identity; no simulated member switcher.
- Nur Owner erstellen und widerrufen Einladungen, entfernen andere Mitglieder und bearbeiten die gemeinsame Warnfrist.
- Anzeigename ändern, austreten oder abmelden. Austritt/Entfernung gibt eigene Reservierungen atomar frei. Der Owner bleibt, solange weitere Mitglieder da sind. Allein kann er den Haushalt ausdrücklich bestätigt auflösen.

## 7. Components and interaction contract

| Component                | Required behaviour / default appearance                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| PrimaryButton            | Violet with white text, min 48px height, 12px radius; loading/disabled states; one per task context.              |
| SecondaryButton          | White or pale surface, violet label; equivalent touch target.                                                     |
| DangerButton             | Red semantic style; reserved for destructive actions, not ordinary consumption.                                   |
| IconButton               | Min 44×44px hit area, accessible name, visible focus; never icon-only for ambiguous main actions.                 |
| ProductRow               | Compact white row; stable information hierarchy; full detail target; no nested buttons inside links.              |
| StatusBadge              | Text plus semantic colour/icon; may wrap; noninteractive unless explicitly a filter.                              |
| ReservationBadge         | Owner and amount, distinct from expiry status; no implied stock reduction.                                        |
| QuantityStepper          | Minus, editable numeric input, plus; step and bounds based on unit; no silent rounding.                           |
| DateInput                | Visible label, keyboard entry and date picker; display DD.MM.YYYY; associated date type and unknown option.       |
| SearchInput / FilterChip | Clear label, clear action, selected state exposed semantically; accessible keyboard interaction.                  |
| BottomNavigation         | Icon and visible label, fixed placement, active state, safe-area handling.                                        |
| HouseholdControl         | Labelled current household access; not a fake account switch.                                                     |
| BottomSheet / Dialog     | Accessible name, focus trap, background inert, escape/back/close, return focus; handle long content and keyboard. |
| Snackbar                 | Ergebnis nach bestätigter Speicherung zugänglich ansagen, Fokus beibehalten.                                      |
| EmptyState               | Explain specific empty condition; offer relevant next action.                                                     |
| Skeleton                 | Preserve layout; decorative skeleton hidden from assistive tech; loading announced separately.                    |
| ErrorMessage             | Inline field or page-level message with concrete recovery action.                                                 |

Use consistent icons (Lucide suggested, not required). A neutral food/package symbol is preferable to wrong product imagery. No essential action relies on emoji, hover, swiping, drag or colour alone. Disable only when action cannot proceed; explain unmet conditions. Avoid duplicate submissions with pending states and idempotent operations.

## 8. User flows and target effort

| Flow        | Normal path                                                                         | Recovery / alternate path                                                                          |
| ----------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Scan        | Add → camera decode → metadata review → amount/date → save → next scan or inventory | permission denied, unknown barcode or lookup failure → manual form with retained values            |
| Manual      | Hinzufügen → manuell → Name → Menge/Einheit → Datum oder unbekannt → speichern      | inline validation; keep draft on network failure                                                   |
| Find expiry | Overview → urgent item or all warnings → details/filtered inventory                 | no warnings → show unknown-date caveat and inventory link                                          |
| Verbrauchen | Detail → Menge → bestätigen                                                         | Bei Vollverbrauch ausdrücklich Gesamtmenge bestätigen, bei fremder Reservierung Menge korrigieren. |
| Edit        | Detail → Edit → change fields → save → detail                                       | invalid values or reservation conflict → correct; cancel with dirty form warning                   |
| Reservieren | Detail → eigene Menge → bestätigen                                                  | Freie Menge prüfen, eigene Reservierung ändern oder freigeben.                                     |
| Shopping    | Shopping → add/check → checked section → optional transfer to stock                 | uncheck/retry without duplicate transfer                                                           |
| Create      | Welcome → authenticate → name household → create → overview                         | failed create → preserve name and retry                                                            |
| Join        | Invite link/code → authenticate if needed → confirm household → overview            | invalid invite → request replacement; preserve valid invite through sign-in                        |

Für die nächste Messung gelten G01–G08 aus [MVP_SPEC.md](MVP_SPEC.md). Zeiten, Hilfestellungen und Fehler getrennt protokollieren. Bisher liegen für diese Ziele keine Abnahmewerte vor.

## 9. Inputs, validation and domain behaviour

| Field                         | Default / source                    | Validation                                                                                            |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Name                          | Manuell oder aus bestätigtem Lookup | Getrimmt 1–100 Zeichen.                                                                               |
| Menge                         | 1                                   | Positiv, höchstens 9999.                                                                              |
| Einheit                       | Stück                               | Stück und Packung ganzzahlig, kg und Liter bis drei Nachkommastellen. Unzulässige Präzision ablehnen. |
| Datumsart                     | Leer                                | Bei Datum MHD, Verbrauchsdatum oder unbekannt wählen. Keine Ableitung aus EAN.                        |
| Datum                         | Leer                                | Vergangen zulässig, über fünf Kalenderjahre voraus bestätigen, über zwanzig ablehnen.                 |
| Storage                       | Suggested where known               | Optional: Kühlschrank, Gefrierfach, Vorratsschrank, Sonstiges, Nicht angegeben.                       |
| Kategorie                     | Sonstiges                           | Pflichtfeld. Kombinationen mit Einheit gemäss AK10.2 prüfen.                                          |
| Barcode                       | Actual decoded value                | Optional for manual; retain as string, including leading zeros. Validate supported format.            |
| Reserve quantity              | 1 or smaller available amount       | Positive, valid precision/unit, total reservations ≤ stock.                                           |
| Mitglied                      | Aktuelle Person                     | Reservierung nur für sich selbst.                                                                     |
| Haushaltsname und Anzeigename | Eingabe                             | Getrimmt 1–100 Zeichen.                                                                               |
| Invite                        | Link or code                        | Server verification; expiry/revocation; no access merely from client-side matching.                   |

Swiss locale `de-CH`, German UI without ß. Accept common decimal input using comma or dot where unambiguous, normalise safely, store numeric values without floating-point drift. Display dates DD.MM.YYYY; store date-only values (e.g. ISO YYYY-MM-DD). Use local calendar-day arithmetic, not elapsed hours; verbindliche Haushaltszeitzone Europe/Zurich. Validate on both client and server.

### 9.1 Expiry semantics (DEFAULT)

| Day difference (date minus today) | Visual state            | Copy examples                                         |
| --------------------------------- | ----------------------- | ----------------------------------------------------- |
| Negative                          | Red                     | «MHD überschritten» / «Verbrauchsdatum überschritten» |
| 0                                 | Amber                   | «Heute»                                               |
| 1 bis warning_days                | Gelb                    | «Morgen» oder Anzahl Tage                             |
| Grösser als warning_days          | Neutraler Datumshinweis | «Noch 7 Tage»                                         |
| Unknown                           | Neutral                 | «Kein Datum erfasst»                                  |

Der Fristfilter umfasst vergangene Daten und heute bis heute + warning_days einschliesslich. Die gemeinsame Frist beträgt standardmässig 3 Tage, erlaubt sind ganze Werte von 0 bis 30. Nur der Owner ändert sie. Bei Tageswechsel in Europe/Zurich, Fokus oder Friständerung neu berechnen. MHD und Verbrauchsdatum separat benennen. Ein Status garantiert keine Lebensmittelsicherheit.

### 9.2 Shared data and consistency requirements

- Distinguish reusable product metadata from inventory lots, each with quantity, unit, date type/date and household ownership. Reservations reference the actual lot and household member.
- Persist actual user identity, household membership, inventory, reservations and shopping state. Household authorization enforced on the server; no cross-household leaks.
- Use atomic stock/reservation modifications and concurrency checks. Do not permit negative stock, stale overwrite, or duplicate operations caused by retries.
- Offline Eingaben im RAM halten und als ungespeichert kennzeichnen. Veraltete Daten sichtbar markieren. Kein privater persistenter Cache und keine Schreibqueue. Bei Fokus und Wiederverbindung neu laden.
- Undo ist bis zu einem späteren PO-Entscheid zurückgestellt.
- Never expose secret keys or real participant personal data in frontend/demo assets.

## 10. Responsive behaviour

**REQUIRED:** mobile-first usability. **DEFAULT:** 320–599px single column; wider screens may centre content with a sensible maximum width, retaining hierarchy and available actions. Desktop layout may enhance readability but must not mimic a fixed phone shell.

- Test widths 320, 375, 390, 430px, portrait and landscape; additionally test tablet/desktop and actual iOS/Android camera paths where available.
- No unintended horizontal scrolling, clipped labels, overlapped controls or hidden primary actions. Wrap filters; allow product text to grow.
- Use viewport safe-area insets and dynamic viewport sizing; navigation must not cover the last item or keyboard. Dialogs scroll internally only when necessary.
- At 200% text scaling and 320px reflow, retain content and functionality. Avoid fixed-height text cards.

## 11. Accessibility

Target WCAG 2.2 AA (not a certification). Project touch-target rule of 44×44 CSS px is a stricter design default than the general AA minimum.

- Minimum 4.5:1 normal-text contrast; 3:1 large text and necessary non-text UI indicators. Test actual foreground/background pairs, including focus. Do not depend on colour alone.
- Semantic headings, landmarks, buttons, links, form labels and meaningful accessible names. Use `lang="de-CH"`; accessible product image alt or decorative empty alt.
- Full keyboard operation, visible focus, logical tab order, no traps outside intended modal focus management. Focus restoration after closing dialogs; focus must not be obscured by sticky navigation.
- Associate inline error messages with fields, announce async success/error/status using appropriate live regions. Use accessible names for checkboxes and quantity controls.
- Respect `prefers-reduced-motion`; avoid flashing scan animations and forced gestures. No mandatory camera interaction.
- Allow password managers/paste if applicable; do not introduce unnecessary cognitive authentication tasks. Provide sufficient time for recovery actions.
- Automated checks plus keyboard, screen reader, zoom/reflow and real-device manual checks are required before claiming conformance.

## 12. Loading, empty, error and success states

| Context                     | State / example copy                                                              | Recovery / behaviour                                                      |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Initial inventory load      | «Vorrat wird geladen …» + skeleton                                                | Do not show false empty state; retry on failure.                          |
| Refresh                     | Existing data remains visible                                                     | Show stale status when appropriate.                                       |
| Save pending                | «Wird gespeichert …»                                                              | Prevent duplicate submissions; retain draft.                              |
| Lookup pending              | «Produkt wird gesucht …»                                                          | Cancel/manual path remains available.                                     |
| Unknown barcode             | «Dieses Produkt wurde nicht gefunden.»                                            | Manual capture, keep code.                                                |
| Camera denied               | «zäme hat keinen Zugriff auf deine Kamera.»                                       | Manual entry / permission guidance.                                       |
| Decode failure              | «Der Barcode konnte nicht gelesen werden.»                                        | Retry / manual.                                                           |
| Network failure             | «Keine Verbindung. Bitte prüfe den Stand nach der Wiederverbindung.»              | Retain input; retry; reconcile ambiguous server outcome before repeating. |
| Invalid quantity            | «Gib eine gültige Menge ein.»                                                     | Explain unit/bounds near field.                                           |
| Invalid date                | «Bitte überprüfe das Datum.»                                                      | Correct date; choose unknown if appropriate.                              |
| Invalid invite              | «Diese Einladung ist ungültig oder abgelaufen.»                                   | Request new invite.                                                       |
| Concurrent edit             | «Der Bestand wurde inzwischen geändert.»                                          | Refresh latest data, preserve proposed edits where safe.                  |
| Empty inventory             | «Euer Vorrat ist noch leer.»                                                      | «Lebensmittel hinzufügen».                                                |
| Keine fälligen Daten        | «Innerhalb eurer Warnfrist sind keine erfassten Daten fällig oder überschritten.» | Produkte ohne Datum separat ausweisen.                                    |
| Unknown dates               | «Für diese Lebensmittel wurde noch kein Datum erfasst.»                           | Review/edit.                                                              |
| No search matches           | «Keine passenden Lebensmittel gefunden.»                                          | Clear filters/search.                                                     |
| No reservations             | «Momentan ist nichts reserviert.»                                                 | Return to inventory.                                                      |
| Empty shopping              | «Ihr habt momentan nichts auf der Einkaufsliste.»                                 | Add item.                                                                 |
| Sole member                 | «Lade die anderen Mitglieder deines Haushalts ein.»                               | Invite.                                                                   |
| Successful add              | «[Produkt] wurde zum Vorrat hinzugefügt.»                                         | Continue scan or inventory.                                               |
| Successful consume          | «[Menge] [Produkt] verbraucht.»                                                   | Bestätigte Menge anzeigen.                                                |
| Successful reservation/edit | «Reservierung gespeichert.» / «Änderungen gespeichert.»                           | Updated product detail.                                                   |

No dead-end error pages or placeholder actions. A user can always navigate back or choose a recovery route. Do not use error styling for normal empty states.

## 13. UX acceptance criteria

Alle Kriterien sind ungeprüft. P1-Kriterien sind als solche bezeichnet und liegen ausserhalb der P0-Abnahme.

| ID    | Pass condition                                                                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Start, Vorrat, Hinzufügen, Einkauf, Haushalt sind bei 320 px mit Text, Icon, Safe Area und bedienbarer Trefferfläche erreichbar. Hinzufügen öffnet die Erfassung, Abbruch führt zurück. |
| AC-02 | Aktives Ziel ist sichtbar und semantisch markiert. Haushalt ist direkt über den fünften Eintrag erreichbar.                                                                             |
| AC-03 | Overview shows actual most urgent items immediately; no oversized decorative hero hides them.                                                                                           |
| AC-04 | Expiry link opens correct urgent filter; complete inventory link shows all stock.                                                                                                       |
| AC-05 | Supported physical smartphone camera decodes a real supported barcode.                                                                                                                  |
| AC-06 | Unknown code opens manual form retaining barcode; no fabricated metadata.                                                                                                               |
| AC-07 | Manual capture succeeds without camera permission.                                                                                                                                      |
| AC-08 | Recognised fields can be edited before saving.                                                                                                                                          |
| AC-09 | No fabricated or previous-lot expiry automatically saved; unknown date works.                                                                                                           |
| AC-10 | Repeated camera frames and duplicate submits do not create unintended duplicate stock.                                                                                                  |
| AC-11 | Same product with two expiry dates remains distinguishable.                                                                                                                             |
| AC-12 | Consume is visually primary in normal product details; Edit and Reserve distinct.                                                                                                       |
| AC-13 | Partial and full consumption update quantity and active list accurately.                                                                                                                |
| AC-14 | Vollverbrauch verlangt auch bei einem unreservierten Einzelstück eine ausdrückliche Bestätigung, Abbruch lässt den Bestand unverändert. Undo ist zurückgestellt.                        |
| AC-15 | Product quantity, date and metadata are editable and persist.                                                                                                                           |
| AC-16 | Invalid/nonpositive quantities and negative inventory are blocked client/server.                                                                                                        |
| AC-17 | Discrete units reject fractions; weight/volume accepts valid decimals.                                                                                                                  |
| AC-18 | Reservation does not reduce total stock.                                                                                                                                                |
| AC-19 | Reserved and free amounts and actual member names are visible; release works.                                                                                                           |
| AC-20 | Fremde Reservierungen bleiben geschützt. Verbrauch oberhalb der persönlich verfügbaren Menge wird auch beim Owner abgelehnt.                                                            |
| AC-21 | New authenticated user creates household and reaches overview.                                                                                                                          |
| AC-22 | Second user joins via valid invite, including after authentication redirect.                                                                                                            |
| AC-23 | Two devices with distinct users in same household see shared stock and changes.                                                                                                         |
| AC-24 | Persisted changes survive reload and sign-in again.                                                                                                                                     |
| AC-25 | Gleichzeitige Mutationen erzeugen weder negative Mengen noch verlorene Änderungen.                                                                                                      |
| AC-26 | User from unrelated household cannot read or mutate household records.                                                                                                                  |
| AC-27 | Shopping item add/edit/check works across members.                                                                                                                                      |
| AC-28 | Checked shopping item can be reactivated.                                                                                                                                               |
| AC-29 | P1: Geführte Einkaufsübernahme verlangt Bestätigung. P0: Abhaken erzeugt keinen Vorrat.                                                                                                 |
| AC-30 | Original zäme logo matches supplied brand reference; no generic replacement.                                                                                                            |
| AC-31 | All screens use canonical tokens; no inconsistent legacy green theme.                                                                                                                   |
| AC-32 | No unintended horizontal overflow at 320/375/390/430px; responsive keyboard/safe-area checks pass.                                                                                      |
| AC-33 | Relevant touch targets ≥44×44 CSS px; primary buttons ≥48px high.                                                                                                                       |
| AC-34 | Expiry and reservation meanings are understandable without colour; MHD/use-by differentiated.                                                                                           |
| AC-35 | Labels, inline errors, keyboard focus, dialogs and screen-reader navigation work.                                                                                                       |
| AC-36 | Relevant loading, empty, error and success states implemented and distinguishable.                                                                                                      |
| AC-37 | All displayed actions work; no misleading success, fake scan or fake sync.                                                                                                              |
| AC-38 | Gestern, heute, letzte eingeschlossene und erste ausgeschlossene Datumsgrenze, null und Tageswechsel bei Frist 0, 3, 7 und 30 korrekt.                                                  |
| AC-39 | Network/camera/lookup failure preserves input and provides a fallback.                                                                                                                  |
| AC-40 | Text scaling, reflow, contrast and reduced-motion checks meet target requirements.                                                                                                      |
| AC-41 | Camera released on cancellation/navigation; flashlight hidden if unsupported.                                                                                                           |
| AC-42 | Logout/leave never deletes other household members' data; last-member behaviour explicitly defined.                                                                                     |

### 13.1 Verification deliverables

For each AC record status (PASS / FAIL / BLOCKED / NOT RUN), environment, method, observed result, evidence and issue reference. Include screenshots where useful and actual two-user integration checks. Do not mark camera hardware tests passed on the basis of mocks. Separate automated unit/integration/browser tests from manual real-device checks and future user tests. Run a multi-day household trial to assess maintenance effort and participation; do not assert reduction in food waste without evidence.

## 14. Required assets and repository organisation

| Asset                              | Source / action                                                                                                                                                        | Status                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Original zäme full logo            | Embedded SVG in `zaeme_mobile.html`; compare against project profile p. 1 and official logo master if available. Extract intact, preserve viewBox/proportions/colours. | REQUIRED; embedded SVG verified in source, independent master not supplied here.     |
| SVG/PNG variants                   | Official master or verified export of existing logo; use transparent background when appropriate.                                                                      | REQUIRED for relevant app surfaces; exact filenames proposed below.                  |
| App icon / favicon                 | Derive from verified existing logo mark, do not invent brand redesign.                                                                                                 | REQUIRED if platform needs it; standalone icon crop approval OPEN.                   |
| UI icons                           | Consistent accessible SVG icon set; Lucide suggested.                                                                                                                  | DEFAULT; verify dependency/license.                                                  |
| Typeface                           | Inter or system font fallback.                                                                                                                                         | DEFAULT; use licensed source if bundling.                                            |
| Product imagery                    | Neutral placeholder; optional actual metadata images with permitted reuse.                                                                                             | OPTIONAL; no dependency for core flow.                                               |
| Reference prototypes and documents | Source files listed in section 2.                                                                                                                                      | Keep unchanged; store privately or reference locally if participant data is present. |

Suggested structure (adapt to existing repository):

```text
docs/UX_SPEC.md
assets/brand/zaeme-logo.svg
assets/brand/zaeme-mark.svg       # if verified/approved
assets/brand/zaeme-logo.png       # if required
src/styles/tokens.css            # or equivalent central theme
```

These paths other than `docs/UX_SPEC.md` are proposals, not existing verified repository files. The SVG embedded in Mobile is a useful extraction candidate, not proof that it is the original editable master. Do not generate a substitute. If assets cannot be verified, flag the blocker rather than falsely claiming brand fidelity.

## 15. Remaining design decisions and implementation handoff

| Decision                                                               | Status / baseline                                | What remains                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Product identity and Mobile selection                                  | REQUIRED, established                            | Preserve brand and product focus.                             |
| Manual + real barcode capture; expiry; shared household; clear actions | REQUIRED                                         | Implement and verify.                                         |
| Shopping and reservation scope                                         | REQUIRED for full MVP                            | Secondary placement; do not cut without approval.             |
| Navigation                                                             | PO: Start, Vorrat, Hinzufügen, Einkauf, Haushalt | Im nächsten Test prüfen.                                      |
| Warnfrist                                                              | P0, F19                                          | Einstellungen und Synchronisierung testen.                    |
| Canonical palette, spacing and typography                              | DEFAULT                                          | Visual review, contrast checks; original asset verification.  |
| Datum                                                                  | F08/F10                                          | Kalendergrenzen und neutrale Anzeige prüfen.                  |
| Undo                                                                   | Zurückgestellt                                   | Nur nach späterem PO-Entscheid.                               |
| Reservierungen                                                         | P0, F17                                          | Eigene vor freier Menge, Fremdmengen geschützt.               |
| Haushalt                                                               | F02                                              | Austritt, Entfernung und bestätigte Auflösung prüfen.         |
| Auth und Einladung                                                     | F01/F02                                          | E-Mail/Passwort, Ablauf und Widerruf prüfen.                  |
| Plattform                                                              | Installierbare mobile PWA                        | M0-Stack beibehalten.                                         |
| Produktdaten                                                           | Open Food Facts und EAN-13                       | Bibliothek, Abdeckung, Nutzungsbedingungen und Geräte prüfen. |
| Offline                                                                | Online-only                                      | Veralteten Stand kennzeichnen und bei Reconnect neu laden.    |
| Vorschläge                                                             | P1                                               | Nach P0 prüfen.                                               |
| Push                                                                   | P1                                               | Rezepte, OCR und eigene Kategorien liegen ausserhalb des MVP. |
| Food waste reduction and ongoing participation                         | OPEN                                             | Assess through actual household use.                          |

### Codex Prompt Engineer / Codex instructions

1. Inspect repository, original prototype and available assets. Use this document as the UX contract; do not infer missing decisions from a chat.
2. Preserve existing suitable architecture; document chosen resolutions to OPEN items and any departures from DEFAULT. Ask only when an unresolved choice materially blocks implementation or changes agreed product scope.
3. P0 vollständig prüfen. Erst anschliessend über P1 entscheiden. Reale Daten, Geräte und gemeinsame Komponenten verwenden. Historische Beobachtungen erhalten.
4. Verify each acceptance criterion with appropriate tests; document blockers and untested paths. Do not claim a feature works merely because its UI exists.
5. Deliver installation/configuration instructions, environment variable template without secrets, migrations if applicable, actual test report, changes mapped to UX-01–UX-16 and known limitations. Update this spec only when decisions are deliberately changed and recorded.

**Definition of done:** The application supports genuine shared inventory management, real scanning with manual fallback, understandable expiry and stock actions, reservations and shared shopping, using the original branding and accessible mobile UI. Required acceptance criteria are verified or explicitly reported as blocked; no blocked criterion may be represented as passed. No new user tests or formal team approval are asserted by this document.
