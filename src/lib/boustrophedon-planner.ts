"use client";

import type { OccupancyGrid } from "./ros-types";

export interface CoverageWaypoint {
  x: number;
  y: number;
  theta: number;
}

export interface PlannerConfig {
  stripeWidth: number;
  wallMargin: number;
  waypointSpacing: number;
}

const DEFAULT_CONFIG: PlannerConfig = {
  stripeWidth: 0.3,
  wallMargin: 0.15,
  waypointSpacing: 0.5,
};

export function generateCoveragePath(
  grid: OccupancyGrid,
  config: PlannerConfig = DEFAULT_CONFIG
): CoverageWaypoint[] {
  const { width, height, resolution, origin } = grid.info;
  const originX = origin.position.x;
  const originY = origin.position.y;

  const marginCells = Math.ceil(config.wallMargin / resolution);
  const stripeWidthCells = Math.max(1, Math.round(config.stripeWidth / resolution));
  const spacingCells = Math.max(1, Math.round(config.waypointSpacing / resolution));

  const blocked = buildInflatedGrid(grid.data, width, height, marginCells);

  const { minCol, maxCol, minRow, maxRow } = findFreeBoundingBox(blocked, width, height);
  if (minCol > maxCol || minRow > maxRow) return [];

  const rawWaypoints: CoverageWaypoint[] = [];
  let stripeIndex = 0;

  for (let col = minCol; col <= maxCol; col += stripeWidthCells) {
    const centerCol = Math.min(col + Math.floor(stripeWidthCells / 2), maxCol);
    const goingUp = stripeIndex % 2 === 0;

    const startRow = goingUp ? minRow : maxRow;
    const endRow = goingUp ? maxRow : minRow;
    const step = goingUp ? 1 : -1;

    let runStart: number | null = null;

    for (let row = startRow; goingUp ? row <= endRow : row >= endRow; row += step) {
      const cellIndex = row * width + centerCol;
      const isFree = !blocked[cellIndex];

      if (isFree && runStart === null) {
        runStart = row;
        rawWaypoints.push(gridToWorld(centerCol, row, originX, originY, resolution));
      } else if (isFree) {
        const distanceCells = Math.abs(row - runStart!);
        if (distanceCells >= spacingCells) {
          rawWaypoints.push(gridToWorld(centerCol, row, originX, originY, resolution));
          runStart = row;
        }
      } else if (!isFree && runStart !== null) {
        const lastRow = row - step;
        const lastWaypoint = rawWaypoints[rawWaypoints.length - 1];
        const endWorld = gridToWorld(centerCol, lastRow, originX, originY, resolution);
        if (lastWaypoint.x !== endWorld.x || lastWaypoint.y !== endWorld.y) {
          rawWaypoints.push(endWorld);
        }
        runStart = null;
      }
    }

    if (runStart !== null) {
      const finalRow = goingUp ? maxRow : minRow;
      const lastWaypoint = rawWaypoints[rawWaypoints.length - 1];
      const endWorld = gridToWorld(centerCol, finalRow, originX, originY, resolution);
      if (lastWaypoint.x !== endWorld.x || lastWaypoint.y !== endWorld.y) {
        rawWaypoints.push(endWorld);
      }
    }

    stripeIndex++;
  }

  return computeOrientations(rawWaypoints);
}

function buildInflatedGrid(
  data: number[],
  width: number,
  height: number,
  marginCells: number
): boolean[] {
  const blocked = new Array<boolean>(width * height);
  for (let i = 0; i < data.length; i++) {
    blocked[i] = data[i] !== 0;
  }

  if (marginCells <= 0) return blocked;

  const inflated = blocked.slice();

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!blocked[row * width + col]) continue;

      for (let dr = -marginCells; dr <= marginCells; dr++) {
        for (let dc = -marginCells; dc <= marginCells; dc++) {
          const neighborRow = row + dr;
          const neighborCol = col + dc;
          if (neighborRow >= 0 && neighborRow < height && neighborCol >= 0 && neighborCol < width) {
            inflated[neighborRow * width + neighborCol] = true;
          }
        }
      }
    }
  }

  return inflated;
}

function findFreeBoundingBox(
  blocked: boolean[],
  width: number,
  height: number
): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  let minCol = width;
  let maxCol = 0;
  let minRow = height;
  let maxRow = 0;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (!blocked[row * width + col]) {
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
    }
  }

  return { minCol, maxCol, minRow, maxRow };
}

function gridToWorld(
  col: number,
  row: number,
  originX: number,
  originY: number,
  resolution: number
): CoverageWaypoint {
  return {
    x: originX + col * resolution,
    y: originY + row * resolution,
    theta: 0,
  };
}

function computeOrientations(waypoints: CoverageWaypoint[]): CoverageWaypoint[] {
  if (waypoints.length <= 1) return waypoints;

  return waypoints.map((waypoint, index) => {
    const next = index < waypoints.length - 1 ? waypoints[index + 1] : waypoints[index - 1];
    const dx = next.x - waypoint.x;
    const dy = next.y - waypoint.y;
    return { ...waypoint, theta: Math.atan2(dy, dx) };
  });
}
