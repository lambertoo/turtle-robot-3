#!/bin/bash

export TURTLEBOT3_MODEL=waffle_pi
export LDS_MODEL=LDS-03
export LD_LIBRARY_PATH=/usr/local/lib/aarch64-linux-gnu:${LD_LIBRARY_PATH}
export GST_PLUGIN_PATH=/usr/local/lib/aarch64-linux-gnu/gstreamer-1.0:${GST_PLUGIN_PATH}

source /opt/ros/jazzy/setup.bash

cleanup() {
    echo "Stopping all child processes..."
    kill -TERM 0 2>/dev/null
    sleep 2
    kill -9 0 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

ros2 daemon stop 2>/dev/null
sleep 1

chmod 666 /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

mkdir -p /tmp/camera /home/ubuntu/maps

ros2 launch turtlebot3_bringup robot.launch.py &
BRINGUP_PID=$!
sleep 15

timeout 10 ros2 service call /motor_power std_srvs/srv/SetBool '{data: true}' --spin-time 5 2>/dev/null
sleep 2

pkill -9 -f opencr-watchdog 2>/dev/null
bash /usr/local/bin/opencr-watchdog.sh &
WATCHDOG_PID=$!

ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090 &
ROSBRIDGE_PID=$!
sleep 3

python3 /usr/local/bin/scan_relay.py &
RELAY_PID=$!
sleep 2

ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=false &
SLAM_PID=$!
sleep 5

ros2 run nav2_map_server map_saver_server --ros-args -p save_map_timeout:=10000.0 -r /map:=/static_map &
MAP_SAVER_PID=$!

for i in 1 2 3 4 5; do
  sleep 3
  timeout 5 ros2 lifecycle set /map_saver configure 2>/dev/null && break
done
timeout 5 ros2 lifecycle set /map_saver activate 2>/dev/null

ros2 launch /usr/local/bin/nav2-exploration.launch.py use_sim_time:=false params_file:=/usr/local/etc/nav2_exploration_params.yaml &
NAV2_PID=$!
sleep 10

gst-launch-1.0 libcamerasrc ! video/x-raw,width=640,height=480,framerate=15/1 ! videoconvert ! jpegenc quality=70 ! multifilesink location=/tmp/camera/snap.jpg max-files=1 &
GST_PID=$!
sleep 3

mjpg_streamer -i "input_file.so -f /tmp/camera -n snap.jpg -d 0.1" -o "output_http.so -p 8080 -w /usr/local/share/mjpg-streamer/www" &
MJPG_PID=$!

python3 /usr/local/bin/frontier_explorer.py &
EXPLORER_PID=$!

wait $BRINGUP_PID $ROSBRIDGE_PID $RELAY_PID $SLAM_PID $MAP_SAVER_PID $NAV2_PID $GST_PID $MJPG_PID $WATCHDOG_PID $EXPLORER_PID
