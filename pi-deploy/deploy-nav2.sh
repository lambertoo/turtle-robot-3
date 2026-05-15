#!/bin/bash
set -e

PI_HOST="${PI_HOST:-ubuntu@192.168.1.132}"
PI_PASS="${PI_PASS:-turtlebot3}"
SSH="sshpass -p $PI_PASS ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no $PI_HOST"
SCP="sshpass -p $PI_PASS scp -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Step 1/6: Install ROS packages ==="
$SSH "sudo apt update && sudo apt install -y \
  ros-jazzy-nav2-bringup ros-jazzy-nav2-bt-navigator \
  ros-jazzy-nav2-controller ros-jazzy-nav2-planner \
  ros-jazzy-nav2-behaviors ros-jazzy-nav2-lifecycle-manager \
  ros-jazzy-nav2-waypoint-follower ros-jazzy-rosbridge-server \
  python3-opencv python3-numpy curl"

echo "=== Step 2/6: Deploy Pi-side files ==="
$SCP "$SCRIPT_DIR/turtlebot3-start.sh" "$PI_HOST:/tmp/"
$SCP "$SCRIPT_DIR/frontier_explorer.py" "$PI_HOST:/tmp/"
$SCP "$SCRIPT_DIR/scan_relay.py" "$PI_HOST:/tmp/"
$SCP "$SCRIPT_DIR/opencr-watchdog.sh" "$PI_HOST:/tmp/"
$SCP "$SCRIPT_DIR/nav2-exploration.launch.py" "$PI_HOST:/tmp/"
$SCP "$SCRIPT_DIR/nav2_exploration_params.yaml" "$PI_HOST:/tmp/"

$SSH "sudo cp /tmp/turtlebot3-start.sh /usr/local/bin/ && \
      sudo cp /tmp/frontier_explorer.py /usr/local/bin/ && \
      sudo cp /tmp/scan_relay.py /usr/local/bin/ && \
      sudo cp /tmp/opencr-watchdog.sh /usr/local/bin/ && \
      sudo cp /tmp/nav2-exploration.launch.py /usr/local/bin/ && \
      sudo cp /tmp/nav2_exploration_params.yaml /usr/local/etc/ && \
      sudo chmod +x /usr/local/bin/turtlebot3-start.sh \
                     /usr/local/bin/opencr-watchdog.sh \
                     /usr/local/bin/frontier_explorer.py \
                     /usr/local/bin/nav2-exploration.launch.py"

echo "=== Step 3/6: Create systemd service ==="
$SSH 'sudo tee /etc/systemd/system/turtlebot3.service > /dev/null << UNIT
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
UNIT'
$SSH "sudo systemctl daemon-reload"

echo "=== Step 4/6: Allow passwordless service restart (for watchdog) ==="
$SSH 'echo "ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart turtlebot3, /usr/bin/systemctl stop turtlebot3, /usr/bin/systemctl start turtlebot3, /usr/bin/fuser" | sudo tee /etc/sudoers.d/turtlebot3 > /dev/null && sudo chmod 440 /etc/sudoers.d/turtlebot3'

echo "=== Step 5/6: Enable service on boot ==="
$SSH "sudo systemctl enable turtlebot3"

echo "=== Step 6/6: Start service ==="
$SSH "sudo systemctl start turtlebot3"

echo ""
echo "=== Deployment complete ==="
echo "The robot will start automatically on every boot."
echo "Dashboard: open http://localhost:3000 after running 'npm run dev'"
echo ""
echo "Useful commands:"
echo "  Logs:    ssh $PI_HOST 'journalctl -u turtlebot3 -f'"
echo "  Restart: ssh $PI_HOST 'sudo systemctl restart turtlebot3'"
echo "  Stop:    ssh $PI_HOST 'sudo systemctl stop turtlebot3'"
