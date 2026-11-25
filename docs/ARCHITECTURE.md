# Architektur

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

## Offene Entscheidungen

- Anmeldeverfahren, Sitzungsablauf, Haushaltsmitgliedschaft und Rollen.
- Minimales Datenmodell, RLS-Regeln und Realtime-Anforderungen.
- Navigation, freigegebene Markenressourcen und PWA-Installation.
- Offlineumfang, Cache-Verhalten und Umgang mit gleichzeitigen Änderungen.
