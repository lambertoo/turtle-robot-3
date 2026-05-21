import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ServiceStatus {
  name: string;
  displayName: string;
  status: "running" | "stopped" | "error";
  uptime?: string;
}

export interface ServicesResponse {
  services: ServiceStatus[];
  timestamp: string;
}

const MONITORED_CONTAINERS: { name: string; displayName: string }[] = [
  { name: "turtlebot3-compute", displayName: "SLAM & Explorer" },
  { name: "turtlebot3-dashboard", displayName: "Dashboard" },
];

async function getContainerStatus(): Promise<ServiceStatus[]> {
  try {
    const { stdout } = await execAsync(
      'docker ps -a --format "{{.Names}}|{{.Status}}" 2>/dev/null'
    );

    const containerMap = new Map<string, string>();
    for (const line of stdout.trim().split("\n")) {
      if (!line) continue;
      const [name, status] = line.split("|");
      containerMap.set(name, status);
    }

    return MONITORED_CONTAINERS.map(({ name, displayName }) => {
      const rawStatus = containerMap.get(name);
      if (!rawStatus) {
        return { name, displayName, status: "stopped" as const };
      }

      const isRunning = rawStatus.startsWith("Up");
      const uptime = isRunning ? rawStatus.replace("Up ", "") : undefined;

      return {
        name,
        displayName,
        status: isRunning ? ("running" as const) : ("stopped" as const),
        uptime,
      };
    });
  } catch {
    return MONITORED_CONTAINERS.map(({ name, displayName }) => ({
      name,
      displayName,
      status: "error" as const,
    }));
  }
}

export async function GET() {
  const services = await getContainerStatus();
  const response: ServicesResponse = {
    services,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
