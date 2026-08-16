# Warnmeldungen, Geräte-Aktionen & LED — HA-Setup

Ab Add-on **v1.4.0** können mehrere Warnungen **gleichzeitig** aktiv sein. Das
alte Prinzip „ein Schiedsrichter entscheidet, was gezeigt wird" ist damit
abgelöst: es gewinnt niemand mehr, es kommen **alle** durch — als Laufschrift,
und die Geräte-Aktion wechselt im Takt mit dem angezeigten Text.

Die YAML-Dateien dazu liegen im Repo unter [`../ha/`](../ha/).

---

## Das Prinzip in vier Sätzen

1. Jede Warnung ist eine **Automation aus dem Blueprint „Dashboard-Warnung"**.
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

*Einstellungen → Automationen → Blueprint → **Dashboard-Warnung***

Pflichtfelder sind **zwei**: die Entität und der Meldungstext. Alles andere hat
brauchbare Vorgaben und ist eingeklappt.

### 1 · Wann soll gewarnt werden?
| Feld | Bedeutung |
|---|---|
| **Gerät / Entität** | Was überwacht wird (Dropdown) |
| **Bedingung** | `ist an / offen / erkannt` · `ist aus / zu / nicht erkannt` · `Zahlenwert > Schwelle` · `Zahlenwert < Schwelle` · `Zustand ist genau …` |
| **Schwellwert** | nur bei größer/kleiner |
| **Eigener Zustand** | nur bei „genau …" — der technische Wert, z. B. `playing`, `heat` |
| **Muss so lange anliegen** | Mindestdauer; `0` = sofort |

> **Warum kein Textfeld mehr für den Zustand:** HA zeigt bei einer Tür „Offen",
> intern heißt der Zustand aber `on`. Wer „open" eintippt, baut eine Automation,
> die aussieht als würde sie funktionieren und nie auslöst — genau daran ist die
> erste Fassung gescheitert. Die beiden ersten Dropdown-Punkte prüfen deshalb
> gegen eine Liste (`on`/`open`/`home`/`detected`/`playing`/`unlocked`/… bzw.
> `off`/`closed`/`not_home`/`idle`/`locked`/…), Groß-/Kleinschreibung egal.
> HA kann die Zustände eines Geräts leider nicht als Dropdown anbieten:
> `!input` ist im `state`-Selector nicht erlaubt (getestet, HA 2026.8).

### 2 · Meldung
Meldungstext und Dringlichkeit (`hinweis` hellblau · `warnung` gelb · `wichtig` rot).

### 3 · Push aufs Handy
Beliebig viele Geräte mit HA-App. Die Nachricht wird mit einem festen `tag`
verschickt und beim Ende der Warnung per `clear_notification` **wieder
zurückgezogen** — sie verschwindet also von selbst vom Sperrbildschirm. Leer
lassen = keine Push.

Der Dienstname `notify.mobile_app_<gerät>` entsteht aus dem Gerätenamen **zum
Zeitpunkt der Registrierung**; ein späteres Umbenennen in HA ändert ihn nicht
mit. Der Blueprint versucht deshalb beide Namen und ruft mit
`continue_on_error` — der falsche läuft ins Leere statt die Warnung abzubrechen.

### 4 · Geräte-Aktion
Freier Aktions-Editor: mehrere Lampen mit eigener Farbe, eine Szene, ein
WLED-Preset, ein Schalter, ein Media-Player — beliebig kombinierbar. Optional.

**Die Snapshot-Liste pflegt sich selbst.** Der Blueprint liest die Ziel-Entitäten
aus der Aktion aus (`target`, `data`, alte `entity_id`-Schreibweise, auch eine
Ebene tief in `if`/`choose`/`repeat`) und löst Szenen auf ihre Mitglieder auf.
Diese Geräte werden vor der ersten Aktion gesichert und am Ende exakt
wiederhergestellt.

### Erweitert
| Feld | Bedeutung |
|---|---|
| **Zusätzlich sichern** | normalerweise leer. Nur für Geräte, die die Automatik nicht sehen kann — z. B. ein `light.…`, das indirekt über ein WLED-Preset mitgeschaltet wird, oder etwas, das ein aufgerufenes Skript anfasst. |
| **Nach dem Wegklicken erneut melden** | Standard an — besteht die Ursache noch, meldet sich die Warnung nach spätestens 5 Minuten wieder. |

---

## Eingerichtete Warnungen (Stand 2026-08-16)

| Automation | Auslöser | Bedingung | Stufe | Dauer |
|---|---|---|---|---|
| Dashboard-Warnung Pro | `binary_sensor.kuelschrank_sensor_kuhlschrank_tur` | ist an / offen | wichtig | 2 min |
| Warnung · Gefrierfach offen | `binary_sensor.kuelschrank_sensor_gefrierfach_tur` | ist an / offen | wichtig | 2 min |
| Warnung · Wäsche fertig | `sensor.waschmaschine_zustand` | genau `clean` | hinweis | 0 |

Alle drei fahren dasselbe WLED-Preset-Muster (`Wichtig` bzw. `Hinweis` auf
`select.ipad_backlights_controller_voreinstellung`) und pushen aufs iPhone.

Die Wäsche-Warnung hängt an der **WashData**-Integration (HACS, `ha_washdata`),
die aus dem Verbrauch der Tuya-Steckdose `sensor.spiegel_leistung` Zyklen
erkennt. Ihr Zustand `clean` steht für „fertig, aber noch nicht ausgeräumt" und
bleibt anliegen, bis die Maschine geleert ist — deshalb passt er ins Register:
das Overlay verschwindet erst mit der Wäsche. „Nach dem Wegklicken erneut
melden" ist hier bewusst **aus**, sonst nervt ein Hinweis alle 5 Minuten.

---

## Selbst testen, ohne auf den Auslöser zu warten

**Nur das Overlay** — *Entwicklerwerkzeuge → Aktionen*, `script.wdh_alarm_set`:

```yaml
warn_id: test.manuell
text: Testmeldung
stufe: wichtig
entities: []
```

Wieder weg mit `script.wdh_alarm_clear` (`warn_id: test.manuell`) oder per **OK**
am iPad.

**Die ganze Kette inklusive Push und LED** — *Entwicklerwerkzeuge → Zustände*,
die überwachte Entität suchen, Zustand auf `on` setzen, „Zustand überschreiben".
Nach der eingestellten Mindestdauer muss alles kommen. Zurück auf `off` beendet
es wieder. Der echte Zustand kommt beim nächsten Update des Geräts von selbst
zurück.

**Wenn nichts passiert** — die Automation öffnen, *Traces* (⋮ → Ablaufverfolgung).
Dort steht, welcher Zweig gelaufen ist und woran eine Bedingung gescheitert ist.

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

**Auslöse-Logik, einmal statt dreimal:** die Bedingung steckt in *einem*
`template`-Trigger mit `for:` (Mindestdauer) — nicht mehr in drei parallelen
`state`/`numeric_state`-Triggern plus einer „passt der Trigger zum Modus"-Prüfung.
Dieselbe Logik braucht die Automation auch außerhalb des Triggers (Selbstheilung,
Nachnerven, „Ursache weg?"), Trigger-Templates sehen `variables` aber nicht.
Gelöst über einen YAML-Anker `&aktiv` auf dem Trigger-Template plus dieselben
vier Eingabewerte in `trigger_variables` **und** `variables` — der Ausdruck
existiert dadurch nur an einer Stelle und kann nicht auseinanderlaufen.

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

**Umbenannte Blueprint-Eingaben** (nur relevant, wenn noch Automationen aus der
ersten Fassung existieren — HA meldet dann „unbekannte Eingabe"):

| alt | neu |
|---|---|
| `modus` + `zielzustand` | `bedingung` (Dropdown) + `eigener_zustand` |
| `aktion_entitaeten` | `extra_entitaeten` — meist leer, wird automatisch ermittelt |

Betroffene Automationen einmal öffnen, Felder neu setzen, speichern.

---

## Prioritäts-Referenz

| Stufe | Farbe / Puls | typischer Anlass |
|---|---|---|
| `wichtig` | rot, schnell | Wasserleck, Rauch |
| `warnung` | gelb, mittel | Kühlschrank offen, Fenster bei Regen |
| `hinweis` | hellblau, langsam | Waschmaschine fertig, Post da |

Die Stufe bestimmt Farbe und Puls-Tempo — **nicht** mehr, wer gewinnt. Alle
aktiven Meldungen werden gezeigt.
