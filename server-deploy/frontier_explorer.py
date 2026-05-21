#!/usr/bin/env python3

import json
import math
import os
import time

import cv2
import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy, HistoryPolicy
from rclpy.callback_groups import ReentrantCallbackGroup
from geometry_msgs.msg import TwistStamped
from nav_msgs.msg import OccupancyGrid, Odometry
from sensor_msgs.msg import Imu, LaserScan
from std_msgs.msg import String
from std_srvs.srv import Trigger
from tf2_ros import Buffer, TransformListener, LookupException, ConnectivityException, ExtrapolationException

ROBOT_BODY_OFFSET = 0.21
DESIRED_CLEARANCE = 0.30
SAFE_DISTANCE = ROBOT_BODY_OFFSET + DESIRED_CLEARANCE

FREE_THRESHOLD = 50
FRONTIER_MIN_SIZE = 3
FRONTIER_SEARCH_RADIUS = 5.0
GOAL_REACHED_TOLERANCE = 0.3
GOAL_TIMEOUT_SECONDS = 30.0
BUMP_ACCELERATION_THRESHOLD = 3.0
CAMERA_SNAP_PATH = "/tmp/camera/snap.jpg"
CAMERA_FLOOR_THRESHOLD = 0.30
CAMERA_CHECK_INTERVAL = 0.5
CONTROL_LOOP_INTERVAL = 0.2
STATUS_PUBLISH_INTERVAL = 0.5
BLACKLIST_RADIUS = 0.5
MAX_BLACKLISTED = 30
BACKUP_SPEED = 0.10
BACKUP_DURATION = 2.0

MAX_LINEAR_SPEED = 0.12
MAX_ANGULAR_SPEED = 0.6
ANGULAR_GAIN = 1.5
HEADING_TOLERANCE = 0.3
OBSTACLE_STOP_DISTANCE = 0.35


class ExplorerState:
    IDLE = "idle"
    EXPLORING = "exploring"
    ROTATING = "rotating"
    DRIVING = "driving"
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
        self.goal_start_time = 0.0
        self.bump_detected = False
        self.recovery_end_time = 0.0
        self.frontiers_found = 0
        self.goals_reached = 0
        self.goals_failed = 0
        self.last_frontier_check_time = 0.0

        self.camera_left_obstacle = False
        self.camera_center_obstacle = False
        self.camera_right_obstacle = False

        self.lidar_front_distance = 99.0
        self.lidar_left_distance = 99.0
        self.lidar_right_distance = 99.0

        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)

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

        self.control_timer = self.create_timer(
            CONTROL_LOOP_INTERVAL, self.control_loop,
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

        self.get_logger().info("FrontierExplorer initialized (reactive controller)")

    def handle_start_request(self, request, response):
        if self.state in (ExplorerState.IDLE, ExplorerState.STOPPED, ExplorerState.COMPLETE):
            self.state = ExplorerState.EXPLORING
            self.blacklisted_goals = []
            self.current_goal = None
            self.goals_reached = 0
            self.goals_failed = 0
            self.bump_detected = False
            self.last_frontier_check_time = 0.0
            response.success = True
            response.message = "Frontier exploration started"
            self.get_logger().info("Exploration started")
        else:
            response.success = False
            response.message = "Cannot start from state %s" % self.state
        return response

    def handle_stop_request(self, request, response):
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
        try:
            transform = self.tf_buffer.lookup_transform("map", "base_link", rclpy.time.Time())
            self.robot_x = transform.transform.translation.x
            self.robot_y = transform.transform.translation.y
            orientation = transform.transform.rotation
        except (LookupException, ConnectivityException, ExtrapolationException):
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

        if accel_magnitude > BUMP_ACCELERATION_THRESHOLD and self.state in (ExplorerState.DRIVING, ExplorerState.ROTATING):
            self.bump_detected = True
            self.get_logger().warn("Bump detected! accel=%.2f m/s^2" % accel_magnitude)

    def handle_lidar_scan(self, scan_message):
        ranges = scan_message.ranges
        total_rays = len(ranges)
        if total_rays == 0:
            return

        sector_size = total_rays // 12

        front_indices = list(range(0, sector_size)) + list(range(total_rays - sector_size, total_rays))
        left_indices = list(range(total_rays // 4 - sector_size, total_rays // 4 + sector_size))
        right_indices = list(range(3 * total_rays // 4 - sector_size, 3 * total_rays // 4 + sector_size))

        def min_valid(indices):
            valid = [ranges[i] for i in indices if not math.isnan(ranges[i]) and not math.isinf(ranges[i]) and ranges[i] > 0.05]
            return min(valid) if valid else 99.0

        self.lidar_front_distance = min_valid(front_indices)
        self.lidar_left_distance = min_valid(left_indices)
        self.lidar_right_distance = min_valid(right_indices)

    def run_camera_check(self):
        if self.state not in (ExplorerState.DRIVING, ExplorerState.ROTATING, ExplorerState.EXPLORING):
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

    def control_loop(self):
        if self.state in (ExplorerState.IDLE, ExplorerState.STOPPED, ExplorerState.COMPLETE):
            return

        if self.bump_detected:
            self.bump_detected = False
            if self.current_goal is not None:
                self.blacklisted_goals.append(self.current_goal)
            self.current_goal = None
            self.state = ExplorerState.RECOVERING
            self.recovery_end_time = time.time() + BACKUP_DURATION
            self.get_logger().info("Entering recovery after bump")
            return

        if self.state == ExplorerState.RECOVERING:
            if time.time() < self.recovery_end_time:
                self.publish_velocity(-BACKUP_SPEED, 0.0)
                return
            self.publish_zero_velocity()
            self.state = ExplorerState.EXPLORING
            self.get_logger().info("Recovery complete, resuming exploration")
            return

        if self.state == ExplorerState.EXPLORING:
            now = time.time()
            if now - self.last_frontier_check_time < 2.0:
                return
            self.last_frontier_check_time = now
            self.find_next_frontier()
            return

        if self.current_goal is None:
            self.state = ExplorerState.EXPLORING
            return

        if time.time() - self.goal_start_time > GOAL_TIMEOUT_SECONDS:
            self.get_logger().warn("Goal timed out")
            self.blacklisted_goals.append(self.current_goal)
            self.current_goal = None
            self.goals_failed += 1
            self.state = ExplorerState.EXPLORING
            self.publish_zero_velocity()
            return

        goal_x, goal_y = self.current_goal
        distance = self.distance_to(goal_x, goal_y)

        if distance < GOAL_REACHED_TOLERANCE:
            self.get_logger().info("Reached frontier (%.2f, %.2f)" % (goal_x, goal_y))
            self.goals_reached += 1
            self.current_goal = None
            self.state = ExplorerState.EXPLORING
            self.publish_zero_velocity()
            return

        if self.lidar_front_distance < OBSTACLE_STOP_DISTANCE:
            self.get_logger().info("Obstacle ahead (lidar=%.2fm), blacklisting goal" % self.lidar_front_distance)
            self.blacklisted_goals.append(self.current_goal)
            self.current_goal = None
            self.goals_failed += 1
            self.state = ExplorerState.RECOVERING
            self.recovery_end_time = time.time() + BACKUP_DURATION
            self.publish_zero_velocity()
            return

        angle_to_goal = math.atan2(goal_y - self.robot_y, goal_x - self.robot_x)
        heading_error = self.normalize_angle(angle_to_goal - self.robot_yaw)

        if self.state == ExplorerState.ROTATING:
            if abs(heading_error) < HEADING_TOLERANCE:
                if self.lidar_front_distance < SAFE_DISTANCE:
                    self.get_logger().info("Path blocked after rotation (%.2fm), skipping" % self.lidar_front_distance)
                    self.blacklisted_goals.append(self.current_goal)
                    self.current_goal = None
                    self.goals_failed += 1
                    self.state = ExplorerState.EXPLORING
                    self.publish_zero_velocity()
                else:
                    self.state = ExplorerState.DRIVING
            else:
                angular_speed = max(-MAX_ANGULAR_SPEED, min(MAX_ANGULAR_SPEED, ANGULAR_GAIN * heading_error))
                self.publish_velocity(0.0, angular_speed)
            return

        if self.state == ExplorerState.DRIVING:
            if abs(heading_error) > HEADING_TOLERANCE * 2:
                self.state = ExplorerState.ROTATING
                return

            angular_speed = max(-MAX_ANGULAR_SPEED, min(MAX_ANGULAR_SPEED, ANGULAR_GAIN * heading_error))

            speed_factor = 1.0
            if self.lidar_front_distance < SAFE_DISTANCE * 2:
                speed_factor = max(0.3, (self.lidar_front_distance - OBSTACLE_STOP_DISTANCE) / SAFE_DISTANCE)

            linear_speed = MAX_LINEAR_SPEED * speed_factor
            self.publish_velocity(linear_speed, angular_speed)

    def find_next_frontier(self):
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
            "Navigating to frontier (%.2f, %.2f), distance=%.2fm, frontiers=%d"
            % (goal_x, goal_y, self.distance_to(goal_x, goal_y), len(frontiers))
        )
        self.current_goal = (goal_x, goal_y)
        self.goal_start_time = time.time()
        self.state = ExplorerState.ROTATING

    def extract_frontiers(self, occupancy_grid):
        width = occupancy_grid.info.width
        height = occupancy_grid.info.height
        resolution = occupancy_grid.info.resolution
        origin_x = occupancy_grid.info.origin.position.x
        origin_y = occupancy_grid.info.origin.position.y
        data = np.array(occupancy_grid.data, dtype=np.int8).reshape((height, width))

        free_mask = (data >= 0) & (data < FREE_THRESHOLD)
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

    @staticmethod
    def normalize_angle(angle):
        while angle > math.pi:
            angle -= 2.0 * math.pi
        while angle < -math.pi:
            angle += 2.0 * math.pi
        return angle

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
            "lidar_left": round(self.lidar_left_distance, 2),
            "lidar_right": round(self.lidar_right_distance, 2),
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
