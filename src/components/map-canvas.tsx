"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { OccupancyGrid, Pose } from "../lib/ros-types";

interface PatrolWaypoint {
  x: number;
  y: number;
  theta?: number;
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
  onMapClick?: (worldX: number, worldY: number) => void;
  isClickable?: boolean;
  coveragePath?: { x: number; y: number }[];
  coverageCurrentIndex?: number;
  coverageMissedIndices?: number[];
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

function canvasToWorld(
  canvasClickX: number,
  canvasClickY: number,
  canvasElement: HTMLCanvasElement,
  grid: OccupancyGrid
): { worldX: number; worldY: number } {
  const rect = canvasElement.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  const pixelX = (canvasClickX - rect.left) * scaleX;
  const pixelY = (canvasClickY - rect.top) * scaleY;

  const { width, height, resolution, origin } = grid.info;
  const cellSize = Math.min(CANVAS_WIDTH / width, CANVAS_HEIGHT / height);
  const scaledWidth = width * cellSize;
  const scaledHeight = height * cellSize;
  const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
  const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2;

  const gridX = (pixelX - offsetX) / cellSize;
  const gridY = height - (pixelY - offsetY) / cellSize;

  return {
    worldX: gridX * resolution + origin.position.x,
    worldY: gridY * resolution + origin.position.y,
  };
}

export function MapCanvas({ occupancyGrid, robotPose, patrolWaypoints, robots, onMapClick, isClickable, coveragePath, coverageCurrentIndex, coverageMissedIndices }: MapCanvasProps) {
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
      if (patrolWaypoints.length > 1) {
        context.beginPath();
        context.strokeStyle = "rgba(245, 158, 11, 0.4)";
        context.lineWidth = 2;
        context.setLineDash([6, 4]);
        const firstPoint = worldToCanvas(patrolWaypoints[0].x, patrolWaypoints[0].y, occupancyGrid, offsetX, offsetY, cellSize);
        context.moveTo(firstPoint.canvasX, firstPoint.canvasY);
        for (let i = 1; i < patrolWaypoints.length; i++) {
          const point = worldToCanvas(patrolWaypoints[i].x, patrolWaypoints[i].y, occupancyGrid, offsetX, offsetY, cellSize);
          context.lineTo(point.canvasX, point.canvasY);
        }
        context.stroke();
        context.setLineDash([]);
      }

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

    if (coveragePath && coveragePath.length > 1) {
      const currentIdx = coverageCurrentIndex ?? 0;
      const missedSet = new Set(coverageMissedIndices ?? []);

      if (currentIdx > 0) {
        context.beginPath();
        context.strokeStyle = "rgba(34, 197, 94, 0.6)";
        context.lineWidth = 2;
        const firstCompleted = worldToCanvas(coveragePath[0].x, coveragePath[0].y, occupancyGrid, offsetX, offsetY, cellSize);
        context.moveTo(firstCompleted.canvasX, firstCompleted.canvasY);
        for (let i = 1; i <= Math.min(currentIdx, coveragePath.length - 1); i++) {
          const point = worldToCanvas(coveragePath[i].x, coveragePath[i].y, occupancyGrid, offsetX, offsetY, cellSize);
          context.lineTo(point.canvasX, point.canvasY);
        }
        context.stroke();
      }

      if (currentIdx < coveragePath.length - 1) {
        context.beginPath();
        context.strokeStyle = "rgba(59, 130, 246, 0.4)";
        context.lineWidth = 1.5;
        context.setLineDash([4, 3]);
        const firstRemaining = worldToCanvas(coveragePath[currentIdx].x, coveragePath[currentIdx].y, occupancyGrid, offsetX, offsetY, cellSize);
        context.moveTo(firstRemaining.canvasX, firstRemaining.canvasY);
        for (let i = currentIdx + 1; i < coveragePath.length; i++) {
          const point = worldToCanvas(coveragePath[i].x, coveragePath[i].y, occupancyGrid, offsetX, offsetY, cellSize);
          context.lineTo(point.canvasX, point.canvasY);
        }
        context.stroke();
        context.setLineDash([]);
      }

      if (currentIdx < coveragePath.length) {
        const { canvasX, canvasY } = worldToCanvas(
          coveragePath[currentIdx].x,
          coveragePath[currentIdx].y,
          occupancyGrid,
          offsetX,
          offsetY,
          cellSize
        );
        context.beginPath();
        context.arc(canvasX, canvasY, 5, 0, Math.PI * 2);
        context.fillStyle = "#06b6d4";
        context.fill();
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.stroke();
      }

      missedSet.forEach((missedIdx) => {
        if (missedIdx < coveragePath.length) {
          const { canvasX, canvasY } = worldToCanvas(
            coveragePath[missedIdx].x,
            coveragePath[missedIdx].y,
            occupancyGrid,
            offsetX,
            offsetY,
            cellSize
          );
          context.beginPath();
          context.arc(canvasX, canvasY, 4, 0, Math.PI * 2);
          context.fillStyle = "#e4002b";
          context.fill();
        }
      });
    }
  }, [occupancyGrid, robotPose, patrolWaypoints, robots, allRobotMarkers, coveragePath, coverageCurrentIndex, coverageMissedIndices]);

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onMapClick || !isClickable || !occupancyGrid || !canvasRef.current) return;
      const { worldX, worldY } = canvasToWorld(
        event.clientX,
        event.clientY,
        canvasRef.current,
        occupancyGrid
      );
      onMapClick(worldX, worldY);
    },
    [onMapClick, isClickable, occupancyGrid]
  );

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
      onClick={handleCanvasClick}
      className={`w-full rounded-xl ${isClickable ? "cursor-crosshair" : ""}`}
      style={{ background: CELL_COLOR_UNKNOWN }}
    />
  );
}

export { CELL_COLOR_UNKNOWN, CELL_COLOR_FREE, CELL_COLOR_OCCUPIED };
