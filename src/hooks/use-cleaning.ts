import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Ros, Topic, Service } from "roslib";
import { loadSavedMaps, type SavedMap } from "@/lib/map-storage";
import { generateCoveragePath, type CoverageWaypoint, type PlannerConfig } from "@/lib/boustrophedon-planner";
import type { OccupancyGrid } from "@/lib/ros-types";

export type CleaningPhase =
  | "idle"
  | "select-map"
  | "loading-map"
  | "planning"
  | "cleaning"
  | "paused"
  | "completed";

export interface CleaningState {
  phase: CleaningPhase;
  savedMaps: SavedMap[];
  selectedMap: SavedMap | null;
  waypoints: CoverageWaypoint[];
  currentWaypointIndex: number;
  totalWaypoints: number;
  progressPercent: number;
  missedWaypoints: number[];
  occupancyGrid: OccupancyGrid | null;
  elapsedSeconds: number;
}

interface UseCleaningOptions {
  ros: Ros | null;
  isConnected: boolean;
  isActive: boolean;
  plannerConfig: PlannerConfig;
}

export function useCleaning({ ros, isConnected, isActive, plannerConfig }: UseCleaningOptions) {
  const [phase, setPhase] = useState<CleaningPhase>("idle");
  const [selectedMap, setSelectedMap] = useState<SavedMap | null>(null);
  const [waypoints, setWaypoints] = useState<CoverageWaypoint[]>([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [missedWaypoints, setMissedWaypoints] = useState<number[]>([]);
  const [occupancyGrid, setOccupancyGrid] = useState<OccupancyGrid | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mapTopicRef = useRef<Topic | null>(null);
  const feedbackTopicRef = useRef<Topic | null>(null);
  const goalTopicRef = useRef<Topic | null>(null);
  const cancelTopicRef = useRef<Topic | null>(null);
  const resultTopicRef = useRef<Topic | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingWaypointsRef = useRef<CoverageWaypoint[]>([]);

  const resetState = useCallback(() => {
    setPhase("idle");
    setSelectedMap(null);
    setWaypoints([]);
    setCurrentWaypointIndex(0);
    setMissedWaypoints([]);
    setOccupancyGrid(null);
    setElapsedSeconds(0);
    remainingWaypointsRef.current = [];
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const cleanupTopics = useCallback(() => {
    [mapTopicRef, feedbackTopicRef, goalTopicRef, cancelTopicRef, resultTopicRef].forEach((ref) => {
      if (ref.current) {
        ref.current.unsubscribe();
        ref.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!isActive) {
      cleanupTopics();
      resetState();
    } else if (phase === "idle") {
      setPhase("select-map");
    }
  }, [isActive, cleanupTopics, resetState, phase]);

  const selectMap = useCallback((map: SavedMap) => {
    setSelectedMap(map);
    setPhase("loading-map");

    if (!ros || !isConnected) return;

    const loadService = new Service({
      ros,
      name: "/map_server/load_map",
      serviceType: "nav2_msgs/srv/LoadMap",
    });

    loadService.callService(
      { map_url: `${map.filePath}.yaml` },
      () => {
        const staticMapTopic = new Topic({
          ros: ros!,
          name: "/static_map",
          messageType: "nav_msgs/msg/OccupancyGrid",
          throttle_rate: 0,
        });

        staticMapTopic.subscribe((message: unknown) => {
          const grid = message as OccupancyGrid;
          setOccupancyGrid(grid);
          staticMapTopic.unsubscribe();
          mapTopicRef.current = null;

          setPhase("planning");
          const coverageWaypoints = generateCoveragePath(grid, plannerConfig);
          setWaypoints(coverageWaypoints);
          remainingWaypointsRef.current = coverageWaypoints;
          setPhase(coverageWaypoints.length > 0 ? "planning" : "completed");
        });

        mapTopicRef.current = staticMapTopic;
      },
      (error: string) => {
        console.error("[Cleaning] Failed to load map:", error);
        resetState();
      }
    );
  }, [ros, isConnected, plannerConfig, resetState]);

  const sendWaypoints = useCallback((waypointsToSend: CoverageWaypoint[]) => {
    if (!ros || !isConnected || waypointsToSend.length === 0) return;

    const poses = waypointsToSend.map((wp) => ({
      header: { frame_id: "map" },
      pose: {
        position: { x: wp.x, y: wp.y, z: 0 },
        orientation: quaternionFromYaw(wp.theta),
      },
    }));

    const goalTopic = new Topic({
      ros,
      name: "/follow_waypoints/_action/send_goal",
      messageType: "nav2_msgs/action/FollowWaypoints_SendGoal",
    });
    goalTopicRef.current = goalTopic;

    const feedbackTopic = new Topic({
      ros,
      name: "/follow_waypoints/_action/feedback",
      messageType: "nav2_msgs/action/FollowWaypoints_FeedbackMessage",
    });

    feedbackTopic.subscribe((message: unknown) => {
      const feedback = message as { feedback: { current_waypoint: number } };
      const baseIndex = waypoints.length - waypointsToSend.length;
      setCurrentWaypointIndex(baseIndex + feedback.feedback.current_waypoint);
    });
    feedbackTopicRef.current = feedbackTopic;

    const resultTopic = new Topic({
      ros,
      name: "/follow_waypoints/_action/status",
      messageType: "action_msgs/msg/GoalStatusArray",
    });
    resultTopicRef.current = resultTopic;

    const cancelTopic = new Topic({
      ros,
      name: "/follow_waypoints/_action/cancel_goal",
      messageType: "action_msgs/srv/CancelGoal_Request",
    });
    cancelTopicRef.current = cancelTopic;

    goalTopic.advertise();

    setTimeout(() => {
      goalTopic.publish({
        goal_id: { uuid: Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)) },
        goal: { poses },
      });
    }, 500);

  }, [ros, isConnected, waypoints.length]);

  const startCleaning = useCallback(() => {
    if (waypoints.length === 0) return;

    setPhase("cleaning");
    setCurrentWaypointIndex(0);
    setMissedWaypoints([]);
    setElapsedSeconds(0);

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);

    sendWaypoints(waypoints);
  }, [waypoints, sendWaypoints]);

  const cancelNavGoal = useCallback(() => {
    if (cancelTopicRef.current) {
      cancelTopicRef.current.advertise();
      setTimeout(() => {
        cancelTopicRef.current?.publish({
          goal_info: {
            goal_id: { uuid: Array.from({ length: 16 }, () => 0) },
            stamp: { sec: 0, nanosec: 0 },
          },
        });
      }, 200);
    }
  }, []);

  const pauseCleaning = useCallback(() => {
    cancelNavGoal();
    setPhase("paused");
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    remainingWaypointsRef.current = waypoints.slice(currentWaypointIndex);
  }, [cancelNavGoal, waypoints, currentWaypointIndex]);

  const resumeCleaning = useCallback(() => {
    setPhase("cleaning");
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);
    sendWaypoints(remainingWaypointsRef.current);
  }, [sendWaypoints]);

  const stopCleaning = useCallback(() => {
    cancelNavGoal();
    cleanupTopics();
    resetState();
  }, [cancelNavGoal, cleanupTopics, resetState]);

  const totalWaypoints = waypoints.length;
  const progressPercent = totalWaypoints > 0 ? Math.round((currentWaypointIndex / totalWaypoints) * 100) : 0;

  const savedMaps = useMemo(() => loadSavedMaps(), []);

  const cleaningState: CleaningState = {
    phase,
    savedMaps,
    selectedMap,
    waypoints,
    currentWaypointIndex,
    totalWaypoints,
    progressPercent,
    missedWaypoints,
    occupancyGrid,
    elapsedSeconds,
  };

  return {
    cleaningState,
    selectMap,
    startCleaning,
    pauseCleaning,
    resumeCleaning,
    stopCleaning,
  };
}

function quaternionFromYaw(yaw: number) {
  return {
    x: 0,
    y: 0,
    z: Math.sin(yaw / 2),
    w: Math.cos(yaw / 2),
  };
}
