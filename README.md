# TurtleBot3 Dashboard

Web-based control dashboard for [TurtleBot3 Waffle Pi](https://www.robotis.us/turtlebot-3/) running ROS 2 Jazzy. Provides real-time SLAM visualization, teleoperation, autonomous frontier exploration, and camera feed — all from a browser.

Built with Next.js 16, React 19, Tailwind CSS 4, roslibjs, and next-intl (English/French).

## Features

- **Live SLAM Map** — Real-time occupancy grid from Cartographer on HTML5 canvas
- **Virtual Joystick** — Touch/mouse teleoperation with configurable speed limits
- **Autonomous Exploration** — Frontier-based exploration using Nav2 NavigateToPose
- **Camera Feed** — MJPEG stream from Pi camera via GStreamer + mjpg-streamer
- **Battery & IMU Telemetry** — HUD overlay with compass, attitude indicator, battery level
- **Emergency Stop** — One-tap motor kill
- **Multi-language** — English and French
- **Demo Mode** — Simulated data for development without a physical robot

## Architecture

```
┌─────────────────────────┐     WebSocket :9090      ┌──────────────────────┐
│   Browser (Dashboard)   │◄────────────────────────►│   Raspberry Pi 4     │
│                         │                           │                      │
│  Next.js 16 + React 19 │     MJPEG :8080          │  ROS 2 Jazzy         │
│  Tailwind CSS 4         │◄─────────────────────────│  TurtleBot3 Bringup  │
│  roslibjs               │                           │  Cartographer SLAM   │
│  next-intl (en/fr)      │                           │  Nav2 Stack          │
│                         │                           │  Rosbridge           │
└─────────────────────────┘                           │  Frontier Explorer   │
                                                      │  GStreamer Camera    │
                                                      └──────────┬───────────┘
                                                                 │ USB
                                                      ┌──────────┴───────────┐
                                                      │  OpenCR + LDS-03     │
                                                      │  Motors / IMU / LiDAR│
                                                      └──────────────────────┘
```

## Prerequisites

**Development machine:**
- Node.js 20+
- `sshpass` for deployment: `brew install hudochenkov/sshpass/sshpass` (macOS)

**Raspberry Pi (TurtleBot3):**
- Ubuntu 24.04 with ROS 2 Jazzy
- TurtleBot3 packages: `ros-jazzy-turtlebot3-bringup`, `ros-jazzy-turtlebot3-cartographer`
- Nav2 packages (installed by deploy script)
- Rosbridge: `ros-jazzy-rosbridge-server`
- Python: `opencv-python`, `numpy`
- GStreamer with libcamera support
- `mjpg-streamer` compiled with input_file plugin

## Setup

### 1. Clone and install

```bash
git clone git@github.com:lambertoo/turtle-robot-3.git
cd turtle-robot-3
npm install
```

### 2. Configure your robot's IP

Edit `config/robot.json`:

```json
{
  "rosbridge_url": "ws://YOUR_ROBOT_IP:9090",
  "max_linear_speed": 0.2,
  "max_angular_speed": 1.0
}
```

### 3. Deploy to Raspberry Pi

The `pi-deploy/` directory contains all files that run on the Pi. The one-shot deployment script installs Nav2 packages and copies everything:

```bash
cd pi-deploy
bash deploy-nav2.sh
```

Or deploy files manually:

```bash
PI=ubuntu@YOUR_ROBOT_IP

scp turtlebot3-start.sh frontier_explorer.py scan_relay.py \
    opencr-watchdog.sh nav2-exploration.launch.py \
    nav2_exploration_params.yaml $PI:/tmp/

ssh $PI 'sudo cp /tmp/turtlebot3-start.sh /usr/local/bin/ && \
         sudo cp /tmp/frontier_explorer.py /usr/local/bin/ && \
         sudo cp /tmp/scan_relay.py /usr/local/bin/ && \
         sudo cp /tmp/opencr-watchdog.sh /usr/local/bin/ && \
         sudo cp /tmp/nav2-exploration.launch.py /usr/local/bin/ && \
         sudo cp /tmp/nav2_exploration_params.yaml /usr/local/etc/ && \
         sudo chmod +x /usr/local/bin/turtlebot3-start.sh \
                       /usr/local/bin/opencr-watchdog.sh \
                       /usr/local/bin/frontier_explorer.py \
                       /usr/local/bin/nav2-exploration.launch.py'
```

### 4. Create systemd service

On the Pi, create `/etc/systemd/system/turtlebot3.service`:

```ini
[Unit]
Description=TurtleBot3 Full Stack
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/local/bin/turtlebot3-start.sh
Restart=on-failure
RestartSec=10
KillMode=control-group
KillSignal=SIGTERM
TimeoutStopSec=15
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable turtlebot3
sudo systemctl start turtlebot3
```

> **Important:** Use `KillMode=control-group` (not `process`). This ensures all child processes (rosbridge, Nav2, camera, etc.) are killed cleanly on restart.

### 5. Run the dashboard

```bash
npm run dev
```

Open http://localhost:3000.

## Pi-Side Components

| File | Purpose |
|------|---------|
| `turtlebot3-start.sh` | Main startup — launches all ROS nodes, camera, and services in sequence |
| `frontier_explorer.py` | Frontier-based autonomous explorer using Nav2 NavigateToPose |
| `scan_relay.py` | QoS bridge: `/scan` (BEST_EFFORT) → `/scan_reliable` (RELIABLE) |
| `opencr-watchdog.sh` | Monitors turtlebot3_ros, triggers full service restart on crash |
| `nav2-exploration.launch.py` | Nav2 launch for exploration (no AMCL — Cartographer handles localization) |
| `nav2_exploration_params.yaml` | Nav2 parameters tuned for TurtleBot3 Waffle Pi |

### Startup Sequence

1. ROS 2 daemon cleanup (prevents stale context issues)
2. TurtleBot3 bringup (motors, IMU, odometry, LiDAR)
3. Motor power enable
4. OpenCR watchdog (background)
5. Rosbridge WebSocket server (port 9090)
6. Scan relay (QoS bridge for DDS compatibility)
7. Cartographer SLAM
8. Map saver server
9. Nav2 stack (controller, planner, behavior, bt_navigator)
10. GStreamer camera pipeline + MJPEG streamer (port 8080)
11. Frontier explorer

### Nav2 Parameters

- **Robot radius**: 0.22m
- **Inflation radius**: 0.55m (30cm clearance from robot edge)
- **Max velocity**: 0.15 m/s linear, 0.8 rad/s angular
- **Planner**: NavFn with A* (tolerance 0.5m)
- **Controller**: DWB with RotateToGoal, Oscillation, BaseObstacle, GoalAlign, PathAlign, PathDist, GoalDist critics
- **LiDAR topic**: `/scan_reliable` (RELIABLE QoS)

### Autonomous Exploration

The frontier explorer:

1. Subscribes to the live Cartographer map
2. Detects frontier cells (free cells adjacent to unknown cells)
3. Clusters frontiers using BFS, filters by minimum size
4. Navigates to the nearest frontier via Nav2 NavigateToPose
5. Uses IMU bump detection and camera floor obstacle detection
6. Blacklists failed goals to prevent loops

Dashboard control: `/autonomous_explorer/start` and `/autonomous_explorer/stop` ROS services. Status on `/autonomous_explorer/status` topic.

## Dashboard Hooks

| Hook | Description |
|------|-------------|
| `use-rosbridge` | WebSocket connection to rosbridge |
| `use-teleop` | Publishes TwistStamped velocity to `/cmd_vel` |
| `use-slam` | SLAM controls: mapping, save/load maps, exploration |
| `use-map-subscription` | Subscribes to `/map` OccupancyGrid |
| `use-battery` | Battery state from OpenCR |
| `use-imu` | IMU data for compass and attitude |
| `use-cleaning` | Cleaning mode with boustrophedon coverage planner |
| `use-demo-mode` | Simulated telemetry for development |

## Network Ports

| Port | Protocol | Service |
|------|----------|---------|
| 9090 | WebSocket | Rosbridge |
| 8080 | HTTP | MJPEG camera stream |
| 3000 | HTTP | Dashboard dev server |

## Troubleshooting

**Robot not moving after startup?**
Check `sudo journalctl -u turtlebot3 -f` for serial errors. If turtlebot3_ros crashed, run `sudo systemctl restart turtlebot3`. The systemd service uses `KillMode=control-group` to ensure clean restarts.

**Dashboard can't connect?**
Verify the robot IP in `config/robot.json` and that rosbridge is running: `curl -s http://ROBOT_IP:9090` should return a WebSocket upgrade response.

**Map not updating?**
The scan relay (`scan_relay.py`) bridges the LiDAR QoS gap between BEST_EFFORT and RELIABLE. Check that it's running: `journalctl -u turtlebot3 | grep scan_relay`.

**Teleop sending but robot not responding?**
ROS 2 Jazzy TurtleBot3 uses `geometry_msgs/msg/TwistStamped` (not `Twist`). Refresh your browser to clear stale rosbridge topic registrations.

**Nav2 failing to start?**
Nav2 needs the odom→base_footprint transform from turtlebot3_ros. If turtlebot3_ros crashed, Nav2 lifecycle manager will abort. Restart the service.

## Development

```bash
npm run dev      # Dev server with hot reload
npm run build    # Production build
npm run lint     # ESLint
```

Enable Demo Mode in the dashboard to develop without a physical robot.

## License

MIT
