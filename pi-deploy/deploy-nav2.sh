#!/bin/bash
set -e

PI_HOST="ubuntu@192.168.1.132"
PI_PASS="turtlebot3"
SSH="sshpass -p $PI_PASS ssh -o StrictHostKeyChecking=no $PI_HOST"
SCP="sshpass -p $PI_PASS scp -o StrictHostKeyChecking=no"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Step 1: Install Nav2 packages ==="
$SSH "sudo apt update && sudo apt install -y \
  ros-jazzy-nav2-bringup ros-jazzy-nav2-bt-navigator \
  ros-jazzy-nav2-amcl ros-jazzy-nav2-controller ros-jazzy-nav2-planner \
  ros-jazzy-nav2-behaviors ros-jazzy-nav2-lifecycle-manager \
  ros-jazzy-nav2-waypoint-follower"

echo "=== Step 2: Deploy Nav2 params ==="
$SCP "$SCRIPT_DIR/nav2_cleaning_params.yaml" "$PI_HOST:/tmp/nav2_cleaning_params.yaml"
$SSH "sudo cp /tmp/nav2_cleaning_params.yaml /usr/local/etc/nav2_cleaning_params.yaml"

echo "=== Step 3: Deploy Nav2 launch file ==="
$SCP "$SCRIPT_DIR/nav2-cleaning.launch.py" "$PI_HOST:/tmp/nav2-cleaning.launch.py"
$SSH "sudo cp /tmp/nav2-cleaning.launch.py /usr/local/bin/nav2-cleaning.launch.py && sudo chmod +x /usr/local/bin/nav2-cleaning.launch.py"

echo "=== Step 4: Add Nav2 to startup script ==="
$SSH "grep -q 'nav2-cleaning' /usr/local/bin/turtlebot3-start.sh && echo 'Nav2 already in startup script' || sudo sed -i '/^python3.*scan_relay.py/a \\nros2 launch /usr/local/bin/nav2-cleaning.launch.py use_sim_time:=false params_file:=/usr/local/etc/nav2_cleaning_params.yaml \&\\nNAV2_PID=\$!\\nsleep 5' /usr/local/bin/turtlebot3-start.sh"

echo "=== Step 5: Remap map_saver_server to /static_map ==="
$SSH "grep -q 'r /map:=/static_map' /usr/local/bin/turtlebot3-start.sh && echo 'Already remapped' || sudo sed -i 's|map_saver_server --ros-args -p save_map_timeout:=10000.0|map_saver_server --ros-args -p save_map_timeout:=10000.0 -r /map:=/static_map|' /usr/local/bin/turtlebot3-start.sh"

echo "=== Step 6: Add NAV2_PID to wait command ==="
$SSH "grep -q 'NAV2_PID' /usr/local/bin/turtlebot3-start.sh | grep -q 'wait.*NAV2_PID' && echo 'Already in wait' || sudo sed -i 's/wait \$BRINGUP_PID/wait \$BRINGUP_PID \$NAV2_PID/' /usr/local/bin/turtlebot3-start.sh"

echo "=== Done! Restart turtlebot3 service to apply ==="
echo "Run: ssh ubuntu@192.168.1.132 'sudo systemctl restart turtlebot3'"
