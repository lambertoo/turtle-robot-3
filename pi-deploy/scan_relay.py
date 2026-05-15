#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy, HistoryPolicy
from sensor_msgs.msg import LaserScan

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
        self.count = 0
        self.get_logger().info("Scan relay v2 started")

    def on_scan(self, msg):
        self.publisher.publish(msg)
        self.count += 1
        if self.count % 100 == 1:
            self.get_logger().info(f"Relayed {self.count} scans ({len(msg.ranges)} ranges)")

def main():
    rclpy.init()
    node = ScanRelay()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == "__main__":
    main()
