# Steward Robot — Interface Mobile

Application web standalone (HTML/JS pur) pour piloter le TurtleBot3 depuis un smartphone.
Aucun serveur Node.js requis — ouvrir directement dans le navigateur ou servir avec `python3 -m http.server`.

## Structure

```
steward-robot/
  step-0-connect/     ← Connexion + état du robot (batterie, IMU, topics)
  step-1-motors/      ← Contrôle moteurs (D-Pad + joystick)
  step-2-sensors/     ← LiDAR overlay + flux caméra
  step-3-control/     ← Pilotage complet (caméra + radar + joystick + HUD)
  lib/
    rosbridge.js      ← Client rosbridge partagé (roslibjs)
```

## Usage

```bash
cd steward-robot
python3 -m http.server 8888
```

Puis ouvrir `http://YOUR_PC_IP:8888/step-0-connect/` sur le smartphone.

## Prérequis robot

- rosbridge lancé sur le robot : port 9090
- Même réseau WiFi que le smartphone
