# Warnmeldung (Overlay) & LED-Priorisierung — HA-Setup

Zwei Bausteine, ein gemeinsames Prinzip: **ein Schiedsrichter entscheidet, was gerade
gezeigt wird** — bei der Bildschirm-Warnung wie bei der WLED-Statusleiste. Mehr
Sensoren bedeuten *nicht* mehr Helfer, sondern nur mehr Einträge in der Prioritätsliste.

---

## Teil 1 — Das Overlay

Das Dashboard zeigt eine Vollbild-Warnung, sobald ein `input_boolean` an ist. Die
Sichtbarkeit ist eine **reine Ableitung** aus drei Helfern — das Overlay hat keinen
eigenen Zustand:

| Helfer | Bedeutung | Default-entity_id |
|---|---|---|
| `input_boolean` | an = anzeigen | `input_boolean.dashboard_alert` |
| `input_text` | Meldungstext | `input_text.dashboard_alert_text` |
| `input_select` | Dringlichkeit | `input_select.dashboard_alert_level` |

Stufen (Optionen des `input_select`): **`wichtig`** (rot) · **`warnung`** (gelb) ·
**`hinweis`** (hellblau). Groß/Klein und Synonyme (`critical`, `info`, `rot`/`gelb`/`blau`)
werden vom Frontend toleriert; Unbekanntes fällt auf `warnung`.

> Die entity_ids sind im Dashboard unter **Einstellungen → „Warnmeldung — HA-Helfer"**
> frei einstellbar. Wer die Defaults nutzt, muss dort nichts ändern.

**Woraus folgt das gewünschte Verhalten von selbst:**
- **OK-Button** ruft `turn_off` auf den Switch → Overlay weg.
- **Switch geht extern aus** (Automation) → Overlay weg. Gleicher Effekt, kein Sonderfall.
- Neuer Text/neue Stufe bei laufendem Alarm → Overlay zeigt sofort die neue Meldung.

### Helfer anlegen

Per UI (*Einstellungen → Geräte & Dienste → Helfer*) oder in `configuration.yaml`:

```yaml
input_boolean:
  dashboard_alert:
    name: Dashboard-Alarm anzeigen

input_text:
  dashboard_alert_text:
    name: Dashboard-Alarm Text
    max: 120

input_select:
  dashboard_alert_level:
    name: Dashboard-Alarm Stufe
    options:
      - hinweis
      - warnung
      - wichtig
    initial: hinweis
```

### Bequemes Setzen per Skript

Ein Helfer-Skript setzt Text, Stufe und Switch in einem Rutsch — alle Automationen
rufen nur noch dieses auf:

```yaml
script:
  set_dashboard_alert:
    alias: Dashboard-Alarm setzen
    mode: queued
    fields:
      text: { description: Meldungstext, example: "Kühlschrank steht offen!" }
      level: { description: "wichtig | warnung | hinweis", example: warnung }
    sequence:
      - service: input_text.set_value
        target: { entity_id: input_text.dashboard_alert_text }
        data: { value: "{{ text }}" }
      - service: input_select.select_option
        target: { entity_id: input_select.dashboard_alert_level }
        data: { option: "{{ level | default('warnung') }}" }
      - service: input_boolean.turn_on
        target: { entity_id: input_boolean.dashboard_alert }
```

### Schnellstart: eine Quelle (mit Auto-Clear)

Reicht, solange praktisch immer nur *eine* Sache gleichzeitig alarmiert:

```yaml
automation:
  # Waschmaschine fertig → Hinweis
  - alias: "Alarm: Waschmaschine fertig"
    trigger:
      - platform: state
        entity_id: sensor.waschmaschine_phase   # dein Sensor
        to: "done"
    action:
      - service: script.set_dashboard_alert
        data: { text: "Waschmaschine ist fertig.", level: hinweis }

  # Kühlschrank > 2 min offen → Warnung
  - alias: "Alarm: Kühlschrank offen"
    trigger:
      - platform: state
        entity_id: binary_sensor.kuehlschrank_tuer
        to: "on"
        for: "00:02:00"
    action:
      - service: script.set_dashboard_alert
        data: { text: "Kühlschrank steht offen!", level: warnung }

  # Auto-Clear: Tür wieder zu → Overlay verschwindet ohne OK
  - alias: "Alarm aus: Kühlschrank wieder zu"
    trigger:
      - platform: state
        entity_id: binary_sensor.kuehlschrank_tuer
        to: "off"
    action:
      - service: input_boolean.turn_off
        target: { entity_id: input_boolean.dashboard_alert }
```

Der Haken beim Schnellstart: schalten mehrere Quellen gegeneinander, „gewinnt" die
zuletzt gefeuerte — es gibt keine echte Priorität, und ein Auto-Clear der einen Quelle
löscht auch die Meldung einer anderen. Sobald du mehr als ein, zwei Quellen hast → Teil 2.

---

## Teil 2 — Der Schiedsrichter (empfohlen)

Eine einzige Automation entscheidet per **Prioritätsliste**, was im Slot steht — und
kann in einem Aufwasch die WLED-Leiste mitsteuern. Neue Quelle = ein Listeneintrag.

```yaml
automation:
  - alias: "Dashboard-Alarm Schiedsrichter"
    id: dashboard_alert_arbiter
    trigger:
      # Alle Quellen, die mitreden dürfen:
      - platform: state
        entity_id:
          - binary_sensor.wasserleck_kueche
          - binary_sensor.kuehlschrank_tuer
          - sensor.waschmaschine_phase
      # Optional: alle 5 min neu bewerten, damit ein per OK weggeklickter, aber
      # noch offener Kühlschrank wieder nachnervt.
      - platform: time_pattern
        minutes: "/5"
    variables:
      # Reihenfolge = Priorität (oben schlägt unten). Nur `active` zählt.
      candidates:
        - active: "{{ is_state('binary_sensor.wasserleck_kueche','on') }}"
          text: "Wasserleck in der Küche!"
          level: wichtig
          led: alarm
        - active: "{{ is_state('binary_sensor.kuehlschrank_tuer','on') }}"
          text: "Kühlschrank steht offen!"
          level: warnung
          led: fridge_open
        - active: "{{ is_state('sensor.waschmaschine_phase','done') }}"
          text: "Waschmaschine ist fertig."
          level: hinweis
          led: wash_done
      winner: >
        {% set ns = namespace(w=none) %}
        {% for c in candidates if c.active and ns.w is none %}
          {% set ns.w = c %}
        {% endfor %}
        {{ (ns.w | to_json) if ns.w else '' }}
    action:
      - choose:
          - conditions: "{{ winner != '' }}"
            sequence:
              - variables:
                  w: "{{ winner | from_json }}"
              - service: script.set_dashboard_alert
                data: { text: "{{ w.text }}", level: "{{ w.level }}" }
              # LED gleich mitziehen (Preset-Name = w.led, siehe Teil 3):
              - service: select.select_option
                target: { entity_id: select.wohnzimmer_wled_preset }
                data: { option: "{{ w.led }}" }
        default:
          # Nichts aktiv → Overlay aus, LED zurück auf Ambient
          - service: input_boolean.turn_off
            target: { entity_id: input_boolean.dashboard_alert }
          - service: select.select_option
            target: { entity_id: select.wohnzimmer_wled_preset }
            data: { option: idle }
```

Damit ist deine Ausgangsfrage beantwortet: **Kühlschrank-offen (gelb) schlägt
Waschmaschine-läuft, aber ein Wasserleck (rot) schlägt alles** — allein über die
Reihenfolge in `candidates`. Kein Mischen, sondern ein klarer Stack.

---

## Teil 3 — Die WLED-Leiste

Ein Strip zeigt zu einem Zeitpunkt nur *einen* Zustand. „Mischen" ginge technisch nur
über WLED-**Segmente** (Kreis in Bögen teilen) — für einen kleinen Status-Ring aber
schwer ablesbar. Empfehlung: **nicht mischen, priorisieren** (Teil 2).

**Presets statt Effekt-Parameter:** Lege die Animationen einmalig in der WLED-Oberfläche
als **Presets** an (Farbe + Effekt + Geschwindigkeit), z. B.:

| Preset-Name | Anlass | Optik |
|---|---|---|
| `idle` | nichts los | Ambient, gedimmt / aus |
| `wash_running` | Waschmaschine läuft | ruhiges Blau, langsam |
| `wash_done` | fertig | Blau, Blink/Pulse |
| `fridge_open` | Tür zu lange offen | Gelb, Pulse |
| `alarm` | Wasserleck/Rauch | Rot, schnelles Blinken |

HA steuert sie über die WLED-Integration per **`select.<name>_preset`** (Option =
Preset-Name), wie oben im Schiedsrichter gezeigt. Alternativ per Preset-Nummer über
`number.<name>_preset`.

**Status vs. Alert — wichtige Trennung fürs Ablesen:**
- *Status* (Waschmaschine **läuft**) = ruhiges Ambient, darf überschrieben werden.
- *Alert* (Waschmaschine **fertig** / Kühlschrank offen) = auffällig, bleibt bis erledigt.

Wer LED und Overlay getrennt halten will, baut statt des kombinierten Schiedsrichters
einen reinen **Template-Sensor** nur für die LED:

```yaml
template:
  - sensor:
      - name: LED Signal
        state: >
          {% if is_state('binary_sensor.wasserleck_kueche','on') %}alarm
          {% elif is_state('binary_sensor.kuehlschrank_tuer','on') %}fridge_open
          {% elif is_state('sensor.waschmaschine_phase','done') %}wash_done
          {% elif is_state('sensor.waschmaschine_phase','running') %}wash_running
          {% else %}idle{% endif %}
```

…und eine Automation reagiert auf `sensor.led_signal` → `select.select_option` mit dem
gleichnamigen Preset. Priorität steckt wieder allein in der Reihenfolge der `elif`.

---

## Prioritäts-Referenz

| Stufe (Overlay-Farbe) | typischer Anlass | LED-Preset |
|---|---|---|
| `wichtig` — rot, schnell | Wasserleck, Rauch | `alarm` |
| `warnung` — gelb, mittel | Kühlschrank offen, Fenster bei Regen | `fridge_open` … |
| `hinweis` — hellblau, langsam | Waschmaschine fertig, Post da | `wash_done` … |

Höchste aktive Stufe/Quelle gewinnt. Genau eine Meldung liegt gleichzeitig auf dem
Bild — ein Vollbild-Overlay, das „alles überdeckt", kann sinnvoll nicht zwei Dinge
gleichzeitig zeigen.
