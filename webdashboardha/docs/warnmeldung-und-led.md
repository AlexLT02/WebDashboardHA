# Warnmeldungen, Geräte-Aktionen & LED — HA-Setup

Ab Add-on **v1.4.0** können mehrere Warnungen **gleichzeitig** aktiv sein. Das
alte Prinzip „ein Schiedsrichter entscheidet, was gezeigt wird" ist damit
abgelöst: es gewinnt niemand mehr, es kommen **alle** durch — als Laufschrift,
und die Geräte-Aktion wechselt im Takt mit dem angezeigten Text.

Die YAML-Dateien dazu liegen im Repo unter [`../ha/`](../ha/).

---

## Das Prinzip in vier Sätzen

1. Jede Warnung ist eine **Automation aus dem Blueprint „Dashboard-Warnung Pro"**.
   Sie kennt ihren Auslöser, ihren Text und ihre Geräte-Aktion — sonst nichts.
2. Aktiv werdende Warnungen tragen sich in ein **Register** aus vier Slots ein
   (`input_text.wdh_slot_1..4`). Das Register ist die einzige Wahrheit darüber,
   was gerade anliegt.
3. Eine **Rotation** (alle 5 s) setzt `input_number.wdh_index` auf den nächsten
   belegten Slot und bittet die zugehörige Automation per Event, ihre
   Geräte-Aktion zu fahren. Das Dashboard schiebt dieselbe Meldung in die Mitte
   der Laufschrift — Licht und Text bleiben so zwangsläufig synchron.
4. Bevor eine Warnung ein Gerät anfasst, wird dessen **kompletter Zustand als
   Szene gesichert** und am Ende exakt so wiederhergestellt — aber erst, wenn die
   *letzte* Warnung weg ist, die dieses Gerät belegt.

---

## Warum es bei zwei gleichzeitigen Meldungen nicht kracht

Drei Probleme, drei Antworten:

**Beide Meldungen müssen durchkommen.** Vier Slots statt einem Textfeld. Das
Dashboard liest alle Slots und rendert sie als eine Laufschrift; die aktive
Meldung steht mittig und in voller Deckkraft, die anderen ziehen gedimmt in
ihrer eigenen Dringlichkeitsfarbe vorbei. Ein Punkt-Indikator zeigt, wie viele
anliegen. **OK** quittiert nur die angezeigte Meldung, die übrigen laufen weiter.

**Beide Aktionen müssen ausgeführt werden können.** Ein LED-Strip kann nicht
gleichzeitig rot blinken und ruhig blau leuchten. Statt zu mischen, wechseln sich
die Aktionen ab: wer gerade in der Laufschrift dran ist, steuert die Geräte. Wer
gleich drankommt, hat 5 Sekunden später seinen Auftritt.

**Das Zurücksetzen darf sich nicht in die Quere kommen.** Der Snapshot entsteht
nur beim *ersten* Zugriff auf ein Gerät. Beim Beenden prüft das Register, ob noch
ein anderer belegter Slot dasselbe Gerät auflistet — wenn ja, bleibt alles wie es
ist. Erst der Letzte spielt die Szene zurück und löscht sie. Das ist
Reference-Counting, abgeleitet aus den Slots statt separat mitgezählt, also ohne
Zähler, der aus dem Tritt geraten kann.

Dazu die Absicherung darunter: **alle** Register-Änderungen laufen durch
`script.wdh_alarm_set` / `wdh_alarm_clear`, beide `mode: queued`. Zwei im selben
Moment auslösende Warnungen werden dadurch nacheinander abgearbeitet und können
sich nicht gegenseitig überschreiben.

---

## Der Blueprint

*Einstellungen → Automationen → Blueprint → **Dashboard-Warnung Pro***

### Überwachung
| Feld | Bedeutung |
|---|---|
| **Gerät / Entität** | Was überwacht wird (Dropdown) |
| **Worauf achten** | `Zustand ist gleich …` · `Wert überschreitet Schwelle` · `Wert unterschreitet Schwelle` |
| **Auslösender Zustand** | nur bei „Zustand" — z. B. `on`, `open`, `home` |
| **Schwellwert** | nur bei über/unter — z. B. `25` |
| **Muss so lange anliegen** | Mindestdauer; `0` = sofort |

### Meldung
Meldungstext und Dringlichkeit (`hinweis` hellblau · `warnung` gelb · `wichtig` rot).

### Push-Benachrichtigung
Beliebig viele Geräte mit HA-App. Die Nachricht wird mit einem festen `tag`
verschickt und beim Ende der Warnung per `clear_notification` **wieder
zurückgezogen** — sie verschwindet also von selbst vom Sperrbildschirm. Leer
lassen = keine Push.

### Geräte-Aktionen
| Feld | Bedeutung |
|---|---|
| **Geräte, die diese Warnung übernimmt** | Snapshot-/Restore-Liste. **Alles, was deine Aktion anfasst, muss hier stehen** — was fehlt, wird nicht zurückgesetzt. |
| **Was soll passieren?** | Freier Aktions-Editor: mehrere Lampen mit eigener Farbe, eine Szene, ein WLED-Preset, ein Schalter, ein Media-Player — beliebig kombinierbar. |

> **Die häufigste Falle:** Wer per `select.select_option` ein WLED-Preset setzt,
> muss auch das `select.…_voreinstellung` in die Snapshot-Liste aufnehmen, nicht
> nur das `light.…`. Sonst kommt zwar die Farbe zurück, WLED steht aber danach
> auf „kein Preset".

### Erweitert
**Nach dem Wegklicken erneut melden** (Standard: an) — besteht die Ursache noch,
meldet sich die Warnung nach spätestens 5 Minuten wieder.

---

## Register — Innenleben

| Entität | Inhalt |
|---|---|
| `input_text.wdh_slot_1..4` | `warn_id\|stufe\|text`, leer = frei |
| `input_text.wdh_slot_1..4_ents` | Geräte, die dieser Slot belegt |
| `input_number.wdh_index` | welcher Slot gerade angezeigt wird |
| `scene.wdh_snap_<entity>` | Snapshot eines belegten Geräts (kommt und geht automatisch) |

| Skript | Zweck |
|---|---|
| `script.wdh_alarm_set` | Slot belegen, Snapshot anlegen, Overlay an |
| `script.wdh_alarm_clear` | Slot freigeben, ggf. restaurieren, Melder informieren |
| `script.wdh_apply_current` | angezeigte Meldung spiegeln + Aktions-Event feuern |
| `script.wdh_rotate` | zum nächsten belegten Slot wechseln |
| `script.wdh_ack` | die *angezeigte* Warnung quittieren (OK-Button) |
| `script.wdh_reset` | Register komplett leeren (läuft beim HA-Start) |

**Grenzen, bewusst gewählt:**
- **Vier** gleichzeitige Warnungen. Die fünfte wird still verworfen — mehr als
  vier rotierende Meldungen kann ohnehin niemand lesen.
- Nach einem **HA-Neustart** wird das Register geleert (die Snapshot-Szenen
  überleben den Neustart nicht). Jede Warnung prüft 20 s nach dem Start selbst,
  ob ihre Ursache noch besteht, und meldet sich neu. Der dabei entstehende
  Snapshot ist dann allerdings der Zustand *nach* dem Neustart.
- Der Meldungstext wird bei 150 Zeichen gekappt (Slot-Kapazität).

---

## Kompatibilität

Die drei alten Helfer (`input_boolean.dashboard_alert`,
`input_text.dashboard_alert_text`, `input_select.dashboard_alert_level`) bleiben
in Betrieb:

- Der `input_boolean` **schaltet das Overlay weiterhin** — er wird jetzt vom
  Register gesetzt.
- Text und Stufe werden auf die jeweils angezeigte Meldung **gespiegelt**, damit
  ältere Dashboard-Versionen und HA-eigene Karten weiter funktionieren.
- Ist gar kein Register vorhanden (Slot-Präfix im Dashboard leer), fällt das
  Overlay auf den alten Ein-Meldungs-Betrieb zurück.

Der alte Blueprint `dashboard_warnung.yaml` bleibt unangetastet liegen; er wird
von nichts mehr benutzt und kann gelöscht werden.

---

## Prioritäts-Referenz

| Stufe | Farbe / Puls | typischer Anlass |
|---|---|---|
| `wichtig` | rot, schnell | Wasserleck, Rauch |
| `warnung` | gelb, mittel | Kühlschrank offen, Fenster bei Regen |
| `hinweis` | hellblau, langsam | Waschmaschine fertig, Post da |

Die Stufe bestimmt Farbe und Puls-Tempo — **nicht** mehr, wer gewinnt. Alle
aktiven Meldungen werden gezeigt.
