export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Twist {
  linear: Vector3;
  angular: Vector3;
}

export interface MapMetaData {
  resolution: number;
  width: number;
  height: number;
  origin: {
    position: Vector3;
    orientation: { x: number; y: number; z: number; w: number };
  };
}

export interface OccupancyGrid {
  info: MapMetaData;
  data: number[];
}

export interface Pose {
  position: Vector3;
  orientation: { x: number; y: number; z: number; w: number };
}

export interface PoseStamped {
  header: { frame_id: string };
  pose: Pose;
}

export type RobotMode = "idle" | "slam" | "patrol" | "teleop" | "cleaning";
