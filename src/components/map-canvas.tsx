"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { OccupancyGrid, Pose } from "../lib/ros-types";

interface PatrolWaypoint {
  x: number;
  y: number;
  theta: number;
}

interface RobotMarker {
  pose: Pose | null;
  color: string;
  name: string;
}

interface MapCanvasProps {
  occupancyGrid: OccupancyGrid | null;
  robotPose?: Pose | null;
  patrolWaypoints?: PatrolWaypoint[];
  robots?: RobotMarker[];
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const CELL_COLOR_UNKNOWN = "#1e293b";
const CELL_COLOR_FREE = "#f1f5f9";
const CELL_COLOR_OCCUPIED = "#0f172a";

function drawOccupancyGrid(
  context: CanvasRenderingContext2D,
  grid: OccupancyGrid,
  offsetX: number,
  offsetY: number,
  cellSize: number
) {
  const { width, height } = grid.info;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempContext = tempCanvas.getContext("2d");
  if (!tempContext) return;

  const imageData = tempContext.createImageData(width, height);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cellValue = grid.data[row * width + col];
      const pixelIndex = (row * width + col) * 4;

      let red: number;
      let green: number;
      let blue: number;

      if (cellValue === -1) {
        [red, green, blue] = [0x1e, 0x29, 0x3b];
      } else if (cellValue === 0) {
        [red, green, blue] = [0xf1, 0xf5, 0xf9];
      } else {
        [red, green, blue] = [0x0f, 0x17, 0x2a];
      }

      imageData.data[pixelIndex] = red;
      imageData.data[pixelIndex + 1] = green;
      imageData.data[pixelIndex + 2] = blue;
      imageData.data[pixelIndex + 3] = 255;
    }
  }

  tempContext.putImageData(imageData, 0, 0);
  context.drawImage(tempCanvas, offsetX, offsetY, width * cellSize, height * cellSize);
}

function worldToCanvas(
  worldX: number,
  worldY: number,
  grid: OccupancyGrid,
  offsetX: number,
  offsetY: number,
  cellSize: number
): { canvasX: number; canvasY: number } {
  const { origin, resolution } = grid.info;
  const gridX = (worldX - origin.position.x) / resolution;
  const gridY = (worldY - origin.position.y) / resolution;
  return {
    canvasX: offsetX + gridX * cellSize,
    canvasY: offsetY + (grid.info.height - gridY) * cellSize,
  };
}

export function MapCanvas({ occupancyGrid, robotPose, patrolWaypoints, robots }: MapCanvasProps) {
  const t = useTranslations("map");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const allRobotMarkers: RobotMarker[] = robots && robots.length > 0
    ? robots
    : robotPose
      ? [{ pose: robotPose, color: "#22c55e", name: "" }]
      : [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = CELL_COLOR_UNKNOWN;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (!occupancyGrid) return;

    const { width, height } = occupancyGrid.info;
    const cellSize = Math.min(CANVAS_WIDTH / width, CANVAS_HEIGHT / height);
    const scaledWidth = width * cellSize;
    const scaledHeight = height * cellSize;
    const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
    const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2;

    drawOccupancyGrid(context, occupancyGrid, offsetX, offsetY, cellSize);

    if (patrolWaypoints && patrolWaypoints.length > 0) {
      patrolWaypoints.forEach((waypoint, index) => {
        const { canvasX, canvasY } = worldToCanvas(
          waypoint.x,
          waypoint.y,
          occupancyGrid,
          offsetX,
          offsetY,
          cellSize
        );

        context.beginPath();
        context.arc(canvasX, canvasY, 10, 0, Math.PI * 2);
        context.fillStyle = "#f59e0b";
        context.fill();
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.stroke();

        context.fillStyle = "#ffffff";
        context.font = "bold 11px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(index + 1), canvasX, canvasY);
      });
    }

    allRobotMarkers.forEach((marker) => {
      if (!marker.pose) return;

      const { canvasX, canvasY } = worldToCanvas(
        marker.pose.position.x,
        marker.pose.position.y,
        occupancyGrid,
        offsetX,
        offsetY,
        cellSize
      );

      context.beginPath();
      context.arc(canvasX, canvasY, 8, 0, Math.PI * 2);
      context.fillStyle = marker.color;
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      context.stroke();

      if (marker.name) {
        context.fillStyle = "#ffffff";
        context.font = "bold 10px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(marker.name, canvasX, canvasY - 10);
      }
    });
  }, [occupancyGrid, robotPose, patrolWaypoints, robots, allRobotMarkers]);

  if (!occupancyGrid) {
    return (
      <div
        className="flex h-full min-h-64 w-full items-center justify-center rounded-xl"
        style={{ background: "var(--color-surface)" }}
      >
        <p className="text-[var(--color-text-secondary)]">{t("waitingForData")}</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="w-full rounded-xl"
      style={{ background: CELL_COLOR_UNKNOWN }}
    />
  );
}

export { CELL_COLOR_UNKNOWN, CELL_COLOR_FREE, CELL_COLOR_OCCUPIED };
