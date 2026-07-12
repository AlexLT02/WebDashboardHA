# WebDashboardHA — Home-Assistant-Add-on-Repository

Steuerbares, iPad-Air-1-taugliches Web-Dashboard für Home Assistant, ausgeliefert
als HA-Add-on. Enthält ein Add-on: **WebDashboardHA** (Ordner `webdashboardha/`).

## Installation (als Add-on-Repository)

1. In Home Assistant: **Einstellungen → Add-ons → Add-on-Store**.
2. Oben rechts **⋮ → Repositories**.
3. Diese Repo-URL einfügen und hinzufügen:
   ```
   https://github.com/AlexLT02/WebDashboardHA
   ```
4. Der Store lädt neu → unten erscheint **WebDashboardHA** → **Installieren**.
   (Erster Build dauert ein paar Minuten: Frontend wird gebaut, Backend-Deps installiert.)
5. **Starten**, dann **„In Seitenleiste anzeigen"** aktivieren (Ingress-Panel).

## Bedienung

- **Ingress-Panel** (Sidebar): Dashboard ansehen/bedienen; Editor folgt in Phase 2.
- **iPad-Kiosk**: im Safari `http://<ha-host>:8099` öffnen → Teilen →
  „Zum Home-Bildschirm" → Vollbild ohne URL-Leiste.

Im Add-on-Betrieb wird **kein Token** benötigt — der Zugriff läuft automatisch über
den `SUPERVISOR_TOKEN`.

## Technik

React + TypeScript (Vite, `@vitejs/plugin-legacy` für Safari 12) ↔ FastAPI ↔
Home Assistant WebSocket/REST. Details siehe [`PROJEKT.md`](PROJEKT.md) und
[`webdashboardha/`](webdashboardha/).
