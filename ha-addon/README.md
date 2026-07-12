# HA-Add-on — Hinweise

Das Add-on-Manifest liegt bewusst im **Repo-Root**, nicht hier:

- `../config.yaml` — Add-on-Manifest (Ingress, Port 8099, /data-Volume)
- `../Dockerfile` — Multi-Stage-Build (Node baut Frontend → Python-Runtime)
- `../.dockerignore`

**Grund:** Der HA-Supervisor baut ein Add-on mit Build-Kontext = Add-on-Verzeichnis.
Das Dockerfile muss `frontend/` und `backend/` erreichen — beide liegen im Root.
Läge das Dockerfile in `ha-addon/`, käme der Build nicht an den Quellcode.

## Lokale Installation als Add-on (HA OS)
1. Repo nach `/addons/webdashboardha/` auf dem HA-Host kopieren
   (z. B. via Samba-Add-on oder `git clone`).
2. Einstellungen → Add-ons → Add-on-Store → oben rechts „Nach Updates suchen".
3. „WebDashboardHA" erscheint unter „Lokale Add-ons" → installieren → starten.
4. Sidebar-Panel „Dashboard" öffnet die App (Ingress).
5. Kiosk am iPad: `http://<ha-host>:8099` öffnen → Teilen → „Zum Home-Bildschirm".

Dieser Ordner kann später Icon/Logo (`icon.png`, `logo.png`) und `DOCS.md`
für den Add-on-Store aufnehmen.
