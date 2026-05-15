#!/bin/bash
set -e

source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=waffle_pi

echo "========================================="
echo " TurtleBot3 Simulation - UNIPOD MADAGASCAR"
echo " Model: ${TURTLEBOT3_MODEL}"
echo " Rosbridge: ws://localhost:9090"
echo " Video: http://localhost:8080"
echo "========================================="

ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090 &
sleep 2

ros2 run web_video_server web_video_server --ros-args -p port:=8080 &
sleep 1

ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py \
    use_sim_time:=true \
    x_pose:=0.0 \
    y_pose:=0.0

wait
