# Steward Robot — Interface Mobile

Application web standalone (HTML/JS pur) pour piloter le TurtleBot3 depuis un smartphone.
Aucun serveur Node.js requis — ouvrir directement dans le navigateur ou servir avec `python3 -m http.server`.

## Structure

```
steward-robot/
  step-0-connect/     ← Connexion + état du robot (batterie, IMU, topics)
  step-1-motors/      ← Contrôle moteurs (D-Pad + joystick)
  step-2-sensors/     ← LiDAR overlay + flux caméra
  step-3-control/     ← Pilotage complet (caméra + radar + joystick + SLAM map)
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

## Step-by-Step Guide

### Step 0 — Connect (`step-0-connect/`)

Verify the robot is reachable and check system health.

1. Open the page and enter the rosbridge URL: `ws://<ROBOT_IP>:9090`
2. The page auto-detects available ROS topics and shows connection status
3. Displays battery level, IMU orientation, and topic list

### Step 1 — Motors (`step-1-motors/`)

Test motor control before adding sensors.

1. Use the D-Pad (up/down/left/right) or virtual joystick to send velocity commands
2. Publishes `geometry_msgs/msg/TwistStamped` to `/cmd_vel`
3. Emergency stop button kills all motion instantly

### Step 2 — Sensors (`step-2-sensors/`)

Verify LiDAR and camera feeds.

1. LiDAR radar overlay shows obstacle distances in real time (subscribes to `/scan_reliable`)
2. Camera feed from MJPEG stream on port 8080
3. Distance markers at 0.5m intervals on the radar

### Step 3 — Full Control (`step-3-control/`)

Complete piloting interface with all features combined.

**Layout (landscape/PC):** Camera feed (top 45%) + live SLAM map (bottom 55%) on the left, console log + joystick on the right.

**Features:**
- Camera feed with MJPEG stream
- LiDAR radar overlay with distance rings
- Virtual joystick for teleoperation
- Telemetry cards: LiDAR distances (front/back/left/right), IMU (roll/pitch/yaw), battery percentage
- ROS console log showing all data flowing to/from the robot (filterable)
- Live SLAM map built from LiDAR scans + odometry

**SLAM Map:**
- Built client-side from `/scan_reliable` (LiDAR) and `/odom` (odometry)
- Uses probabilistic log-odds occupancy grid — walls strengthen with repeated observations, ghost marks from odometry drift fade automatically
- Pan (drag), zoom (+/- buttons), and clear (Effacer button)
- Resolution: 2.5cm per cell, 10m x 10m coverage
- Color coding: bright = confirmed wall, dark = confirmed free space, background = unknown

**ROS Topics Used:**
| Topic | Type | Purpose |
|-------|------|---------|
| `/cmd_vel` | `TwistStamped` | Velocity commands from joystick |
| `/scan_reliable` | `LaserScan` | LiDAR data for radar + SLAM map |
| `/odom` | `Odometry` | Robot position for SLAM map |
| `/imu` | `Imu` | IMU orientation data |
| `/battery_state` | `BatteryState` | Battery percentage |
| `/rosout` | `Log` | ROS log messages for console |
