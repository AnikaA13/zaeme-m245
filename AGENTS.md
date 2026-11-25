# zäme – Project Instructions

## Project context

zäme is a school project for the GBS-Höhle der Löwen in Switzerland.

The product helps households with three or more members manage shared groceries, inventory, expiry dates, reservations and shopping lists with minimal additional effort.

Die geprüfte lokale UX- und Markenreferenz liegt unter `~/Downloads/Hoehle-der-Loewen-final (1)/Hoehle-der-Loewen/Prototyp/zaeme_mobile.html`. Der Checkout enthält weder den Prototyp noch eine separate Original-Logodatei.

## Technology

- React
- TypeScript
- Vite
- Supabase Auth, PostgreSQL and Realtime
- ZXing or an appropriate maintained barcode-scanning library
- Open Food Facts
- PWA
- Vercel-compatible deployment

Check current library compatibility before adding dependencies.

## Product priorities

Prioritize a working shared inventory, authentication, household membership, simple inventory management, expiry visibility and secure data access.

Scan, Einkaufsliste, Reservierungen und Installation gehören zur P0-Abnahme.

Do not introduce unrelated features without explicit approval.

## UI and UX

- All user-facing content must use Swiss Standard German.
- Use the existing zäme logo and brand colours.
- Mobile-first responsive design.
- Keep inventory maintenance fast and intuitive.
- Barcode scanning must always have a manual fallback.
- Make consuming an item clearly distinguishable from reserving it.
- Provide accessible controls and meaningful error feedback.
- Avoid unnecessary animations and decorative complexity.

## Engineering

- Use strict TypeScript.
- Keep components focused and reusable.
- Avoid hardcoded production data.
- Validate user input.
- Handle loading, empty, error and success states.
- Use database migrations for schema changes.
- Enforce household isolation using Row Level Security.
- Never expose service-role keys or other secrets in frontend code.
- Do not commit secrets.
- Do not silently remove existing features.
- Use Git to preserve working versions.

## Quality and documentation

Vor jeder Umsetzung Repository und Vorgaben prüfen. Für Schulvorgaben gilt die offizielle Aufgabe. Danach gelten die jüngsten ausdrücklichen PO-Entscheide, docs/MVP_SPEC.md für Geschäftsregeln und Abnahme, docs/UX_SPEC.md für Gestaltung und Interaktion und docs/CODEX_HANDOFF.md als Zusammenfassung. Prototypen und Tests sind historische Evidenz. docs/PROJECT_STATUS.md führt den Ist-Stand. Anforderungs-IDs erhalten, Widersprüche, Blockaden und ungeprüfte Funktionen ausdrücklich melden. Oberfläche und Projektdokumentation in Schweizer Standarddeutsch verfassen.

After every significant change:

1. Run relevant lint, typecheck, build and test commands.
2. Report which commands actually ran and their results.
3. Document changed functionality and known limitations.
4. Update docs/PROJECT_STATUS.md and docs/CHANGELOG.md.
5. Record important architectural decisions in docs/DECISIONS.md.
6. List manual verification steps where automated verification is unavailable.

Never claim that a feature works if it has not been verified. Clearly distinguish implemented, tested, simulated and planned functionality.

Do not fabricate user feedback or test results.

## Deadline

The target for a stable user-test version is December 1, 2026.

The school presentation portfolio is due December 7, 2026.

Prioritize a stable and demonstrable MVP over additional experimental features.
