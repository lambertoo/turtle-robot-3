#!/bin/bash
source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=waffle_pi

RESTART_COUNT_FILE="/tmp/opencr_watchdog_restarts"
MAX_RESTARTS=5
HEALTH_FILE="/tmp/turtlebot3_last_odom"
HEALTHY_TICKS=0
HEALTHY_RESET_THRESHOLD=20

echo "[watchdog] Started — monitoring turtlebot3_ros health"

sleep 45

while true; do
    PROCESS_ALIVE=0
    ODOM_HEALTHY=0

    if pgrep -f "turtlebot3_ros" > /dev/null 2>&1; then
        PROCESS_ALIVE=1
    fi

    if [ "$PROCESS_ALIVE" -eq 1 ]; then
        CURRENT_TIME=$(date +%s)

        timeout 3 ros2 topic echo /odom --once --no-arr 2>/dev/null | head -1 > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            ODOM_HEALTHY=1
            echo "$CURRENT_TIME" > "$HEALTH_FILE"
        else
            if [ -f "$HEALTH_FILE" ]; then
                LAST_ODOM=$(cat "$HEALTH_FILE")
                STALE_SECONDS=$((CURRENT_TIME - LAST_ODOM))
                if [ "$STALE_SECONDS" -lt 30 ]; then
                    ODOM_HEALTHY=1
                fi
            fi
        fi
    fi

    if [ "$PROCESS_ALIVE" -eq 1 ] && [ "$ODOM_HEALTHY" -eq 1 ]; then
        HEALTHY_TICKS=$((HEALTHY_TICKS + 1))
        if [ "$HEALTHY_TICKS" -ge "$HEALTHY_RESET_THRESHOLD" ]; then
            COUNT=$(cat "$RESTART_COUNT_FILE" 2>/dev/null || echo "0")
            if [ "$COUNT" -gt 0 ]; then
                echo "0" > "$RESTART_COUNT_FILE"
                echo "[watchdog] Healthy for $((HEALTHY_TICKS * 15))s — restart counter reset"
            fi
            HEALTHY_TICKS=0
        fi
    else
        HEALTHY_TICKS=0
        COUNT=$(cat "$RESTART_COUNT_FILE" 2>/dev/null || echo "0")

        if [ "$PROCESS_ALIVE" -eq 0 ]; then
            echo "[watchdog] turtlebot3_ros process DEAD"
        else
            echo "[watchdog] turtlebot3_ros alive but odom STALE"
        fi

        if [ "$COUNT" -lt "$MAX_RESTARTS" ]; then
            echo "$((COUNT + 1))" > "$RESTART_COUNT_FILE"
            echo "[watchdog] Triggering full restart (attempt $((COUNT+1))/$MAX_RESTARTS)"
            sudo systemctl restart turtlebot3 &
            exit 0
        else
            echo "[watchdog] Max restarts ($MAX_RESTARTS) reached — waiting 10 min before retrying"
            echo "0" > "$RESTART_COUNT_FILE"
            sleep 600
        fi
    fi

    sleep 15
done
