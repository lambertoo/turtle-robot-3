#!/usr/bin/env python3

import json
import math
import os
import time

import cv2
import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy, HistoryPolicy
from rclpy.callback_groups import ReentrantCallbackGroup
from geometry_msgs.msg import PoseStamped, TwistStamped
from nav_msgs.msg import OccupancyGrid, Odometry
from sensor_msgs.msg import Imu, LaserScan
from std_msgs.msg import String
from std_srvs.srv import Trigger
from nav2_msgs.action import NavigateToPose
from action_msgs.msg import GoalStatus

ROBOT_BODY_OFFSET = 0.21
DESIRED_CLEARANCE = 0.30
SAFE_DISTANCE = ROBOT_BODY_OFFSET + DESIRED_CLEARANCE

FRONTIER_MIN_SIZE = 5
FRONTIER_SEARCH_RADIUS = 5.0
GOAL_REACHED_TOLERANCE = 0.3
GOAL_TIMEOUT_SECONDS = 60.0
BUMP_ACCELERATION_THRESHOLD = 3.0
CAMERA_SNAP_PATH = "/tmp/camera/snap.jpg"
CAMERA_FLOOR_THRESHOLD = 0.30
CAMERA_CHECK_INTERVAL = 0.5
EXPLORATION_LOOP_INTERVAL = 2.0
STATUS_PUBLISH_INTERVAL = 0.5
BLACKLIST_RADIUS = 0.5
MAX_BLACKLISTED = 30
BACKUP_SPEED = 0.10
BACKUP_DURATION = 2.0


class ExplorerState:
    IDLE = "idle"
    EXPLORING = "exploring"
    NAVIGATING = "navigating"
    RECOVERING = "recovering"
    COMPLETE = "complete"
    STOPPED = "stopped"


class FrontierExplorer(Node):

    def __init__(self):
        super().__init__("frontier_explorer")

        self.state = ExplorerState.IDLE
        self.current_map = None
        self.robot_x = 0.0
        self.robot_y = 0.0
        self.robot_yaw = 0.0
        self.blacklisted_goals = []
        self.current_goal = None
        self.goal_handle = None
        self.goal_start_time = 0.0
        self.bump_detected = False
        self.recovery_end_time = 0.0
        self.frontiers_found = 0
        self.goals_reached = 0
        self.goals_failed = 0

        self.camera_left_obstacle = False
        self.camera_center_obstacle = False
        self.camera_right_obstacle = False

        self.lidar_front_distance = 99.0

        callback_group = ReentrantCallbackGroup()

        map_qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )
        self.map_subscription = self.create_subscription(
            OccupancyGrid, "/map", self.handle_map_update, map_qos,
            callback_group=callback_group,
        )

        self.odom_subscription = self.create_subscription(
            Odometry, "/odom", self.handle_odom_update, 10,
            callback_group=callback_group,
        )

        self.imu_subscription = self.create_subscription(
            Imu, "/imu", self.handle_imu_update, 10,
            callback_group=callback_group,
        )

        lidar_qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.VOLATILE,
            history=HistoryPolicy.KEEP_LAST,
            depth=5,
        )
        self.lidar_subscription = self.create_subscription(
            LaserScan, "/scan_reliable", self.handle_lidar_scan, lidar_qos,
            callback_group=callback_group,
        )

        self.navigate_client = ActionClient(
            self, NavigateToPose, "navigate_to_pose",
            callback_group=callback_group,
        )

        self.velocity_publisher = self.create_publisher(TwistStamped, "/cmd_vel", 10)
        self.status_publisher = self.create_publisher(
            String, "/autonomous_explorer/status", 10
        )

        self.start_service = self.create_service(
            Trigger, "/autonomous_explorer/start", self.handle_start_request,
            callback_group=callback_group,
        )
        self.stop_service = self.create_service(
            Trigger, "/autonomous_explorer/stop", self.handle_stop_request,
            callback_group=callback_group,
        )

        self.exploration_timer = self.create_timer(
            EXPLORATION_LOOP_INTERVAL, self.exploration_loop,
            callback_group=callback_group,
        )
        self.camera_timer = self.create_timer(
            CAMERA_CHECK_INTERVAL, self.run_camera_check,
            callback_group=callback_group,
        )
        self.status_timer = self.create_timer(
            STATUS_PUBLISH_INTERVAL, self.publish_status,
            callback_group=callback_group,
        )

        self.get_logger().info("FrontierExplorer initialized (Nav2 costmap mode)")

    def handle_start_request(self, request, response):
        if self.state in (ExplorerState.IDLE, ExplorerState.STOPPED, ExplorerState.COMPLETE):
            self.state = ExplorerState.EXPLORING
            self.blacklisted_goals = []
            self.current_goal = None
            self.goal_handle = None
            self.goals_reached = 0
            self.goals_failed = 0
            self.bump_detected = False
            response.success = True
            response.message = "Frontier exploration started"
            self.get_logger().info("Exploration started")
        else:
            response.success = False
            response.message = f"Cannot start from state {self.state}"
        return response

    def handle_stop_request(self, request, response):
        if self.goal_handle is not None:
            self.goal_handle.cancel_goal_async()
            self.goal_handle = None
        self.state = ExplorerState.STOPPED
        self.current_goal = None
        self.publish_zero_velocity()
        response.success = True
        response.message = "Exploration stopped"
        self.get_logger().info("Exploration stopped")
        return response

    def handle_map_update(self, map_message):
        self.current_map = map_message

    def handle_odom_update(self, odom_message):
        self.robot_x = odom_message.pose.pose.position.x
        self.robot_y = odom_message.pose.pose.position.y
        orientation = odom_message.pose.pose.orientation
        siny_cosp = 2.0 * (orientation.w * orientation.z + orientation.x * orientation.y)
        cosy_cosp = 1.0 - 2.0 * (orientation.y * orientation.y + orientation.z * orientation.z)
        self.robot_yaw = math.atan2(siny_cosp, cosy_cosp)

    def handle_imu_update(self, imu_message):
        accel_x = imu_message.linear_acceleration.x
        accel_y = imu_message.linear_acceleration.y
        accel_magnitude = math.sqrt(accel_x ** 2 + accel_y ** 2)

        if accel_magnitude > BUMP_ACCELERATION_THRESHOLD and self.state == ExplorerState.NAVIGATING:
            self.bump_detected = True
            self.get_logger().warn(
                f"Bump detected! accel={accel_magnitude:.2f} m/s^2, canceling navigation"
            )

    def handle_lidar_scan(self, scan_message):
        ranges = scan_message.ranges
        total_rays = len(ranges)
        if total_rays == 0:
            return
        sector_size = total_rays // 12
        front_indices = list(range(0, sector_size)) + list(
            range(total_rays - sector_size, total_rays)
        )
        valid_front = [
            ranges[i] for i in front_indices
            if not math.isnan(ranges[i]) and not math.isinf(ranges[i]) and ranges[i] > 0.05
        ]
        self.lidar_front_distance = min(valid_front) if valid_front else 99.0

    def run_camera_check(self):
        if self.state not in (ExplorerState.NAVIGATING, ExplorerState.EXPLORING):
            return
        try:
            if not os.path.exists(CAMERA_SNAP_PATH):
                return
            frame = cv2.imread(CAMERA_SNAP_PATH)
            if frame is None:
                return

            frame_height, frame_width = frame.shape[:2]
            floor_region = frame[frame_height * 3 // 5:, :]
            floor_hsv = cv2.cvtColor(floor_region, cv2.COLOR_BGR2HSV)

            region_height, region_width = floor_hsv.shape[:2]
            sample_y = region_height - 10
            sample_x = region_width // 2
            sample = floor_hsv[
                max(0, sample_y - 10):min(region_height, sample_y + 10),
                max(0, sample_x - 10):min(region_width, sample_x + 10),
            ]
            mean_hsv = np.mean(sample, axis=(0, 1))

            lower = np.array([max(0, mean_hsv[0] - 15), max(0, mean_hsv[1] - 50), max(0, mean_hsv[2] - 50)])
            upper = np.array([min(179, mean_hsv[0] + 15), min(255, mean_hsv[1] + 50), min(255, mean_hsv[2] + 50)])
            mask = cv2.inRange(floor_hsv, lower, upper)

            sector_width = region_width // 3
            left_ratio = np.count_nonzero(mask[:, :sector_width]) / mask[:, :sector_width].size
            center_ratio = np.count_nonzero(mask[:, sector_width:2*sector_width]) / mask[:, sector_width:2*sector_width].size
            right_ratio = np.count_nonzero(mask[:, 2*sector_width:]) / mask[:, 2*sector_width:].size

            self.camera_left_obstacle = left_ratio < CAMERA_FLOOR_THRESHOLD
            self.camera_center_obstacle = center_ratio < CAMERA_FLOOR_THRESHOLD
            self.camera_right_obstacle = right_ratio < CAMERA_FLOOR_THRESHOLD
        except Exception:
            pass

    def exploration_loop(self):
        if self.state == ExplorerState.IDLE or self.state == ExplorerState.STOPPED:
            return

        if self.state == ExplorerState.COMPLETE:
            return

        if self.state == ExplorerState.RECOVERING:
            if time.time() < self.recovery_end_time:
                self.publish_velocity(-BACKUP_SPEED, 0.0)
                return
            self.publish_zero_velocity()
            self.state = ExplorerState.EXPLORING
            self.get_logger().info("Recovery complete, resuming exploration")
            return

        if self.bump_detected:
            self.bump_detected = False
            if self.goal_handle is not None:
                self.goal_handle.cancel_goal_async()
                self.goal_handle = None
            self.current_goal = None
            self.state = ExplorerState.RECOVERING
            self.recovery_end_time = time.time() + BACKUP_DURATION
            self.get_logger().info("Entering recovery after bump")
            return

        if self.camera_center_obstacle and self.state == ExplorerState.NAVIGATING:
            if self.lidar_front_distance > SAFE_DISTANCE:
                self.get_logger().warn(
                    "Camera sees obstacle Nav2 might miss — canceling goal"
                )
                if self.goal_handle is not None:
                    self.goal_handle.cancel_goal_async()
                    self.goal_handle = None
                if self.current_goal is not None:
                    self.blacklisted_goals.append(self.current_goal)
                self.current_goal = None
                self.state = ExplorerState.RECOVERING
                self.recovery_end_time = time.time() + BACKUP_DURATION
                return

        if self.state == ExplorerState.NAVIGATING:
            if self.goal_handle is None:
                self.state = ExplorerState.EXPLORING
                return

            elapsed = time.time() - self.goal_start_time
            if elapsed > GOAL_TIMEOUT_SECONDS:
                self.get_logger().warn(f"Goal timed out after {elapsed:.0f}s")
                self.goal_handle.cancel_goal_async()
                self.goal_handle = None
                if self.current_goal is not None:
                    self.blacklisted_goals.append(self.current_goal)
                self.current_goal = None
                self.goals_failed += 1
                self.state = ExplorerState.EXPLORING
            return

        if self.state == ExplorerState.EXPLORING:
            self.find_and_navigate_to_frontier()

    def find_and_navigate_to_frontier(self):
        if self.current_map is None:
            self.get_logger().info("Waiting for map from cartographer...")
            return

        frontiers = self.extract_frontiers(self.current_map)
        self.frontiers_found = len(frontiers)

        if not frontiers:
            self.get_logger().info("No frontiers found — exploration may be complete")
            self.state = ExplorerState.COMPLETE
            self.publish_zero_velocity()
            return

        best_frontier = self.pick_best_frontier(frontiers)
        if best_frontier is None:
            self.get_logger().info("All reachable frontiers blacklisted")
            if len(self.blacklisted_goals) > MAX_BLACKLISTED // 2:
                self.blacklisted_goals = self.blacklisted_goals[-10:]
            self.state = ExplorerState.COMPLETE
            return

        goal_x, goal_y = best_frontier
        self.get_logger().info(
            f"Navigating to frontier ({goal_x:.2f}, {goal_y:.2f}), "
            f"distance={self.distance_to(goal_x, goal_y):.2f}m, "
            f"frontiers={len(frontiers)}"
        )
        self.send_navigation_goal(goal_x, goal_y)

    def extract_frontiers(self, occupancy_grid):
        width = occupancy_grid.info.width
        height = occupancy_grid.info.height
        resolution = occupancy_grid.info.resolution
        origin_x = occupancy_grid.info.origin.position.x
        origin_y = occupancy_grid.info.origin.position.y
        data = np.array(occupancy_grid.data, dtype=np.int8).reshape((height, width))

        free_mask = data == 0
        unknown_mask = data == -1

        frontier_mask = np.zeros_like(free_mask)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            shifted_unknown = np.roll(np.roll(unknown_mask, dy, axis=0), dx, axis=1)
            frontier_mask |= (free_mask & shifted_unknown)

        frontier_coords = np.argwhere(frontier_mask)
        if len(frontier_coords) == 0:
            return []

        frontier_world = []
        for row, col in frontier_coords:
            world_x = origin_x + (col + 0.5) * resolution
            world_y = origin_y + (row + 0.5) * resolution
            distance = self.distance_to(world_x, world_y)
            if distance < FRONTIER_SEARCH_RADIUS and distance > GOAL_REACHED_TOLERANCE:
                frontier_world.append((world_x, world_y))

        if not frontier_world:
            return []

        clusters = self.cluster_frontiers(frontier_world, resolution * 3)
        valid_clusters = [c for c in clusters if len(c) >= FRONTIER_MIN_SIZE]

        centroids = []
        for cluster in valid_clusters:
            cx = np.mean([p[0] for p in cluster])
            cy = np.mean([p[1] for p in cluster])
            centroids.append((cx, cy))

        return centroids

    def cluster_frontiers(self, points, cluster_distance):
        if not points:
            return []

        visited = [False] * len(points)
        clusters = []

        for i in range(len(points)):
            if visited[i]:
                continue
            cluster = [points[i]]
            visited[i] = True
            queue = [i]

            while queue:
                current = queue.pop(0)
                for j in range(len(points)):
                    if visited[j]:
                        continue
                    dist = math.sqrt(
                        (points[current][0] - points[j][0]) ** 2 +
                        (points[current][1] - points[j][1]) ** 2
                    )
                    if dist < cluster_distance:
                        visited[j] = True
                        cluster.append(points[j])
                        queue.append(j)

            clusters.append(cluster)

        return clusters

    def pick_best_frontier(self, frontier_centroids):
        scored = []
        for cx, cy in frontier_centroids:
            if self.is_blacklisted(cx, cy):
                continue
            distance = self.distance_to(cx, cy)
            if distance < 0.1:
                continue
            score = 1.0 / (distance + 0.1)
            scored.append((score, cx, cy))

        if not scored:
            return None

        scored.sort(reverse=True)
        return (scored[0][1], scored[0][2])

    def is_blacklisted(self, x, y):
        for bx, by in self.blacklisted_goals:
            if math.sqrt((x - bx) ** 2 + (y - by) ** 2) < BLACKLIST_RADIUS:
                return True
        return False

    def distance_to(self, x, y):
        return math.sqrt((self.robot_x - x) ** 2 + (self.robot_y - y) ** 2)

    def send_navigation_goal(self, goal_x, goal_y):
        if not self.navigate_client.wait_for_server(timeout_sec=2.0):
            self.get_logger().warn("Nav2 action server not available")
            return

        goal_msg = NavigateToPose.Goal()
        goal_msg.pose.header.frame_id = "map"
        goal_msg.pose.header.stamp = self.get_clock().now().to_msg()
        goal_msg.pose.pose.position.x = goal_x
        goal_msg.pose.pose.position.y = goal_y

        angle_to_goal = math.atan2(goal_y - self.robot_y, goal_x - self.robot_x)
        goal_msg.pose.pose.orientation.z = math.sin(angle_to_goal / 2.0)
        goal_msg.pose.pose.orientation.w = math.cos(angle_to_goal / 2.0)

        self.current_goal = (goal_x, goal_y)
        self.goal_start_time = time.time()
        self.state = ExplorerState.NAVIGATING

        future = self.navigate_client.send_goal_async(
            goal_msg, feedback_callback=self.navigation_feedback
        )
        future.add_done_callback(self.navigation_goal_response)

    def navigation_goal_response(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().warn("Navigation goal rejected by Nav2")
            self.goals_failed += 1
            if self.current_goal:
                self.blacklisted_goals.append(self.current_goal)
            self.current_goal = None
            self.goal_handle = None
            self.state = ExplorerState.EXPLORING
            return

        self.goal_handle = goal_handle
        result_future = goal_handle.get_result_async()
        result_future.add_done_callback(self.navigation_result)

    def navigation_feedback(self, feedback_msg):
        pass

    def navigation_result(self, future):
        result = future.result()
        status = result.status

        if status == GoalStatus.STATUS_SUCCEEDED:
            self.get_logger().info(
                f"Reached frontier ({self.current_goal[0]:.2f}, {self.current_goal[1]:.2f})"
            )
            self.goals_reached += 1
        elif status == GoalStatus.STATUS_CANCELED:
            self.get_logger().info("Navigation canceled")
            self.goals_failed += 1
        else:
            self.get_logger().warn(f"Navigation failed with status {status}")
            self.goals_failed += 1
            if self.current_goal:
                self.blacklisted_goals.append(self.current_goal)

        self.current_goal = None
        self.goal_handle = None
        if self.state == ExplorerState.NAVIGATING:
            self.state = ExplorerState.EXPLORING

    def publish_velocity(self, linear_x, angular_z):
        msg = TwistStamped()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = "base_link"
        msg.twist.linear.x = -linear_x
        msg.twist.angular.z = -angular_z
        self.velocity_publisher.publish(msg)

    def publish_zero_velocity(self):
        self.publish_velocity(0.0, 0.0)

    def publish_status(self):
        status_data = {
            "state": self.state,
            "lidar_front": round(self.lidar_front_distance, 2),
            "lidar_left": 99.0,
            "lidar_right": 99.0,
            "camera_left": self.camera_left_obstacle,
            "camera_center": self.camera_center_obstacle,
            "camera_right": self.camera_right_obstacle,
            "frontiers": self.frontiers_found,
            "goals_reached": self.goals_reached,
            "goals_failed": self.goals_failed,
            "goal": list(self.current_goal) if self.current_goal else None,
        }
        msg = String()
        msg.data = json.dumps(status_data)
        self.status_publisher.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = FrontierExplorer()
    executor = rclpy.executors.MultiThreadedExecutor()
    executor.add_node(node)
    try:
        executor.spin()
    except (KeyboardInterrupt, rclpy.executors.ExternalShutdownException):
        pass
    finally:
        try:
            node.publish_zero_velocity()
        except Exception:
            pass
        node.destroy_node()
        try:
            rclpy.shutdown()
        except Exception:
            pass


if __name__ == "__main__":
    main()
