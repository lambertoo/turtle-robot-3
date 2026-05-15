import { useState, useEffect, useRef } from "react";
import { Ros, Topic } from "roslib";
import type { OccupancyGrid, Pose } from "../lib/ros-types";

export interface UseMapSubscriptionOptions {
  ros: Ros | null;
  isConnected: boolean;
  isActive: boolean;
}

export interface RobotVelocity {
  linearX: number;
  angularZ: number;
}

export interface MapSubscriptionData {
  occupancyGrid: OccupancyGrid | null;
  robotPose: Pose | null;
  robotVelocity: RobotVelocity | null;
}

export function useMapSubscription({
  ros,
  isConnected,
  isActive,
}: UseMapSubscriptionOptions): MapSubscriptionData {
  const [occupancyGrid, setOccupancyGrid] = useState<OccupancyGrid | null>(null);
  const [robotPose, setRobotPose] = useState<Pose | null>(null);
  const [robotVelocity, setRobotVelocity] = useState<RobotVelocity | null>(null);
  const mapTopicRef = useRef<Topic | null>(null);
  const poseTopicRef = useRef<Topic | null>(null);

  useEffect(() => {
    if (!ros || !isConnected || !isActive) {
      if (mapTopicRef.current) {
        mapTopicRef.current.unsubscribe();
        mapTopicRef.current = null;
      }
      if (poseTopicRef.current) {
        poseTopicRef.current.unsubscribe();
        poseTopicRef.current = null;
      }
      return;
    }

    const mapTopic = new Topic({
      ros,
      name: "/map",
      messageType: "nav_msgs/msg/OccupancyGrid",
      throttle_rate: 1000,
    });

    mapTopic.subscribe((message: unknown) => {
      setOccupancyGrid(message as OccupancyGrid);
    });

    mapTopicRef.current = mapTopic;

    const poseTopic = new Topic({
      ros,
      name: "/odom",
      messageType: "nav_msgs/msg/Odometry",
      throttle_rate: 200,
    });

    poseTopic.subscribe((message: unknown) => {
      const odomMessage = message as {
        pose: { pose: Pose };
        twist: { twist: { linear: { x: number; y: number; z: number }; angular: { x: number; y: number; z: number } } };
      };
      setRobotPose(odomMessage.pose.pose);
      setRobotVelocity({
        linearX: odomMessage.twist.twist.linear.x,
        angularZ: odomMessage.twist.twist.angular.z,
      });
    });

    poseTopicRef.current = poseTopic;

    return () => {
      mapTopic.unsubscribe();
      poseTopic.unsubscribe();
      mapTopicRef.current = null;
      poseTopicRef.current = null;
    };
  }, [ros, isConnected, isActive]);

  return { occupancyGrid, robotPose, robotVelocity };
}
