#!/bin/bash
#
# TurtleBot3 Computation Layer — runs on Ubuntu server (Docker)
# Subscribes to: /scan_reliable, /odom, /imu, /tf (from Pi over WiFi)
# Publishes:     /map, /cmd_vel, /autonomous_explorer/status
#

source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=waffle_pi
export FASTRTPS_DEFAULT_PROFILES_FILE=/usr/local/etc/fastdds_udp_only.xml

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

mkdir -p /home/maps

echo "[compute] Step 1/3: Starting Cartographer SLAM..."
ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=false use_rviz:=false &
SLAM_PID=$!
sleep 8

echo "[compute] Step 2/3: Starting map saver server..."
ros2 run nav2_map_server map_saver_server --ros-args -p save_map_timeout:=10000.0 -r /map:=/static_map &
MAP_SAVER_PID=$!
for i in 1 2 3 4 5; do
    sleep 3
    timeout 5 ros2 lifecycle set /map_saver configure 2>/dev/null && break
done
timeout 5 ros2 lifecycle set /map_saver activate 2>/dev/null

echo "[compute] Step 3/3: Starting frontier explorer (reactive)..."
python3 /usr/local/bin/frontier_explorer.py &
EXPLORER_PID=$!

echo "[compute] ========== Computation Layer Boot Complete =========="

wait $SLAM_PID $MAP_SAVER_PID $EXPLORER_PID
