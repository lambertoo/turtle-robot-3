"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { OccupancyGrid, Pose } from "@/lib/ros-types";

const DEMO_GRID_SIZE = 100;
const DEMO_RESOLUTION = 0.05;
const PATROL_RADIUS = 2.0;
const ROBOT_SPEED_RAD_PER_MS = (0.15 / PATROL_RADIUS) * (1 / 1000);
const POSE_UPDATE_INTERVAL_MS = 200;
const SLAM_REVEAL_INTERVAL_MS = 500;

export interface DemoModeResult {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  demoOccupancyGrid: OccupancyGrid | null;
  demoRobotPose: Pose | null;
  demoIsConnected: boolean;
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

function computeRevealedCells(angle: number): Set<number> {
  const revealed = new Set<number>();
  const centerRow = DEMO_GRID_SIZE / 2;
  const centerCol = DEMO_GRID_SIZE / 2;
  const revealRadius = 10 + (angle / (Math.PI * 8)) * (DEMO_GRID_SIZE / 2 - 10);
  const clampedRadius = Math.min(revealRadius, DEMO_GRID_SIZE / 2 - 2);

  for (let row = 1; row < DEMO_GRID_SIZE - 1; row++) {
    for (let col = 1; col < DEMO_GRID_SIZE - 1; col++) {
      const distFromCenter = Math.sqrt(
        Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2)
      );
      if (distFromCenter <= clampedRadius) {
        revealed.add(row * DEMO_GRID_SIZE + col);
      }
    }
  }

  for (let i = 0; i < DEMO_GRID_SIZE; i++) {
    revealed.add(i);
    revealed.add((DEMO_GRID_SIZE - 1) * DEMO_GRID_SIZE + i);
    revealed.add(i * DEMO_GRID_SIZE);
    revealed.add(i * DEMO_GRID_SIZE + DEMO_GRID_SIZE - 1);
  }

  return revealed;
}

export function useDemoMode(): DemoModeResult {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoRobotPose, setDemoRobotPose] = useState<Pose | null>(null);
  const [demoOccupancyGrid, setDemoOccupancyGrid] = useState<OccupancyGrid | null>(null);

  const patrolAngleRef = useRef(0);
  const baseGridDataRef = useRef<number[]>([]);
  const poseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopIntervals = useCallback(() => {
    if (poseIntervalRef.current) {
      clearInterval(poseIntervalRef.current);
      poseIntervalRef.current = null;
    }
    if (slamIntervalRef.current) {
      clearInterval(slamIntervalRef.current);
      slamIntervalRef.current = null;
    }
  }, []);

  const startDemoSimulation = useCallback(() => {
    baseGridDataRef.current = buildBaseGridData();
    patrolAngleRef.current = 0;

    const originX = -(DEMO_GRID_SIZE * DEMO_RESOLUTION) / 2;
    const originY = -(DEMO_GRID_SIZE * DEMO_RESOLUTION) / 2;

    const initialData = baseGridDataRef.current.map((cell, index) => {
      const row = Math.floor(index / DEMO_GRID_SIZE);
      const col = index % DEMO_GRID_SIZE;
      const centerRow = DEMO_GRID_SIZE / 2;
      const centerCol = DEMO_GRID_SIZE / 2;
      const dist = Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
      return dist <= 10 ? cell : -1;
    });

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
      data: initialData,
    });

    setDemoRobotPose({
      position: { x: PATROL_RADIUS, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    });

    poseIntervalRef.current = setInterval(() => {
      patrolAngleRef.current += ROBOT_SPEED_RAD_PER_MS * POSE_UPDATE_INTERVAL_MS;
      const angle = patrolAngleRef.current;

      const posX = PATROL_RADIUS * Math.cos(angle);
      const posY = PATROL_RADIUS * Math.sin(angle);

      const headingAngle = angle + Math.PI / 2;
      const sinHalf = Math.sin(headingAngle / 2);
      const cosHalf = Math.cos(headingAngle / 2);

      setDemoRobotPose({
        position: { x: posX, y: posY, z: 0 },
        orientation: { x: 0, y: 0, z: sinHalf, w: cosHalf },
      });
    }, POSE_UPDATE_INTERVAL_MS);

    slamIntervalRef.current = setInterval(() => {
      const currentAngle = patrolAngleRef.current;
      const revealed = computeRevealedCells(currentAngle);

      const updatedData = baseGridDataRef.current.map((cell, index) => {
        return revealed.has(index) ? cell : -1;
      });

      setDemoOccupancyGrid((previous) => {
        if (!previous) return previous;
        return { ...previous, data: updatedData };
      });
    }, SLAM_REVEAL_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      startDemoSimulation();
    } else {
      stopIntervals();
      setDemoOccupancyGrid(null);
      setDemoRobotPose(null);
    }

    return stopIntervals;
  }, [isDemoMode, startDemoSimulation, stopIntervals]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((previous) => !previous);
  }, []);

  return {
    isDemoMode,
    toggleDemoMode,
    demoOccupancyGrid,
    demoRobotPose,
    demoIsConnected: isDemoMode,
  };
}
