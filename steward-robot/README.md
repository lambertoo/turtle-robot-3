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

## Quick Start from Zero

### What you need

| Component | Purpose |
|-----------|---------|
| TurtleBot3 Waffle Pi | The robot (Pi 4 + OpenCR + LDS-03 LiDAR) |
| Laptop or PC | Serves the dashboard pages and optionally runs SLAM compute |
| Smartphone or browser | Opens the debug interface |
| WiFi network | All devices on the same network |

### 1. Set up the Raspberry Pi

Install ROS 2 Jazzy, TurtleBot3 packages, rosbridge, and camera pipeline on the Pi. Full instructions in the [main README](../README.md#fresh-raspberry-pi-setup).

Minimum packages for the steward-robot interface:

```bash
sudo apt install -y \
  ros-jazzy-turtlebot3-bringup \
  ros-jazzy-rosbridge-server
```

### 2. Launch rosbridge on the Pi

```bash
source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=waffle_pi
export LDS_MODEL=LDS-03

ros2 launch turtlebot3_bringup robot.launch.py &
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
```

Or if you've deployed the systemd service (see [main README](../README.md#4-create-systemd-service)):

```bash
sudo systemctl start turtlebot3
```

This starts rosbridge on port **9090** along with all robot nodes.

### 3. (Optional) Start the camera

For step-2 and step-3 camera feed:

```bash
mkdir -p /tmp/camera
gst-launch-1.0 libcamerasrc ! video/x-raw,width=640,height=480,framerate=15/1 \
  ! videoconvert ! jpegenc quality=70 \
  ! multifilesink location=/tmp/camera/snap.jpg max-files=1 &

mjpg_streamer -i "input_file.so -f /tmp/camera -n snap.jpg -d 0.1" \
  -o "output_http.so -w /usr/local/share/mjpg-streamer/www -p 8080" &
```

### 4. (Optional) Start scan relay

The LiDAR radar and SLAM map subscribe to `/scan_reliable` (RELIABLE QoS). The raw `/scan` topic uses BEST_EFFORT QoS which rosbridge can't bridge reliably. Run the scan relay on the Pi:

```bash
ros2 run scan_relay scan_relay_node
```

Or use the `scan_relay.py` script from `pi-deploy/`:

```bash
python3 /usr/local/bin/scan_relay.py
```

### 5. Serve the dashboard

On your laptop (same WiFi network as the robot):

```bash
cd steward-robot
python3 -m http.server 8888
```

### 6. Open in browser

On your phone or PC browser:

```
http://<LAPTOP_IP>:8888/step-0-connect/
```

Replace `<LAPTOP_IP>` with your laptop's IP on the WiFi network (e.g. `192.168.1.143`).

### 7. Connect to the robot

On the Step 0 page, enter the rosbridge URL:

```
ws://<ROBOT_IP>:9090
```

The robot IP is the Pi's IP on the WiFi network (e.g. `192.168.1.199`). If mDNS works on your network, use `ws://turtlebot3.local:9090`.

The connection URL is saved in your browser — you only need to enter it once.

### What works at each step

| Step | Minimum robot services needed |
|------|-------------------------------|
| step-0-connect | rosbridge only |
| step-1-motors | rosbridge + turtlebot3_bringup (for `/cmd_vel`) |
| step-2-sensors | rosbridge + turtlebot3_bringup + scan_relay + camera (mjpg_streamer) |
| step-3-control | rosbridge + turtlebot3_bringup + scan_relay + camera (all features) |

### Network ports

| Port | Host | Service |
|------|------|---------|
| 9090 | Robot (Pi) | Rosbridge WebSocket |
| 8080 | Robot (Pi) | MJPEG camera stream |
| 8888 | Laptop | Steward-robot HTTP server |

### Troubleshooting

**Can't connect to rosbridge?**
Check the Pi is reachable: `ping <ROBOT_IP>`. Verify rosbridge is running: `ros2 node list` should show `/rosbridge_websocket`. Check firewall isn't blocking port 9090.

**No LiDAR data on radar/map?**
The interface subscribes to `/scan_reliable`, not `/scan`. Make sure the scan relay is running. Check with: `ros2 topic list | grep scan_reliable`.

**Camera feed blank?**
Verify mjpg_streamer is running on the Pi: `curl http://<ROBOT_IP>:8080/?action=snapshot` should return a JPEG image. Check that `/tmp/camera/snap.jpg` exists and is being updated.

**Map not rendering on PC/landscape?**
Force a browser refresh (Ctrl+Shift+R). The map uses CSS Grid in landscape mode — older browsers may not support it. Chrome 80+ and Safari 14+ work.

**Map shows ghost walls that don't clear?**
This is normal during fast rotations — the log-odds algorithm needs a few scans to erase stale marks. Drive slowly and the map self-corrects. Use the "Effacer" button to clear and rebuild.

**Battery shows 0% or wrong value?**
The OpenCR reports battery on a 0-100 scale. If you see 12.6 or similar, the topic might be reporting voltage instead of percentage. Check: `ros2 topic echo /battery_state --once`.

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
