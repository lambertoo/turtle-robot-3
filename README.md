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

## Fresh Raspberry Pi Setup

Complete dependency installation for a clean Ubuntu 24.04 on Raspberry Pi 4. Run these on the Pi directly or via SSH.

### Install ROS 2 Jazzy

Full instructions: https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html

```bash
sudo apt update && sudo apt install -y software-properties-common curl
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
sudo apt update
sudo apt install -y ros-jazzy-ros-base ros-dev-tools
```

### Install TurtleBot3 + Nav2 + Rosbridge

```bash
sudo apt install -y \
  ros-jazzy-turtlebot3-bringup \
  ros-jazzy-turtlebot3-cartographer \
  ros-jazzy-nav2-bringup ros-jazzy-nav2-bt-navigator \
  ros-jazzy-nav2-controller ros-jazzy-nav2-planner \
  ros-jazzy-nav2-behaviors ros-jazzy-nav2-lifecycle-manager \
  ros-jazzy-nav2-waypoint-follower \
  ros-jazzy-rosbridge-server
```

### Install Camera and System Dependencies

```bash
sudo apt install -y \
  python3-opencv python3-numpy \
  gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  libcamera-apps cmake libjpeg-dev
```

### Build mjpg-streamer (from source)

mjpg-streamer is not available as an apt package — build from source:

```bash
cd /tmp
git clone https://github.com/jacksonliam/mjpg-streamer.git
cd mjpg-streamer/mjpg-streamer-experimental
make
sudo make install
```

This installs `mjpg_streamer` to `/usr/local/bin/` and plugins to `/usr/local/lib/mjpg-streamer/`.

### Shell Environment

Add to `~/.bashrc`:

```bash
echo 'source /opt/ros/jazzy/setup.bash' >> ~/.bashrc
echo 'export TURTLEBOT3_MODEL=waffle_pi' >> ~/.bashrc
echo 'export LDS_MODEL=LDS-03' >> ~/.bashrc
source ~/.bashrc
```

### Development Machine (macOS/Linux)

For deploying to the Pi from your laptop:

```bash
# Node.js 20+ (https://nodejs.org/en/download)
# macOS:
brew install node

# sshpass (needed by deploy script)
# macOS:
brew install hudochenkov/sshpass/sshpass
# Ubuntu/Debian:
sudo apt install -y sshpass
```

---

## NVIDIA Jetson Orin Nano Setup

The Jetson Orin Nano 8GB can replace the Raspberry Pi 4 for significantly more compute (40 TOPS AI, 6-core Arm Cortex-A78AE, 1024-core Ampere GPU). This section covers the differences from the Pi setup.

> **Not compatible:** The original Jetson Nano (2019) runs Ubuntu 18.04 / JetPack 4.x, which cannot run ROS 2 Humble or Jazzy. Only the **Orin Nano** (2023+) is supported.

### Hardware Requirements

- [NVIDIA Jetson Orin Nano 8GB Developer Kit](https://developer.nvidia.com/embedded/learn/get-started-jetson-orin-nano-devkit) or the module on a carrier board
- USB-C power supply (the Orin Nano needs a dedicated power supply — the TurtleBot3 battery alone is not enough)
- Same OpenCR board + LDS-03 LiDAR via USB (identical to Pi setup)
- USB camera or CSI camera (MIPI CSI-2 with IMX219 sensor recommended)

### Platform Differences from Raspberry Pi

| | Raspberry Pi 4 | Jetson Orin Nano 8GB |
|---|---|---|
| **OS** | Ubuntu 24.04 | JetPack 6.x (Ubuntu 22.04) |
| **ROS 2** | Jazzy | Humble |
| **Package prefix** | `ros-jazzy-*` | `ros-humble-*` |
| **Camera pipeline** | `libcamerasrc` (libcamera) | `nvarguscamerasrc` (NVIDIA ISP) |
| **JPEG encoding** | `jpegenc` (CPU) | `nvjpegenc` (GPU-accelerated) |
| **Default user** | `ubuntu` | `nvidia` (JetPack default) |
| **GPU acceleration** | None | CUDA 12, cuDNN, TensorRT |

### Step 1: Flash JetPack 6.x

Download and flash JetPack 6.1+ from NVIDIA:

https://developer.nvidia.com/embedded/jetpack

Use the [SDK Manager](https://developer.nvidia.com/sdk-manager) on an Ubuntu x86 host or flash the SD card image directly.

After first boot, complete the OEM setup (user, locale, network).

### Step 2: Install ROS 2 Humble

JetPack 6.x is based on Ubuntu 22.04 (Jammy), so use ROS 2 Humble (not Jazzy).

Full instructions: https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html

```bash
sudo apt update && sudo apt install -y software-properties-common curl
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
sudo apt update
sudo apt install -y ros-humble-ros-base ros-dev-tools
```

### Step 3: Install TurtleBot3 + Nav2 + Rosbridge

Same packages as Pi, but with `humble` instead of `jazzy`:

```bash
sudo apt install -y \
  ros-humble-turtlebot3-bringup \
  ros-humble-turtlebot3-cartographer \
  ros-humble-nav2-bringup ros-humble-nav2-bt-navigator \
  ros-humble-nav2-controller ros-humble-nav2-planner \
  ros-humble-nav2-behaviors ros-humble-nav2-lifecycle-manager \
  ros-humble-nav2-waypoint-follower \
  ros-humble-rosbridge-server
```

### Step 4: Install Camera and System Dependencies

```bash
sudo apt install -y \
  python3-opencv python3-numpy \
  gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  nvidia-l4t-gstreamer \
  cmake libjpeg-dev
```

The `nvidia-l4t-gstreamer` package provides `nvarguscamerasrc` and `nvjpegenc` for GPU-accelerated camera capture and JPEG encoding.

### Step 5: Build mjpg-streamer

Same as Pi:

```bash
cd /tmp
git clone https://github.com/jacksonliam/mjpg-streamer.git
cd mjpg-streamer/mjpg-streamer-experimental
make
sudo make install
```

### Step 6: Shell Environment

```bash
echo 'source /opt/ros/humble/setup.bash' >> ~/.bashrc
echo 'export TURTLEBOT3_MODEL=waffle_pi' >> ~/.bashrc
echo 'export LDS_MODEL=LDS-03' >> ~/.bashrc
source ~/.bashrc
```

### Step 7: Script Modifications

Before deploying, you need to change three things in the `pi-deploy/` scripts:

**1. ROS distro** — In all scripts that source ROS:

```bash
# Change this (Pi):
source /opt/ros/jazzy/setup.bash

# To this (Jetson):
source /opt/ros/humble/setup.bash
```

Files to update: `turtlebot3-start.sh`, `opencr-watchdog.sh`

**2. Camera pipeline** — In `turtlebot3-start.sh`, replace the GStreamer camera line:

```bash
# Pi (libcamera, CPU JPEG):
gst-launch-1.0 libcamerasrc ! video/x-raw,width=640,height=480,framerate=15/1 ! videoconvert ! jpegenc quality=70 ! multifilesink location=/tmp/camera/snap.jpg max-files=1 &

# Jetson (NVIDIA ISP, GPU JPEG):
gst-launch-1.0 nvarguscamerasrc ! 'video/x-raw(memory:NVMM),width=640,height=480,framerate=15/1' ! nvjpegenc quality=70 ! multifilesink location=/tmp/camera/snap.jpg max-files=1 &
```

If using a USB camera instead of CSI, use `v4l2src` (works on both platforms):

```bash
gst-launch-1.0 v4l2src device=/dev/video0 ! video/x-raw,width=640,height=480,framerate=15/1 ! videoconvert ! jpegenc quality=70 ! multifilesink location=/tmp/camera/snap.jpg max-files=1 &
```

**3. Deploy script packages** — In `deploy-nav2.sh`, replace all `ros-jazzy-` with `ros-humble-`:

```bash
# Change PI_HOST default to match your Jetson:
PI_HOST="${PI_HOST:-nvidia@192.168.1.132}"
PI_PASS="${PI_PASS:-nvidia}"
```

### Step 8: Deploy

```bash
cd pi-deploy
PI_HOST=nvidia@YOUR_JETSON_IP PI_PASS=YOUR_PASSWORD bash deploy-nav2.sh
```

The deploy script, systemd service, watchdog, and all other components work identically on the Jetson once the ROS distro and camera pipeline are updated.

### ROS 2 Humble vs Jazzy: API Differences

For this project, there is one notable API change:

| Feature | Humble | Jazzy |
|---|---|---|
| `/cmd_vel` message type | `geometry_msgs/msg/Twist` | `geometry_msgs/msg/TwistStamped` |

The dashboard auto-detects this — no dashboard code changes needed. The Pi-side scripts (`scan_relay.py`, `frontier_explorer.py`) use the message type that matches the installed TurtleBot3 packages, so they work on both distros without modification.

### GPU Acceleration Opportunities

The Jetson Orin Nano enables capabilities not possible on Pi:

- **CUDA-accelerated costmaps** — Nav2 supports GPU-accelerated costmap filters
- **Real-time object detection** — Run YOLO or SSD on the GPU for obstacle classification
- **Faster SLAM** — Cartographer benefits from the stronger CPU
- **Hardware video encoding** — `nvjpegenc` is ~10x faster than CPU `jpegenc`
- **Isaac ROS** — NVIDIA's GPU-accelerated ROS 2 packages: https://nvidia-isaac-ros.github.io/

### Power Considerations

The Jetson Orin Nano draws 7-15W vs the Pi 4's 3-7W. Options:

- Use a separate USB-C power supply (recommended for development)
- Upgrade the TurtleBot3 battery to a larger capacity LiPo
- Use NVIDIA's power modes: `sudo nvpmodel -m 1` for 15W, `sudo nvpmodel -m 2` for 7W

Check current power mode: `sudo nvpmodel -q`

---

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
