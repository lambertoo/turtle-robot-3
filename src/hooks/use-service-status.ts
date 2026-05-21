import { useState, useEffect, useCallback } from "react";

export interface ServiceInfo {
  name: string;
  status: "running" | "stopped" | "error" | "unknown";
  uptime?: string;
}

export function useServiceStatus(pollIntervalMs = 5000) {
  const [services, setServices] = useState<ServiceInfo[]>([
    { name: "turtlebot3-compute", status: "unknown" },
    { name: "turtlebot3-dashboard", status: "unknown" },
  ]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/services");
      if (!response.ok) throw new Error("fetch failed");
      const data = await response.json();
      setServices(data.services);
    } catch {
      setServices((prev) =>
        prev.map((s) => ({ ...s, status: "unknown" as const }))
      );
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, pollIntervalMs]);

  return { services, refresh: fetchStatus };
}
