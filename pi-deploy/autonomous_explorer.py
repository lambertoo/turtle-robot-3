#!/usr/bin/env python3

import json
import math
import os
import random
from enum import Enum, auto

import cv2
import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from geometry_msgs.msg import TwistStamped
from sensor_msgs.msg import LaserScan
from std_msgs.msg import String
from std_srvs.srv import Trigger


SAFE_DISTANCE = 0.30
LINEAR_SPEED = 0.15
ANGULAR_SPEED = 0.8
BACKUP_SPEED = 0.10
STUCK_SPIN_THRESHOLD = 20
BACKUP_ITERATIONS = 10
CAMERA_SNAP_PATH = "/tmp/camera/snap.jpg"
CAMERA_FLOOR_THRESHOLD = 0.40
CAMERA_CHECK_INTERVAL = 0.333
CONTROL_LOOP_INTERVAL = 0.100
STATUS_PUBLISH_INTERVAL = 0.500


class ExplorerState(Enum):
    IDLE = auto()
    EXPLORING = auto()
    BACKING_UP = auto()
    STOPPED = auto()


class AutonomousExplorer(Node):

    def __init__(self):
        super().__init__("autonomous_explorer")

        self.state = ExplorerState.IDLE

        self.lidar_front_distance = float("inf")
        self.lidar_left_distance = float("inf")
        self.lidar_right_distance = float("inf")
        self.lidar_rear_distance = float("inf")

        self.camera_left_obstacle = False
        self.camera_center_obstacle = False
        self.camera_right_obstacle = False

        self.spin_iterations_without_forward_progress = 0
        self.backup_iterations_remaining = 0
        self.backup_angular_direction = 1.0

        lidar_qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )
        self.lidar_subscription = self.create_subscription(
            LaserScan, "/scan", self.handle_lidar_scan, lidar_qos
        )

        self.velocity_publisher = self.create_publisher(TwistStamped, "/cmd_vel", 10)
        self.status_publisher = self.create_publisher(
            String, "/autonomous_explorer/status", 10
        )

        self.start_service = self.create_service(
            Trigger, "/autonomous_explorer/start", self.handle_start_request
        )
        self.stop_service = self.create_service(
            Trigger, "/autonomous_explorer/stop", self.handle_stop_request
        )

        self.control_loop_timer = self.create_timer(
            CONTROL_LOOP_INTERVAL, self.run_control_loop
        )
        self.camera_check_timer = self.create_timer(
            CAMERA_CHECK_INTERVAL, self.run_camera_check
        )
        self.status_publish_timer = self.create_timer(
            STATUS_PUBLISH_INTERVAL, self.publish_status
        )

        self.get_logger().info("AutonomousExplorer node initialized")

    def handle_start_request(self, request, response):
        if self.state in (ExplorerState.IDLE, ExplorerState.STOPPED):
            self.state = ExplorerState.EXPLORING
            self.spin_iterations_without_forward_progress = 0
            self.backup_iterations_remaining = 0
            response.success = True
            response.message = "Exploration started"
            self.get_logger().info("Exploration started via service call")
        else:
            response.success = False
            response.message = f"Cannot start from state {self.state.name}"
        return response

    def handle_stop_request(self, request, response):
        self.state = ExplorerState.STOPPED
        self.publish_zero_velocity()
        response.success = True
        response.message = "Exploration stopped"
        self.get_logger().info("Exploration stopped via service call")
        return response

    def handle_lidar_scan(self, scan_message):
        ranges = scan_message.ranges
        total_rays = len(ranges)
        if total_rays == 0:
            return

        sector_size = total_rays // 12
        quarter_size = total_rays // 4

        front_indices = list(range(0, sector_size)) + list(
            range(total_rays - sector_size, total_rays)
        )
        left_indices = list(range(sector_size, quarter_size))
        right_indices = list(range(total_rays - quarter_size, total_rays - sector_size))
        rear_center = total_rays // 2
        rear_indices = list(range(rear_center - sector_size, rear_center + sector_size))

        self.lidar_front_distance = self.minimum_valid_range(ranges, front_indices)
        self.lidar_left_distance = self.minimum_valid_range(ranges, left_indices)
        self.lidar_right_distance = self.minimum_valid_range(ranges, right_indices)
        self.lidar_rear_distance = self.minimum_valid_range(ranges, rear_indices)

    def minimum_valid_range(self, ranges, indices):
        valid_readings = [
            ranges[i]
            for i in indices
            if not math.isnan(ranges[i])
            and not math.isinf(ranges[i])
            and ranges[i] > 0.05
        ]
        if not valid_readings:
            return float("inf")
        return min(valid_readings)

    def run_camera_check(self):
        if self.state not in (ExplorerState.EXPLORING, ExplorerState.BACKING_UP):
            return
        try:
            if not os.path.exists(CAMERA_SNAP_PATH):
                return

            frame = cv2.imread(CAMERA_SNAP_PATH)
            if frame is None:
                return

            frame_height, frame_width = frame.shape[:2]
            floor_visible_region = frame[frame_height * 3 // 5 :, :]
            floor_hsv = cv2.cvtColor(floor_visible_region, cv2.COLOR_BGR2HSV)

            region_height, region_width = floor_hsv.shape[:2]
            sample_center_x = region_width // 2
            sample_center_y = region_height - 10
            sample_top_left_y = max(0, sample_center_y - 10)
            sample_top_left_x = max(0, sample_center_x - 10)
            sample_bottom_right_y = min(region_height, sample_center_y + 10)
            sample_bottom_right_x = min(region_width, sample_center_x + 10)

            floor_color_sample = floor_hsv[
                sample_top_left_y:sample_bottom_right_y,
                sample_top_left_x:sample_bottom_right_x,
            ]
            mean_floor_hsv = np.mean(floor_color_sample, axis=(0, 1))

            hsv_lower_bound = np.array(
                [
                    max(0, mean_floor_hsv[0] - 15),
                    max(0, mean_floor_hsv[1] - 50),
                    max(0, mean_floor_hsv[2] - 50),
                ]
            )
            hsv_upper_bound = np.array(
                [
                    min(179, mean_floor_hsv[0] + 15),
                    min(255, mean_floor_hsv[1] + 50),
                    min(255, mean_floor_hsv[2] + 50),
                ]
            )

            floor_mask = cv2.inRange(floor_hsv, hsv_lower_bound, hsv_upper_bound)

            sector_width = region_width // 3
            left_sector_mask = floor_mask[:, :sector_width]
            center_sector_mask = floor_mask[:, sector_width : 2 * sector_width]
            right_sector_mask = floor_mask[:, 2 * sector_width :]

            self.camera_left_obstacle = (
                self.floor_ratio_for_sector(left_sector_mask) < CAMERA_FLOOR_THRESHOLD
            )
            self.camera_center_obstacle = (
                self.floor_ratio_for_sector(center_sector_mask)
                < CAMERA_FLOOR_THRESHOLD
            )
            self.camera_right_obstacle = (
                self.floor_ratio_for_sector(right_sector_mask)
                < CAMERA_FLOOR_THRESHOLD
            )

        except Exception:
            pass

    def floor_ratio_for_sector(self, sector_mask):
        total_pixels = sector_mask.size
        if total_pixels == 0:
            return 1.0
        floor_pixels = np.count_nonzero(sector_mask)
        return floor_pixels / total_pixels

    def run_control_loop(self):
        if self.state == ExplorerState.EXPLORING:
            self.execute_exploration()
        elif self.state == ExplorerState.BACKING_UP:
            self.execute_backup()

    def execute_exploration(self):
        is_front_blocked = (
            self.lidar_front_distance <= SAFE_DISTANCE or self.camera_center_obstacle
        )
        is_left_blocked = (
            self.lidar_left_distance <= SAFE_DISTANCE or self.camera_left_obstacle
        )
        is_right_blocked = (
            self.lidar_right_distance <= SAFE_DISTANCE or self.camera_right_obstacle
        )

        if not is_front_blocked:
            self.spin_iterations_without_forward_progress = 0
            linear_x = LINEAR_SPEED
            angular_z = 0.0

            if is_left_blocked and not is_right_blocked:
                angular_z = -ANGULAR_SPEED * 0.5
            elif is_right_blocked and not is_left_blocked:
                angular_z = ANGULAR_SPEED * 0.5

            self.publish_velocity(linear_x, angular_z)
        else:
            self.spin_iterations_without_forward_progress += 1

            if (
                self.spin_iterations_without_forward_progress
                >= STUCK_SPIN_THRESHOLD
            ):
                self.transition_to_backup()
                return

            if self.lidar_left_distance > self.lidar_right_distance:
                spin_direction = ANGULAR_SPEED
            elif self.lidar_right_distance > self.lidar_left_distance:
                spin_direction = -ANGULAR_SPEED
            else:
                spin_direction = ANGULAR_SPEED if random.random() > 0.5 else -ANGULAR_SPEED

            self.publish_velocity(0.0, spin_direction)

    def transition_to_backup(self):
        self.state = ExplorerState.BACKING_UP
        self.backup_iterations_remaining = BACKUP_ITERATIONS
        self.backup_angular_direction = (
            ANGULAR_SPEED if random.random() > 0.5 else -ANGULAR_SPEED
        )
        self.spin_iterations_without_forward_progress = 0
        self.get_logger().info("Stuck detected, entering backup mode")

    def execute_backup(self):
        if self.backup_iterations_remaining <= 0:
            self.state = ExplorerState.EXPLORING
            self.get_logger().info("Backup complete, resuming exploration")
            return

        self.backup_iterations_remaining -= 1

        is_rear_clear = self.lidar_rear_distance > SAFE_DISTANCE
        if is_rear_clear:
            self.publish_velocity(-BACKUP_SPEED, self.backup_angular_direction)
        else:
            self.publish_velocity(0.0, self.backup_angular_direction)

    def publish_velocity(self, linear_x, angular_z):
        velocity_message = TwistStamped()
        velocity_message.header.stamp = self.get_clock().now().to_msg()
        velocity_message.header.frame_id = "base_link"
        velocity_message.twist.linear.x = -linear_x
        velocity_message.twist.angular.z = -angular_z
        self.velocity_publisher.publish(velocity_message)

    def publish_zero_velocity(self):
        self.publish_velocity(0.0, 0.0)

    def publish_status(self):
        status_data = {
            "state": self.state.name.lower(),
            "lidar_front": round(self.lidar_front_distance, 2),
            "camera_left": self.camera_left_obstacle,
            "camera_center": self.camera_center_obstacle,
            "camera_right": self.camera_right_obstacle,
        }
        status_message = String()
        status_message.data = json.dumps(status_data)
        self.status_publisher.publish(status_message)


def main(args=None):
    rclpy.init(args=args)
    node = AutonomousExplorer()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.publish_zero_velocity()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
