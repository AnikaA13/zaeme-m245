# Testplan

## Aktuell

- `npm run test` führt die Tests einmal aus. Die zwei Rauchtests prüfen
  die sichtbare Überschrift, den Entwicklungsstatus und die Rückkehrmöglichkeit
  bei einer unbekannten Adresse. Der Komponententest löst einen Renderfehler
  aus und prüft die Fehleransicht und die zugängliche Neuladeschaltfläche.
- Für einen lokalen Lauf bei `spawn EPERM` in der Windows-Sandbox steht
  `npm run test -- --pool=threads` zur Verfügung. Den Standardlauf mit
  `npm run test` in einer regulären lokalen Shell oder auf GitHub Actions prüfen.
- `npm ci` installiert die Abhängigkeiten aus der Sperrdatei.
  `npm run typecheck`, `npm run lint`, `npm run format:check` und
  `npm run build` prüfen Typen, Regeln, Formatierung und Bündelung.
- Zur lokalen Browserprüfung ohne Supabase-Konfiguration `npm run dev`
  starten. Die Startseite und eine unbekannte Adresse bei 320 px und auf einem
  breiten Bildschirm öffnen. Mit der Tabulatortaste den sichtbaren Fokus
  prüfen und den Link zur Startseite auslösen.
- Nach einem erfolgreichen Build mit `npm run preview` die gerenderte
  Startseite und die direkt aufgerufene Fehlroute im Browser prüfen. Den
  Abruf und den Inhalt des Web-App-Manifests separat kontrollieren.
- Für die Browserprüfung der Neuladeaktion lokal vorübergehend einen
  Renderfehler in einem Kind der Fehlergrenze auslösen. Die Meldung prüfen,
  «Seite neu laden» auslösen und den Dokumentabruf im Netzwerk-Tab verfolgen.
  Anschliessend die temporäre Änderung zurücknehmen.
- Für die spätere Installationsprüfung die App über HTTPS auf den vorgesehenen
  Android- und iOS-Geräten installieren und vom Startbildschirm öffnen.

## Geplant

Unit-Tests für fachliche Regeln, Komponenten- und Integrationstests für
Benutzungsabläufe sowie Datenbanktests für Haushaltsisolation und RLS.
Playwright kann später echte Anmelde- und Haushaltsabläufe, mehrere
Browserbreiten, Tastaturbedienung und PWA-Verhalten prüfen. Das Projekt
verwendet stabile Routen und semantische Rollen als Ansatzpunkte.
Playwright-Installationen und Testkonten folgen mit dem ersten relevanten
End-to-End-Ablauf. Die Ignore-Regeln decken Berichte und lokale Sitzungen ab.
