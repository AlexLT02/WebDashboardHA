# HA-Seite des Warnsystems

Diese vier Dateien gehören **nicht** ins Add-on, sondern in die
Home-Assistant-Konfiguration. Sie sind hier versioniert, damit das Setup
reproduzierbar bleibt.

| Datei | Ziel in HA | Wie einspielen |
|---|---|---|
| `wdh_helpers.yaml` | Inhalt an `configuration.yaml` anhängen | danach *Entwicklerwerkzeuge → YAML → Eingabetext* **und** *Zahl* neu laden |
| `wdh_scripts.yaml` | Inhalt nach `scripts.yaml` | *YAML → Skripte* neu laden |
| `wdh_automations.yaml` | Inhalt an `automations.yaml` anhängen | *YAML → Automationen* neu laden |
| `dashboard_warnung_pro.yaml` | `blueprints/automation/webdashboard/` | wird beim Automations-Reload erkannt |

Kein HA-Neustart nötig — alle vier Bereiche sind reloadbar.

Die Funktionsweise (Register, Rotation, Snapshot/Restore, Blueprint-Felder)
steht in [`../docs/warnmeldung-und-led.md`](../docs/warnmeldung-und-led.md).
