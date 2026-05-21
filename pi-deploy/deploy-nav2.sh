#!/bin/bash
set -e

# Detect target: PI_HOST for robot, COMPUTE_HOST for Ubuntu PC
PI_HOST="${PI_HOST:-ubuntu@turtlebot3.local}"
PI_PASS="${PI_PASS:-turtlebot3}"
COMPUTE_HOST="${COMPUTE_HOST:-}"
COMPUTE_PASS="${COMPUTE_PASS:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ---------------------------------------------------------------------------
# Deploy to Raspberry Pi (Hardware Layer)
# ---------------------------------------------------------------------------
echo ""
echo "=== Deploying Hardware Layer to Pi: ${PI_HOST} ==="

SSH_PI="sshpass -p ${PI_PASS} ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no ${PI_HOST}"
SCP_PI="sshpass -p ${PI_PASS} scp -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no"

echo "--- Step 1/4: Install ROS packages on Pi ---"
${SSH_PI} "sudo apt update && sudo apt install -y \
  ros-jazzy-nav2-bringup ros-jazzy-nav2-bt-navigator \
  ros-jazzy-nav2-controller ros-jazzy-nav2-planner \
  ros-jazzy-nav2-behaviors ros-jazzy-nav2-lifecycle-manager \
  ros-jazzy-nav2-waypoint-follower ros-jazzy-rosbridge-server \
  python3-opencv python3-numpy curl"

echo "--- Step 2/4: Deploy Pi hardware files ---"
${SCP_PI} "${SCRIPT_DIR}/turtlebot3-hardware-start.sh" "${PI_HOST}:/tmp/"
${SCP_PI} "${SCRIPT_DIR}/scan_relay.py" "${PI_HOST}:/tmp/"
${SCP_PI} "${SCRIPT_DIR}/opencr-watchdog.sh" "${PI_HOST}:/tmp/"
${SCP_PI} "${SCRIPT_DIR}/fastdds_udp_only.xml" "${PI_HOST}:/tmp/"

${SSH_PI} "sudo cp /tmp/turtlebot3-hardware-start.sh /usr/local/bin/turtlebot3-start.sh && \
      sudo cp /tmp/scan_relay.py /usr/local/bin/ && \
      sudo cp /tmp/opencr-watchdog.sh /usr/local/bin/ && \
      sudo cp /tmp/fastdds_udp_only.xml /usr/local/etc/ && \
      sudo chmod +x /usr/local/bin/turtlebot3-start.sh \
                     /usr/local/bin/opencr-watchdog.sh"

echo "--- Step 3/4: Update Pi systemd service ---"
${SSH_PI} 'sudo tee /etc/systemd/system/turtlebot3.service > /dev/null << UNIT
[Unit]
Description=TurtleBot3 Hardware Layer (bringup + rosbridge + camera)
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
UNIT'
${SSH_PI} "sudo systemctl daemon-reload"

echo "--- Step 4/4: Enable and start Pi service ---"
${SSH_PI} "sudo systemctl enable turtlebot3"
${SSH_PI} "sudo systemctl restart turtlebot3"

echo ""
echo "=== Pi Hardware Layer deployed ==="
echo "  Service: sudo systemctl status turtlebot3"
echo "  Logs:    ssh ${PI_HOST} 'journalctl -u turtlebot3 -f'"

# ---------------------------------------------------------------------------
# Deploy to Ubuntu PC (Computation Layer) — if COMPUTE_HOST is set
# ---------------------------------------------------------------------------
if [ -n "${COMPUTE_HOST}" ]; then
  echo ""
  echo "=== Deploying Computation Layer to PC: ${COMPUTE_HOST} ==="

  SSH_COMPUTE="sshpass -p ${COMPUTE_PASS} ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no ${COMPUTE_HOST}"
  SCP_COMPUTE="sshpass -p ${COMPUTE_PASS} scp -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no"

  echo "--- Step 1/3: Copy compute files to PC ---"
  ${SCP_COMPUTE} "${SCRIPT_DIR}/turtlebot3-compute-start.sh" "${COMPUTE_HOST}:/tmp/"
  ${SCP_COMPUTE} "${SCRIPT_DIR}/nav2-exploration.launch.py" "${COMPUTE_HOST}:/tmp/"
  ${SCP_COMPUTE} "${SCRIPT_DIR}/nav2_exploration_params.yaml" "${COMPUTE_HOST}:/tmp/"
  ${SCP_COMPUTE} "${SCRIPT_DIR}/frontier_explorer.py" "${COMPUTE_HOST}:/tmp/"
  ${SCP_COMPUTE} "${SCRIPT_DIR}/fastdds_udp_only.xml" "${COMPUTE_HOST}:/tmp/"

  ${SSH_COMPUTE} "sudo mkdir -p /usr/local/bin /usr/local/etc && \
        sudo cp /tmp/turtlebot3-compute-start.sh /usr/local/bin/ && \
        sudo cp /tmp/nav2-exploration.launch.py /usr/local/bin/ && \
        sudo cp /tmp/nav2_exploration_params.yaml /usr/local/etc/ && \
        sudo cp /tmp/frontier_explorer.py /usr/local/bin/ && \
        sudo cp /tmp/fastdds_udp_only.xml /usr/local/etc/ && \
        sudo chmod +x /usr/local/bin/turtlebot3-compute-start.sh /usr/local/bin/frontier_explorer.py"

  echo "--- Step 2/3: Create PC systemd service ---"
  ${SSH_COMPUTE} 'sudo tee /etc/systemd/system/turtlebot3-compute.service > /dev/null << UNIT
[Unit]
Description=TurtleBot3 Computation Layer (SLAM + Nav2 + Explorer)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User='"$(echo ${COMPUTE_HOST} | cut -d@ -f1)"'
ExecStart=/usr/local/bin/turtlebot3-compute-start.sh
Restart=on-failure
RestartSec=10
KillMode=control-group
KillSignal=SIGTERM
TimeoutStopSec=15
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
UNIT'
  ${SSH_COMPUTE} "sudo systemctl daemon-reload"

  echo "--- Step 3/3: Enable PC service (not started yet) ---"
  ${SSH_COMPUTE} "sudo systemctl enable turtlebot3-compute"

  echo ""
  echo "=== PC Computation Layer deployed ==="
  echo "  To start:  ssh ${COMPUTE_HOST} 'sudo systemctl start turtlebot3-compute'"
  echo "  To stop:   ssh ${COMPUTE_HOST} 'sudo systemctl stop turtlebot3-compute'"
  echo "  Logs:      ssh ${COMPUTE_HOST} 'journalctl -u turtlebot3-compute -f'"
fi

echo ""
echo "=== Deployment complete ==="
echo ""
echo "Architecture:"
echo "  Pi (robot):    Hardware layer — motors, LiDAR, rosbridge, camera"
echo "  Ubuntu PC:     Computation layer — Cartographer SLAM, Nav2, explorer"
echo "  Your Mac:      Dashboard — npm run dev → http://localhost:3000"
echo ""
echo "Network requirements:"
echo "  • Both Pi and Ubuntu PC on same WiFi/network"
echo "  • Both have FASTRTPS_DEFAULT_PROFILES_FILE set to fastdds_udp_only.xml"
echo "  • Dashboard connects to Pi at ws://turtlebot3.local:9090"
echo ""

if [ -z "${COMPUTE_HOST}" ]; then
  echo "NOTE: COMPUTE_HOST not set. To also deploy to the Ubuntu PC, run:"
  echo "  COMPUTE_HOST=user@192.168.1.X COMPUTE_PASS=yourpassword bash deploy-nav2.sh"
  echo ""
fi
