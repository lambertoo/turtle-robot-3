#!/bin/bash
#
# TurtleBot3 Computation Layer — runs on Ubuntu PC
# Subscribes to: /scan_reliable, /odom, /imu (from Pi over WiFi)
# Publishes:     /map, /cmd_vel, /global_costmap, /local_costmap
#

export TURTLEBOT3_MODEL=waffle_pi
export LDS_MODEL=LDS-03

source /opt/ros/jazzy/setup.bash
export FASTRTPS_DEFAULT_PROFILES_FILE="${FASTRTPS_DEFAULT_PROFILES_FILE:-/usr/local/etc/fastdds_udp_only.xml}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARAMS_FILE="${PARAMS_FILE:-${SCRIPT_DIR}/nav2_exploration_params.yaml}"

cleanup() {
    trap '' SIGTERM SIGINT
    echo "[compute] Stopping all child processes..."
    kill -TERM -$$ 2>/dev/null
    sleep 2
    kill -9 -$$ 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

echo "[compute] ========== TurtleBot3 Computation Layer Boot =========="
echo "[compute] DDS config: ${FASTRTPS_DEFAULT_PROFILES_FILE}"
echo "[compute] Nav2 params: ${PARAMS_FILE}"

mkdir -p ~/maps

echo "[compute] Step 1/4: Starting Cartographer SLAM..."
ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=false &
SLAM_PID=$!
sleep 8

echo "[compute] Step 2/4: Starting map saver server..."
ros2 run nav2_map_server map_saver_server --ros-args -p save_map_timeout:=10000.0 -r /map:=/static_map &
MAP_SAVER_PID=$!
for i in 1 2 3 4 5; do
    sleep 3
    timeout 5 ros2 lifecycle set /map_saver configure 2>/dev/null && break
done
timeout 5 ros2 lifecycle set /map_saver activate 2>/dev/null

echo "[compute] Step 3/4: Starting Nav2 stack..."
ros2 launch "${SCRIPT_DIR}/nav2-exploration.launch.py" use_sim_time:=false params_file:="${PARAMS_FILE}" &
NAV2_PID=$!
sleep 12

echo "[compute] Step 4/4: Starting frontier explorer..."
python3 "${SCRIPT_DIR}/frontier_explorer.py" &
EXPLORER_PID=$!

echo "[compute] ========== Computation Layer Boot Complete =========="
echo "[compute] All nodes publishing. Dashboard connects to Pi at ws://turtlebot3.local:9090"

wait $SLAM_PID $MAP_SAVER_PID $NAV2_PID $EXPLORER_PID
