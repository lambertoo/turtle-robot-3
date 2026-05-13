import { useState, useEffect, useRef } from "react";
import { Ros, Topic } from "roslib";
import type { OccupancyGrid, Pose } from "../lib/ros-types";

interface UseMapSubscriptionOptions {
  ros: Ros | null;
  isConnected: boolean;
  isActive: boolean;
}

interface MapSubscriptionData {
  occupancyGrid: OccupancyGrid | null;
  robotPose: Pose | null;
}

export function useMapSubscription({
  ros,
  isConnected,
  isActive,
}: UseMapSubscriptionOptions): MapSubscriptionData {
  const [occupancyGrid, setOccupancyGrid] = useState<OccupancyGrid | null>(null);
  const [robotPose, setRobotPose] = useState<Pose | null>(null);
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
      name: "/robot_pose",
      messageType: "geometry_msgs/msg/Pose",
      throttle_rate: 200,
    });

    poseTopic.subscribe((message: unknown) => {
      setRobotPose(message as Pose);
    });

    poseTopicRef.current = poseTopic;

    return () => {
      mapTopic.unsubscribe();
      poseTopic.unsubscribe();
      mapTopicRef.current = null;
      poseTopicRef.current = null;
    };
  }, [ros, isConnected, isActive]);

  return { occupancyGrid, robotPose };
}
