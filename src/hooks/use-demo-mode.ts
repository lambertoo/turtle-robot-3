"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { OccupancyGrid, Pose } from "@/lib/ros-types";

const DEMO_GRID_SIZE = 100;
const DEMO_RESOLUTION = 0.05;
const POSE_UPDATE_INTERVAL_MS = 200;
const SLAM_REVEAL_INTERVAL_MS = 500;
const ROBOT_LINEAR_SPEED = 0.0004;
const WAYPOINT_REACHED_THRESHOLD = 0.05;

export interface DemoPatrolState {
  waypoints: Array<{ x: number; y: number }>;
  isLooping: boolean;
  isPatrolRunning: boolean;
  currentWaypointIndex: number;
}

export interface DemoModeResult {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  demoOccupancyGrid: OccupancyGrid | null;
  demoRobotPose: Pose | null;
  demoIsConnected: boolean;
  patrolState: DemoPatrolState;
  addWaypoint: (x: number, y: number) => void;
  removeWaypoint: (index: number) => void;
  clearWaypoints: () => void;
  togglePatrolLoop: () => void;
  startPatrol: () => void;
}

function buildBaseGridData(): number[] {
  const data: number[] = new Array(DEMO_GRID_SIZE * DEMO_GRID_SIZE).fill(-1);

  const setCell = (row: number, col: number, value: number) => {
    if (row >= 0 && row < DEMO_GRID_SIZE && col >= 0 && col < DEMO_GRID_SIZE) {
      data[row * DEMO_GRID_SIZE + col] = value;
    }
  };

  for (let i = 0; i < DEMO_GRID_SIZE; i++) {
    setCell(0, i, 100);
    setCell(DEMO_GRID_SIZE - 1, i, 100);
    setCell(i, 0, 100);
    setCell(i, DEMO_GRID_SIZE - 1, 100);
  }

  for (let row = 1; row < DEMO_GRID_SIZE - 1; row++) {
    for (let col = 1; col < DEMO_GRID_SIZE - 1; col++) {
      data[row * DEMO_GRID_SIZE + col] = 0;
    }
  }

  const obstacles: Array<{ row: number; col: number; width: number; height: number }> = [
    { row: 20, col: 15, width: 2, height: 20 },
    { row: 20, col: 16, width: 2, height: 20 },
    { row: 60, col: 70, width: 2, height: 25 },
    { row: 61, col: 70, width: 2, height: 25 },
    { row: 40, col: 40, width: 15, height: 2 },
    { row: 40, col: 41, width: 15, height: 2 },
    { row: 75, col: 20, width: 20, height: 2 },
    { row: 75, col: 21, width: 20, height: 2 },
  ];

  for (const obs of obstacles) {
    for (let dr = 0; dr < obs.height; dr++) {
      for (let dc = 0; dc < obs.width; dc++) {
        setCell(obs.row + dr, obs.col + dc, 100);
      }
    }
  }

  return data;
}

function revealAroundPosition(
  baseData: number[],
  previousData: number[],
  robotWorldX: number,
  robotWorldY: number,
  revealRadius: number
): number[] {
  const originOffset = (DEMO_GRID_SIZE * DEMO_RESOLUTION) / 2;
  const robotGridCol = Math.floor((robotWorldX + originOffset) / DEMO_RESOLUTION);
  const robotGridRow = Math.floor((robotWorldY + originOffset) / DEMO_RESOLUTION);
  const radiusCells = Math.floor(revealRadius / DEMO_RESOLUTION);

  const newData = [...previousData];
  for (let row = 0; row < DEMO_GRID_SIZE; row++) {
    for (let col = 0; col < DEMO_GRID_SIZE; col++) {
      const dist = Math.sqrt(Math.pow(row - robotGridRow, 2) + Math.pow(col - robotGridCol, 2));
      if (dist <= radiusCells) {
        newData[row * DEMO_GRID_SIZE + col] = baseData[row * DEMO_GRID_SIZE + col];
      }
    }
  }

  for (let i = 0; i < DEMO_GRID_SIZE; i++) {
    newData[i] = baseData[i];
    newData[(DEMO_GRID_SIZE - 1) * DEMO_GRID_SIZE + i] = baseData[(DEMO_GRID_SIZE - 1) * DEMO_GRID_SIZE + i];
    newData[i * DEMO_GRID_SIZE] = baseData[i * DEMO_GRID_SIZE];
    newData[i * DEMO_GRID_SIZE + DEMO_GRID_SIZE - 1] = baseData[i * DEMO_GRID_SIZE + DEMO_GRID_SIZE - 1];
  }

  return newData;
}

const SLAM_EXPLORATION_PATH = [
  { x: 0.0, y: 0.0 },
  { x: 1.5, y: 0.0 },
  { x: 1.5, y: 1.5 },
  { x: -1.0, y: 1.5 },
  { x: -1.0, y: -0.5 },
  { x: 1.5, y: -1.5 },
  { x: -1.5, y: -1.5 },
  { x: -1.5, y: 1.0 },
  { x: 0.5, y: 0.5 },
  { x: 2.0, y: -1.0 },
  { x: -2.0, y: -2.0 },
  { x: -2.0, y: 2.0 },
  { x: 2.0, y: 2.0 },
  { x: 0.0, y: 0.0 },
];

export function useDemoMode(): DemoModeResult {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoRobotPose, setDemoRobotPose] = useState<Pose | null>(null);
  const [demoOccupancyGrid, setDemoOccupancyGrid] = useState<OccupancyGrid | null>(null);
  const [patrolWaypoints, setPatrolWaypoints] = useState<Array<{ x: number; y: number }>>([]);
  const [isLooping, setIsLooping] = useState(false);
  const [isPatrolRunning, setIsPatrolRunning] = useState(false);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);

  const baseGridDataRef = useRef<number[]>([]);
  const revealedDataRef = useRef<number[]>([]);
  const robotPositionRef = useRef({ x: 0, y: 0 });
  const slamTargetIndexRef = useRef(0);
  const poseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const patrolIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const patrolWaypointIndexRef = useRef(0);
  const isLoopingRef = useRef(false);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  const stopIntervals = useCallback(() => {
    if (poseIntervalRef.current) {
      clearInterval(poseIntervalRef.current);
      poseIntervalRef.current = null;
    }
    if (slamIntervalRef.current) {
      clearInterval(slamIntervalRef.current);
      slamIntervalRef.current = null;
    }
    if (patrolIntervalRef.current) {
      clearInterval(patrolIntervalRef.current);
      patrolIntervalRef.current = null;
    }
  }, []);

  const makePoseFromPosition = useCallback((x: number, y: number, targetX: number, targetY: number): Pose => {
    const headingAngle = Math.atan2(targetY - y, targetX - x);
    return {
      position: { x, y, z: 0 },
      orientation: { x: 0, y: 0, z: Math.sin(headingAngle / 2), w: Math.cos(headingAngle / 2) },
    };
  }, []);

  const startDemoSimulation = useCallback(() => {
    baseGridDataRef.current = buildBaseGridData();
    slamTargetIndexRef.current = 0;
    robotPositionRef.current = { x: 0, y: 0 };

    const originX = -(DEMO_GRID_SIZE * DEMO_RESOLUTION) / 2;
    const originY = -(DEMO_GRID_SIZE * DEMO_RESOLUTION) / 2;

    const initialRevealed = new Array(DEMO_GRID_SIZE * DEMO_GRID_SIZE).fill(-1);
    revealedDataRef.current = revealAroundPosition(baseGridDataRef.current, initialRevealed, 0, 0, 0.5);

    setDemoOccupancyGrid({
      info: {
        resolution: DEMO_RESOLUTION,
        width: DEMO_GRID_SIZE,
        height: DEMO_GRID_SIZE,
        origin: {
          position: { x: originX, y: originY, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
      },
      data: revealedDataRef.current,
    });

    setDemoRobotPose({
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    });

    poseIntervalRef.current = setInterval(() => {
      const currentPos = robotPositionRef.current;
      const target = SLAM_EXPLORATION_PATH[slamTargetIndexRef.current];

      const deltaX = target.x - currentPos.x;
      const deltaY = target.y - currentPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      const stepSize = ROBOT_LINEAR_SPEED * POSE_UPDATE_INTERVAL_MS;

      if (distance < WAYPOINT_REACHED_THRESHOLD || distance < stepSize) {
        robotPositionRef.current = { x: target.x, y: target.y };
        slamTargetIndexRef.current = (slamTargetIndexRef.current + 1) % SLAM_EXPLORATION_PATH.length;
        const nextTarget = SLAM_EXPLORATION_PATH[slamTargetIndexRef.current];
        setDemoRobotPose(makePoseFromPosition(target.x, target.y, nextTarget.x, nextTarget.y));
        return;
      }

      const moveX = (deltaX / distance) * stepSize;
      const moveY = (deltaY / distance) * stepSize;
      robotPositionRef.current = { x: currentPos.x + moveX, y: currentPos.y + moveY };

      setDemoRobotPose(makePoseFromPosition(
        robotPositionRef.current.x,
        robotPositionRef.current.y,
        target.x,
        target.y
      ));
    }, POSE_UPDATE_INTERVAL_MS);

    slamIntervalRef.current = setInterval(() => {
      const pos = robotPositionRef.current;
      revealedDataRef.current = revealAroundPosition(
        baseGridDataRef.current,
        revealedDataRef.current,
        pos.x,
        pos.y,
        0.6
      );
      setDemoOccupancyGrid((previous) => {
        if (!previous) return previous;
        return { ...previous, data: revealedDataRef.current };
      });
    }, SLAM_REVEAL_INTERVAL_MS);
  }, [makePoseFromPosition]);

  useEffect(() => {
    if (isDemoMode) {
      startDemoSimulation();
    } else {
      stopIntervals();
      setDemoOccupancyGrid(null);
      setDemoRobotPose(null);
      setIsPatrolRunning(false);
      setCurrentWaypointIndex(0);
    }

    return stopIntervals;
  }, [isDemoMode, startDemoSimulation, stopIntervals]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((previous) => !previous);
  }, []);

  const addWaypoint = useCallback((x: number, y: number) => {
    if (isPatrolRunning) return;
    setPatrolWaypoints((previous) => [...previous, { x, y }]);
  }, [isPatrolRunning]);

  const removeWaypoint = useCallback((index: number) => {
    if (isPatrolRunning) return;
    setPatrolWaypoints((previous) => previous.filter((_, i) => i !== index));
  }, [isPatrolRunning]);

  const clearWaypoints = useCallback(() => {
    if (isPatrolRunning) return;
    setPatrolWaypoints([]);
  }, [isPatrolRunning]);

  const togglePatrolLoop = useCallback(() => {
    setIsLooping((previous) => !previous);
  }, []);

  const startPatrol = useCallback(() => {
    if (patrolWaypoints.length < 2 || isPatrolRunning) return;

    if (poseIntervalRef.current) {
      clearInterval(poseIntervalRef.current);
      poseIntervalRef.current = null;
    }

    setIsPatrolRunning(true);
    patrolWaypointIndexRef.current = 0;
    setCurrentWaypointIndex(0);

    const firstWaypoint = patrolWaypoints[0];
    robotPositionRef.current = { x: firstWaypoint.x, y: firstWaypoint.y };
    setDemoRobotPose(makePoseFromPosition(firstWaypoint.x, firstWaypoint.y, patrolWaypoints[1].x, patrolWaypoints[1].y));
    patrolWaypointIndexRef.current = 1;
    setCurrentWaypointIndex(1);

    patrolIntervalRef.current = setInterval(() => {
      const currentPos = robotPositionRef.current;
      const targetIndex = patrolWaypointIndexRef.current;
      const target = patrolWaypoints[targetIndex];

      const deltaX = target.x - currentPos.x;
      const deltaY = target.y - currentPos.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const stepSize = ROBOT_LINEAR_SPEED * POSE_UPDATE_INTERVAL_MS;

      if (distance < WAYPOINT_REACHED_THRESHOLD || distance < stepSize) {
        robotPositionRef.current = { x: target.x, y: target.y };
        const nextIndex = targetIndex + 1;
        if (nextIndex >= patrolWaypoints.length) {
          if (isLoopingRef.current) {
            patrolWaypointIndexRef.current = 0;
            setCurrentWaypointIndex(0);
          } else {
            setDemoRobotPose(makePoseFromPosition(target.x, target.y, target.x, target.y + 1));
            clearInterval(patrolIntervalRef.current!);
            patrolIntervalRef.current = null;
            setIsPatrolRunning(false);
            setCurrentWaypointIndex(0);
          }
        } else {
          patrolWaypointIndexRef.current = nextIndex;
          setCurrentWaypointIndex(nextIndex);
        }
        return;
      }

      const moveX = (deltaX / distance) * stepSize;
      const moveY = (deltaY / distance) * stepSize;
      robotPositionRef.current = { x: currentPos.x + moveX, y: currentPos.y + moveY };

      setDemoRobotPose(makePoseFromPosition(
        robotPositionRef.current.x,
        robotPositionRef.current.y,
        target.x,
        target.y
      ));
    }, POSE_UPDATE_INTERVAL_MS);
  }, [patrolWaypoints, isPatrolRunning, makePoseFromPosition]);

  return {
    isDemoMode,
    toggleDemoMode,
    demoOccupancyGrid,
    demoRobotPose,
    demoIsConnected: isDemoMode,
    patrolState: {
      waypoints: patrolWaypoints,
      isLooping,
      isPatrolRunning,
      currentWaypointIndex,
    },
    addWaypoint,
    removeWaypoint,
    clearWaypoints,
    togglePatrolLoop,
    startPatrol,
  };
}
