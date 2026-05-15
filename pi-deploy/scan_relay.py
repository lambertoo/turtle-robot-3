#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy, HistoryPolicy
from sensor_msgs.msg import LaserScan
from std_srvs.srv import SetBool


class ScanRelay(Node):
    def __init__(self):
        super().__init__("scan_relay")
        sub_qos = QoSProfile(
            depth=10,
            reliability=ReliabilityPolicy.BEST_EFFORT,
            durability=DurabilityPolicy.VOLATILE,
            history=HistoryPolicy.KEEP_LAST
        )
        pub_qos = QoSProfile(
            depth=10,
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.VOLATILE,
            history=HistoryPolicy.KEEP_LAST
        )
        self.publisher = self.create_publisher(LaserScan, "/scan_reliable", pub_qos)
        self.subscription = self.create_subscription(LaserScan, "/scan", self.on_scan, sub_qos)
        self.motor_power_client = self.create_client(SetBool, "/motor_power")
        self.count = 0
        self.motor_power_enabled = False
        self.motor_power_attempts = 0
        self.motor_power_pending = False
        self.motor_power_timer = self.create_timer(3.0, self.try_enable_motor_power)
        self.get_logger().info("Scan relay started")

    def on_scan(self, msg):
        self.publisher.publish(msg)
        self.count += 1
        if self.count % 100 == 1:
            self.get_logger().info(f"Relayed {self.count} scans ({len(msg.ranges)} ranges)")

    def try_enable_motor_power(self):
        if self.motor_power_enabled:
            self.motor_power_timer.cancel()
            return

        if self.motor_power_pending:
            return

        self.motor_power_attempts += 1

        if self.motor_power_attempts > 20:
            self.get_logger().error("Could not enable motor power after 20 attempts")
            self.motor_power_timer.cancel()
            return

        if not self.motor_power_client.service_is_ready():
            self.get_logger().info(
                f"Waiting for /motor_power service (attempt {self.motor_power_attempts}/20)..."
            )
            return

        request = SetBool.Request()
        request.data = True
        self.motor_power_pending = True
        future = self.motor_power_client.call_async(request)
        future.add_done_callback(self.motor_power_response)

    def motor_power_response(self, future):
        self.motor_power_pending = False
        try:
            result = future.result()
            if result is not None:
                self.motor_power_enabled = True
                self.get_logger().info("Motor power ENABLED")
                self.motor_power_timer.cancel()
            else:
                self.get_logger().warn("Motor power call returned None")
        except Exception as e:
            self.get_logger().warn(f"Motor power call failed: {e}")


def main():
    rclpy.init()
    node = ScanRelay()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
