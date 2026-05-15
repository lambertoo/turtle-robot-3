#!/bin/bash
source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=waffle_pi

RESTART_COUNT_FILE="/tmp/opencr_watchdog_restarts"
MAX_RESTARTS=3

echo "[watchdog] OpenCR watchdog started, monitoring turtlebot3_ros..."

if [ -f /tmp/opencr_watchdog_boot_time ]; then
    PREV_BOOT=$(cat /tmp/opencr_watchdog_boot_time)
    NOW=$(date +%s)
    if [ $((NOW - PREV_BOOT)) -gt 300 ]; then
        echo "0" > "$RESTART_COUNT_FILE"
    fi
fi
date +%s > /tmp/opencr_watchdog_boot_time

sleep 30

while true; do
    if ! pgrep -f "turtlebot3_ros" > /dev/null 2>&1; then
        COUNT=$(cat "$RESTART_COUNT_FILE" 2>/dev/null || echo "0")
        if [ "$COUNT" -lt "$MAX_RESTARTS" ]; then
            echo "$((COUNT + 1))" > "$RESTART_COUNT_FILE"
            echo "[watchdog] turtlebot3_ros DOWN — full service restart (attempt $((COUNT+1))/$MAX_RESTARTS)"
            systemctl restart turtlebot3 &
            exit 0
        else
            echo "[watchdog] Max restarts ($MAX_RESTARTS) reached. Manual intervention needed."
            sleep 300
        fi
    fi
    sleep 15
done
