#!/usr/bin/env python3

import json
import math
import time
import threading
import websocket
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy, HistoryPolicy
from sensor_msgs.msg import LaserScan, Imu
from nav_msgs.msg import Odometry
from geometry_msgs.msg import TransformStamped
from tf2_ros import TransformBroadcaster

PI_ROSBRIDGE_URL = "ws://192.168.1.199:9090"
RECONNECT_DELAY = 5


class ScanBridge(Node):

    def __init__(self):
        super().__init__("scan_bridge")

        sensor_qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            durability=DurabilityPolicy.VOLATILE,
            history=HistoryPolicy.KEEP_LAST,
            depth=5,
        )

        self.scan_publisher = self.create_publisher(LaserScan, "/scan", sensor_qos)
        self.scan_reliable_publisher = self.create_publisher(
            LaserScan, "/scan_reliable", 10
        )
        self.odom_publisher = self.create_publisher(Odometry, "/odom", sensor_qos)
        self.imu_publisher = self.create_publisher(Imu, "/imu", sensor_qos)
        self.tf_broadcaster = TransformBroadcaster(self)

        self.websocket = None
        self.websocket_connected = False

        self.websocket_thread = threading.Thread(
            target=self.run_websocket, daemon=True
        )
        self.websocket_thread.start()

        self.get_logger().info(
            "ScanBridge started — relaying Pi sensors to compute ROS"
        )

    def run_websocket(self):
        while rclpy.ok():
            try:
                self.get_logger().info(
                    "Connecting to Pi rosbridge at %s" % PI_ROSBRIDGE_URL
                )
                self.websocket = websocket.WebSocketApp(
                    PI_ROSBRIDGE_URL,
                    on_open=self.on_ws_open,
                    on_close=self.on_ws_close,
                    on_error=self.on_ws_error,
                    on_message=self.on_ws_message,
                )
                self.websocket.run_forever(ping_interval=10, ping_timeout=5)
            except Exception as e:
                self.get_logger().warn("WebSocket error: %s" % str(e))
            self.websocket_connected = False
            time.sleep(RECONNECT_DELAY)

    def on_ws_open(self, ws):
        self.websocket_connected = True
        self.get_logger().info("Connected to Pi rosbridge")

        for topic, msg_type in [
            ("/scan", "sensor_msgs/LaserScan"),
            ("/odom", "nav_msgs/Odometry"),
            ("/imu", "sensor_msgs/Imu"),
            ("/tf", "tf2_msgs/TFMessage"),
        ]:
            ws.send(
                json.dumps(
                    {
                        "op": "subscribe",
                        "topic": topic,
                        "type": msg_type,
                        "throttle_rate": 0,
                        "queue_length": 1,
                    }
                )
            )
            self.get_logger().info("Subscribed to %s" % topic)

    def on_ws_close(self, ws, close_status_code, close_msg):
        self.websocket_connected = False
        self.get_logger().warn("Disconnected from Pi rosbridge")

    def on_ws_error(self, ws, error):
        self.get_logger().warn("WebSocket error: %s" % str(error))

    def on_ws_message(self, ws, raw_message):
        try:
            message = json.loads(raw_message)
            if message.get("op") != "publish":
                return

            topic = message.get("topic", "")
            msg = message.get("msg", {})

            if topic == "/scan":
                self.handle_scan(msg)
            elif topic == "/odom":
                self.handle_odom(msg)
            elif topic == "/imu":
                self.handle_imu(msg)
            elif topic == "/tf":
                self.handle_tf(msg)
        except Exception as e:
            self.get_logger().warn("Failed to process message: %s" % str(e))

    def build_stamp(self, stamp_dict):
        sec = stamp_dict.get("sec", 0)
        nanosec = stamp_dict.get("nanosec", 0)
        return sec, nanosec

    def handle_scan(self, msg):
        scan = LaserScan()
        header = msg.get("header", {})
        stamp = header.get("stamp", {})
        scan.header.stamp.sec, scan.header.stamp.nanosec = self.build_stamp(stamp)
        scan.header.frame_id = header.get("frame_id", "base_scan")
        scan.angle_min = float(msg.get("angle_min", 0.0))
        scan.angle_max = float(msg.get("angle_max", 0.0))
        scan.angle_increment = float(msg.get("angle_increment", 0.0))
        scan.time_increment = float(msg.get("time_increment", 0.0))
        scan.scan_time = float(msg.get("scan_time", 0.0))
        scan.range_min = float(msg.get("range_min", 0.0))
        scan.range_max = float(msg.get("range_max", 0.0))
        scan.ranges = [float(r) for r in msg.get("ranges", [])]
        scan.intensities = [float(i) for i in msg.get("intensities", [])]

        self.scan_publisher.publish(scan)
        self.scan_reliable_publisher.publish(scan)

    def handle_odom(self, msg):
        odom = Odometry()
        header = msg.get("header", {})
        stamp = header.get("stamp", {})
        odom.header.stamp.sec, odom.header.stamp.nanosec = self.build_stamp(stamp)
        odom.header.frame_id = header.get("frame_id", "odom")
        odom.child_frame_id = msg.get("child_frame_id", "base_footprint")

        pose = msg.get("pose", {}).get("pose", {})
        position = pose.get("position", {})
        orientation = pose.get("orientation", {})
        odom.pose.pose.position.x = float(position.get("x", 0.0))
        odom.pose.pose.position.y = float(position.get("y", 0.0))
        odom.pose.pose.position.z = float(position.get("z", 0.0))
        odom.pose.pose.orientation.x = float(orientation.get("x", 0.0))
        odom.pose.pose.orientation.y = float(orientation.get("y", 0.0))
        odom.pose.pose.orientation.z = float(orientation.get("z", 0.0))
        odom.pose.pose.orientation.w = float(orientation.get("w", 1.0))

        twist = msg.get("twist", {}).get("twist", {})
        linear = twist.get("linear", {})
        angular = twist.get("angular", {})
        odom.twist.twist.linear.x = float(linear.get("x", 0.0))
        odom.twist.twist.linear.y = float(linear.get("y", 0.0))
        odom.twist.twist.linear.z = float(linear.get("z", 0.0))
        odom.twist.twist.angular.x = float(angular.get("x", 0.0))
        odom.twist.twist.angular.y = float(angular.get("y", 0.0))
        odom.twist.twist.angular.z = float(angular.get("z", 0.0))

        self.odom_publisher.publish(odom)

    def handle_imu(self, msg):
        imu = Imu()
        header = msg.get("header", {})
        stamp = header.get("stamp", {})
        imu.header.stamp.sec, imu.header.stamp.nanosec = self.build_stamp(stamp)
        imu.header.frame_id = header.get("frame_id", "imu_link")

        orientation = msg.get("orientation", {})
        imu.orientation.x = float(orientation.get("x", 0.0))
        imu.orientation.y = float(orientation.get("y", 0.0))
        imu.orientation.z = float(orientation.get("z", 0.0))
        imu.orientation.w = float(orientation.get("w", 1.0))

        angular_velocity = msg.get("angular_velocity", {})
        imu.angular_velocity.x = float(angular_velocity.get("x", 0.0))
        imu.angular_velocity.y = float(angular_velocity.get("y", 0.0))
        imu.angular_velocity.z = float(angular_velocity.get("z", 0.0))

        linear_acceleration = msg.get("linear_acceleration", {})
        imu.linear_acceleration.x = float(linear_acceleration.get("x", 0.0))
        imu.linear_acceleration.y = float(linear_acceleration.get("y", 0.0))
        imu.linear_acceleration.z = float(linear_acceleration.get("z", 0.0))

        self.imu_publisher.publish(imu)

    def handle_tf(self, msg):
        transforms = msg.get("transforms", [])
        for tf_data in transforms:
            tf_msg = TransformStamped()
            header = tf_data.get("header", {})
            stamp = header.get("stamp", {})
            tf_msg.header.stamp.sec, tf_msg.header.stamp.nanosec = self.build_stamp(
                stamp
            )
            tf_msg.header.frame_id = header.get("frame_id", "")
            tf_msg.child_frame_id = tf_data.get("child_frame_id", "")

            transform = tf_data.get("transform", {})
            translation = transform.get("translation", {})
            rotation = transform.get("rotation", {})
            tf_msg.transform.translation.x = float(translation.get("x", 0.0))
            tf_msg.transform.translation.y = float(translation.get("y", 0.0))
            tf_msg.transform.translation.z = float(translation.get("z", 0.0))
            tf_msg.transform.rotation.x = float(rotation.get("x", 0.0))
            tf_msg.transform.rotation.y = float(rotation.get("y", 0.0))
            tf_msg.transform.rotation.z = float(rotation.get("z", 0.0))
            tf_msg.transform.rotation.w = float(rotation.get("w", 1.0))

            self.tf_broadcaster.sendTransform(tf_msg)


def main():
    rclpy.init()
    node = ScanBridge()
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
