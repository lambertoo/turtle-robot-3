import robotConfig from "../../config/robot.json";

export interface RobotConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  videoPort: number;
  color: string;
}

const STORAGE_KEY = "unipod_robots";

export const ROBOT_MARKER_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
];

export function loadRobotConfigs(): RobotConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as RobotConfig[];
  } catch {
    return [];
  }
}

export function saveRobotConfigs(configs: RobotConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function getDefaultRobotConfigs(): RobotConfig[] {
  const urlMatch = robotConfig.rosbridge_url.match(/ws:\/\/([^:]+):(\d+)/);
  const ip = urlMatch ? urlMatch[1] : "turtlebot3.local";
  const port = urlMatch ? parseInt(urlMatch[2], 10) : 9090;

  return [
    {
      id: "default",
      name: "TurtleBot Alpha",
      ip,
      port,
      videoPort: 8080,
      color: ROBOT_MARKER_COLORS[0],
    },
  ];
}

export function pickNextColor(existingConfigs: RobotConfig[]): string {
  const usedColors = new Set(existingConfigs.map((c) => c.color));
  const available = ROBOT_MARKER_COLORS.find((color) => !usedColors.has(color));
  return available ?? ROBOT_MARKER_COLORS[existingConfigs.length % ROBOT_MARKER_COLORS.length];
}
