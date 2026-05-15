#!/bin/bash
source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=waffle_pi

USB_DEVICE="1-1.3:1.0"
DRIVER_PATH="/sys/bus/usb/drivers/cdc_acm"

reset_opencr() {
    echo "[watchdog] Resetting OpenCR USB device..."
    echo "$USB_DEVICE" | sudo tee "$DRIVER_PATH/unbind" 2>/dev/null
    sleep 2
    echo "$USB_DEVICE" | sudo tee "$DRIVER_PATH/bind" 2>/dev/null
    sleep 3
    chmod 777 /dev/ttyACM* 2>/dev/null
    echo "[watchdog] OpenCR USB reset complete"
}

echo "[watchdog] OpenCR watchdog started, monitoring turtlebot3_ros..."

RESET_COUNT=0
MAX_RESETS=3

while true; do
    if ! pgrep -f "turtlebot3_ros" > /dev/null 2>&1; then
        if [ $RESET_COUNT -lt $MAX_RESETS ]; then
            echo "[watchdog] turtlebot3_ros is DOWN — resetting USB (attempt $((RESET_COUNT+1))/$MAX_RESETS)..."
            reset_opencr
            RESET_COUNT=$((RESET_COUNT+1))
        else
            echo "[watchdog] Max resets reached, waiting for manual intervention..."
            sleep 60
        fi
    else
        RESET_COUNT=0
    fi
    sleep 15
done
