#!/bin/bash
#
# TurtleBot3 Hardware Layer — runs on Raspberry Pi 4
# Publishes: /odom, /scan, /scan_reliable, /imu, /battery_state
# Receives:  /cmd_vel (from Ubuntu PC or dashboard via rosbridge)
#

export TURTLEBOT3_MODEL=waffle_pi
export LDS_MODEL=LDS-03
export LD_LIBRARY_PATH=/usr/local/lib/aarch64-linux-gnu:${LD_LIBRARY_PATH}
export GST_PLUGIN_PATH=/usr/local/lib/aarch64-linux-gnu/gstreamer-1.0:${GST_PLUGIN_PATH}

source /opt/ros/jazzy/setup.bash
export FASTRTPS_DEFAULT_PROFILES_FILE=/usr/local/etc/fastdds_udp_only.xml

cleanup() {
    trap '' SIGTERM SIGINT
    echo "[hardware] Stopping all child processes..."
    kill -TERM -$$ 2>/dev/null
    sleep 2
    kill -9 -$$ 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

echo "[hardware] ========== TurtleBot3 Hardware Layer Boot =========="

ros2 daemon stop 2>/dev/null
sleep 1

sudo fuser -k 9090/tcp 2>/dev/null
sudo fuser -k 8080/tcp 2>/dev/null

chmod 666 /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
mkdir -p /tmp/camera /home/ubuntu/maps
echo "0" > /tmp/opencr_watchdog_restarts

echo "[hardware] Step 1/3: Starting bringup (motors, IMU, LiDAR)..."
ros2 launch turtlebot3_bringup robot.launch.py &
BRINGUP_PID=$!

ODOM_READY=0
for i in $(seq 1 30); do
    sleep 1
    if pgrep -f "turtlebot3_ros" > /dev/null 2>&1; then
        ODOM_READY=1
        echo "[hardware] turtlebot3_ros running (waited ${i}s)"
        break
    fi
done
if [ "$ODOM_READY" -eq 0 ]; then
    echo "[hardware] WARNING: turtlebot3_ros not detected after 30s"
fi
sleep 5

echo "[hardware] Step 2/3: Starting rosbridge (port 9090)..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090 &
ROSBRIDGE_PID=$!

ROSBRIDGE_READY=0
for i in $(seq 1 20); do
    sleep 1
    if curl -s --max-time 1 http://localhost:9090 > /dev/null 2>&1; then
        ROSBRIDGE_READY=1
        echo "[hardware] Rosbridge ready (waited ${i}s)"
        break
    fi
done
if [ "$ROSBRIDGE_READY" -eq 0 ]; then
    echo "[hardware] WARNING: Rosbridge not responding after 20s"
fi
sleep 2

echo "[hardware] Step 3/3: Starting scan relay + camera + watchdog..."
python3 /usr/local/bin/scan_relay.py &
RELAY_PID=$!
sleep 2

gst-launch-1.0 libcamerasrc ! video/x-raw,width=640,height=480,framerate=15/1 ! videoconvert ! jpegenc quality=70 ! multifilesink location=/tmp/camera/snap.jpg max-files=1 &
GST_PID=$!
sleep 3

mjpg_streamer -i "input_file.so -f /tmp/camera -n snap.jpg -d 0.1" -o "output_http.so -p 8080 -w /usr/local/share/mjpg-streamer/www" &
MJPG_PID=$!

pkill -9 -f opencr-watchdog 2>/dev/null
bash /usr/local/bin/opencr-watchdog.sh &
WATCHDOG_PID=$!

echo "[hardware] ========== Hardware Layer Boot Complete =========="
echo "[hardware] Waiting for Ubuntu PC to launch SLAM + Nav2..."

wait $BRINGUP_PID $ROSBRIDGE_PID $RELAY_PID $GST_PID $MJPG_PID $WATCHDOG_PID
