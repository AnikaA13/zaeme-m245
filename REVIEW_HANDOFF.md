# zäme · Technische Übergabe zum Haushaltstest

**Teilnehmerfreigabe gesperrt.** Die integrierte App ist lokal mit synthetischen Haushalten geprüft. Für den geplanten 1. Dezember 2026 fehlen das identifizierte Hosted-Testprojekt, das Deployment, reale Mailzustellung und die physische Abnahme auf Android und iPhone. Es gibt keine freigegebene Testadresse. Der Gruppenentscheid sowie G01–G08 bleiben offen.

| Quelle | Branch                                   | Commit  | Nachweis des damaligen Stands                                                                                  |
| ------ | ---------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| 008    | feature/m4-core-inventory-ux, PR #4      | 03389b3 | 103 Vitest, 243 pgTAP, 27 Browsergruppen                                                                       |
| 009A   | feature/m5-shopping-realtime-backend     | d2459cb | 35 Vitest, 307 pgTAP, 21 HTTP-Fachszenarien, fünf Einkaufsszenarien, ein WebSocket-Szenario, 17 Browsergruppen |
| 009B   | feature/m5-shopping-realtime-integration | f21ee83 | Merge b48e0bb enthält 009A, 104 Vitest, 34 Browsergruppen plus sieben separat                                  |
| 010A   | feature/m6-barcode-lookup-core           | 835a7b4 | 85 Vitest, davon 50 zum Scannerkern, optische Videofixture und einzelne Live-Abfragen                          |
| 010B   | feature/m6-scanner-integration           | a8d8e2b | Merge b6b8885 enthält 010A, 161 Vitest, 33 Browsergruppen                                                      |
| 011A   | feature/m7-hosted-test-infrastructure    | a58b0d1 | 35 Vitest und acht lokale Gast-Routen, kein Hosted-Projekt nachgewiesen                                        |
| 011B   | integration/m7-user-test-release         | f248df0 | Funktionscommit mit PWA und Produktsuche. Basis a17f15d, Integrationsmerges 6a2cf96, 316edb0 und 39642bb.      |

[Lokale Testzahlen, Messungen und Befunde](docs/TEST_REPORT.md) · [Anforderungsmatrix](docs/IMPLEMENTATION_STATUS.md) · [Screenshots und Rohmessungen](docs/review/task011b) · [Teilnehmeranleitung, Geräte- und Freigabeliste](docs/USER_TEST_RELEASE.md) · [Hosted-Migrationsvertrag](docs/HOSTED_TEST_VERTRAG.md)

Der lokal geprüfte PR-Kandidat ist `1066454ef6859721145e277efcedc848d11acb07`. Das [GitHub-Prüfprotokoll zu PR #5](https://github.com/AnikaA13/zaeme-m245/pull/5/checks) führt die wirklichen Prüfläufe und Resultate.

Der lokale Lauf verwendete ausschliesslich den Wegwerfstack `zaeme-task011-local`. Das Archiv enthält weder dessen Schlüssel noch Sitzungen, Bestätigungsmails oder Einladungslinks. Der letzte Abschnitt im ausgelieferten ZIP nennt den zum Verpackungszeitpunkt tatsächlich verifizierten GitHub-Stand.

## Frühere Übergaben

[009B](docs/TASK_009B_HANDOFF.md) · [010B](docs/TASK_010B_HANDOFF.md) · [011A](docs/TASK_011A_HANDOFF.md)
