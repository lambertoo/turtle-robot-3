#!/usr/bin/env python3

import json
import time
import threading
import websocket
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy, HistoryPolicy
from nav_msgs.msg import OccupancyGrid

PI_ROSBRIDGE_URL = "ws://turtlebot3.local:9090"
RECONNECT_DELAY = 5


class MapBridge(Node):

    def __init__(self):
        super().__init__("map_bridge")
        self.websocket = None
        self.websocket_connected = False
        self.advertised = False

        map_qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )
        self.map_subscription = self.create_subscription(
            OccupancyGrid, "/map", self.handle_map_update, map_qos
        )
        self.explorer_data = None

        self.websocket_thread = threading.Thread(target=self.run_websocket, daemon=True)
        self.websocket_thread.start()

        self.get_logger().info("MapBridge started — relaying /map to Pi rosbridge")

    def run_websocket(self):
        while rclpy.ok():
            try:
                self.get_logger().info("Connecting to Pi rosbridge at %s" % PI_ROSBRIDGE_URL)
                self.websocket = websocket.WebSocketApp(
                    PI_ROSBRIDGE_URL,
                    on_open=self.on_ws_open,
                    on_close=self.on_ws_close,
                    on_error=self.on_ws_error,
                )
                self.websocket.run_forever(ping_interval=10, ping_timeout=5)
            except Exception as e:
                self.get_logger().warn("WebSocket error: %s" % str(e))
            self.websocket_connected = False
            self.advertised = False
            time.sleep(RECONNECT_DELAY)

    def on_ws_open(self, ws):
        self.websocket_connected = True
        self.advertised = False
        self.get_logger().info("Connected to Pi rosbridge")
        advertise_message = json.dumps({
            "op": "advertise",
            "topic": "/map",
            "type": "nav_msgs/OccupancyGrid",
        })
        ws.send(advertise_message)
        self.advertised = True
        self.get_logger().info("Advertised /map on Pi rosbridge")

    def on_ws_close(self, ws, close_status_code, close_msg):
        self.websocket_connected = False
        self.advertised = False
        self.get_logger().warn("Disconnected from Pi rosbridge")

    def on_ws_error(self, ws, error):
        self.get_logger().warn("WebSocket error: %s" % str(error))

    def handle_map_update(self, map_message):
        if not self.websocket_connected or not self.advertised:
            return

        try:
            header = map_message.header
            info = map_message.info
            map_data = {
                "op": "publish",
                "topic": "/map",
                "msg": {
                    "header": {
                        "stamp": {
                            "sec": header.stamp.sec,
                            "nanosec": header.stamp.nanosec,
                        },
                        "frame_id": header.frame_id,
                    },
                    "info": {
                        "map_load_time": {
                            "sec": info.map_load_time.sec,
                            "nanosec": info.map_load_time.nanosec,
                        },
                        "resolution": info.resolution,
                        "width": info.width,
                        "height": info.height,
                        "origin": {
                            "position": {
                                "x": info.origin.position.x,
                                "y": info.origin.position.y,
                                "z": info.origin.position.z,
                            },
                            "orientation": {
                                "x": info.origin.orientation.x,
                                "y": info.origin.orientation.y,
                                "z": info.origin.orientation.z,
                                "w": info.origin.orientation.w,
                            },
                        },
                    },
                    "data": list(map_message.data),
                },
            }
            self.websocket.send(json.dumps(map_data))
        except Exception as e:
            self.get_logger().warn("Failed to relay map: %s" % str(e))


def main():
    rclpy.init()
    node = MapBridge()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, rclpy.executors.ExternalShutdownException):
        pass
    finally:
        node.destroy_node()
        try:
            rclpy.shutdown()
        except Exception:
            pass


if __name__ == "__main__":
    main()
