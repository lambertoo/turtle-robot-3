#!/bin/bash

export TURTLEBOT3_MODEL=waffle_pi
export LDS_MODEL=LDS-03
export LD_LIBRARY_PATH=/usr/local/lib/aarch64-linux-gnu:${LD_LIBRARY_PATH}
export GST_PLUGIN_PATH=/usr/local/lib/aarch64-linux-gnu/gstreamer-1.0:${GST_PLUGIN_PATH}

source /opt/ros/jazzy/setup.bash

export FASTRTPS_DEFAULT_PROFILES_FILE=/usr/local/etc/fastdds_udp_only.xml

cleanup() {
    trap '' SIGTERM SIGINT
    echo "[startup] Stopping all child processes..."
    kill -TERM -$$ 2>/dev/null
    sleep 2
    kill -9 -$$ 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

echo "[startup] ========== TurtleBot3 boot sequence =========="

ros2 daemon stop 2>/dev/null
sleep 1

sudo fuser -k 9090/tcp 2>/dev/null
sudo fuser -k 8080/tcp 2>/dev/null

chmod 666 /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
mkdir -p /tmp/camera /home/ubuntu/maps
echo "0" > /tmp/opencr_watchdog_restarts

echo "[startup] Step 1/7: Starting bringup (motors, IMU, LiDAR)..."
ros2 launch turtlebot3_bringup robot.launch.py &
BRINGUP_PID=$!

ODOM_READY=0
for i in $(seq 1 30); do
    sleep 1
    if pgrep -f "turtlebot3_ros" > /dev/null 2>&1; then
        ODOM_READY=1
        echo "[startup] turtlebot3_ros is running (waited ${i}s)"
        break
    fi
done
if [ "$ODOM_READY" -eq 0 ]; then
    echo "[startup] WARNING: turtlebot3_ros not detected after 30s, continuing anyway"
fi
sleep 5

echo "[startup] Step 2/7: Starting rosbridge (port 9090)..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090 &
ROSBRIDGE_PID=$!

ROSBRIDGE_READY=0
for i in $(seq 1 20); do
    sleep 1
    if curl -s --max-time 1 http://localhost:9090 > /dev/null 2>&1; then
        ROSBRIDGE_READY=1
        echo "[startup] Rosbridge ready (waited ${i}s)"
        break
    fi
done
if [ "$ROSBRIDGE_READY" -eq 0 ]; then
    echo "[startup] WARNING: Rosbridge not responding after 20s"
fi

echo "[startup] Step 3/7: Starting scan relay (also enables motor power)..."
python3 /usr/local/bin/scan_relay.py &
RELAY_PID=$!
sleep 2

echo "[startup] Step 4/7: Starting Cartographer SLAM..."
ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=false &
SLAM_PID=$!
sleep 5

echo "[startup] Step 5/7: Starting map saver..."
ros2 run nav2_map_server map_saver_server --ros-args -p save_map_timeout:=10000.0 -r /map:=/static_map &
MAP_SAVER_PID=$!
for i in 1 2 3 4 5; do
    sleep 3
    timeout 5 ros2 lifecycle set /map_saver configure 2>/dev/null && break
done
timeout 5 ros2 lifecycle set /map_saver activate 2>/dev/null

echo "[startup] Step 6/7: Starting Nav2 stack..."
ros2 launch /usr/local/bin/nav2-exploration.launch.py use_sim_time:=false params_file:=/usr/local/etc/nav2_exploration_params.yaml &
NAV2_PID=$!
sleep 12

echo "[startup] Step 7/7: Starting camera + explorer..."
gst-launch-1.0 libcamerasrc ! video/x-raw,width=640,height=480,framerate=15/1 ! videoconvert ! jpegenc quality=70 ! multifilesink location=/tmp/camera/snap.jpg max-files=1 &
GST_PID=$!
sleep 3

mjpg_streamer -i "input_file.so -f /tmp/camera -n snap.jpg -d 0.1" -o "output_http.so -p 8080 -w /usr/local/share/mjpg-streamer/www" &
MJPG_PID=$!

python3 /usr/local/bin/frontier_explorer.py &
EXPLORER_PID=$!

pkill -9 -f opencr-watchdog 2>/dev/null
bash /usr/local/bin/opencr-watchdog.sh &
WATCHDOG_PID=$!

echo "[startup] ========== Boot complete =========="

wait $BRINGUP_PID $ROSBRIDGE_PID $RELAY_PID $SLAM_PID $MAP_SAVER_PID $NAV2_PID $GST_PID $MJPG_PID $WATCHDOG_PID $EXPLORER_PID
