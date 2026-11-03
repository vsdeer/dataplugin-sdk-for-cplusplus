# Snake – Webapp

Ein klassisches Snake-Spiel als reine Webapp (HTML, CSS, JavaScript – ohne Abhängigkeiten oder Build-Schritt).

## Starten

`index.html` direkt im Browser öffnen – oder einen kleinen lokalen Server verwenden:

```sh
cd snake-webapp
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Steuerung

| Aktion          | Tastatur                | Touch                          |
|-----------------|-------------------------|--------------------------------|
| Bewegen         | Pfeiltasten oder WASD   | Wischen oder Steuerkreuz       |
| Pause / Weiter  | Leertaste oder `P`      | Mittlere Taste im Steuerkreuz  |
| Start / Neustart| Enter oder Leertaste    | Button „Spiel starten“         |

## Features

- 20×20-Spielfeld mit flüssiger (interpolierter) Bewegung
- Punkte steigen pro Level; alle 5 Futterstücke wird das Spiel schneller
- Highscore wird im Browser gespeichert (`localStorage`)
- Optional: „Durch Wände gehen“ und drei Grundgeschwindigkeiten
- Automatische Pause, wenn der Tab in den Hintergrund wechselt
- Hell-/Dunkelmodus passend zur Systemeinstellung, mobil-tauglich
