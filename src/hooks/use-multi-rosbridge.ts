import { useState, useEffect, useRef, useCallback } from "react";
import { Ros } from "roslib";
import type { RobotConfig } from "@/lib/robot-storage";

export interface RobotConnection {
  config: RobotConfig;
  ros: Ros | null;
  isConnected: boolean;
  connectionError: string | null;
}

export interface MultiRosbridgeResult {
  connections: RobotConnection[];
  connectAll: () => void;
  disconnectAll: () => void;
}

const RECONNECT_DELAY_MS = 3000;

export function useMultiRosbridge(configs: RobotConfig[]): MultiRosbridgeResult {
  const [connections, setConnections] = useState<RobotConnection[]>([]);
  const rosInstancesRef = useRef<Map<string, Ros>>(new Map());
  const reconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isMountedRef = useRef(true);

  const clearReconnectTimers = useCallback(() => {
    reconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
    reconnectTimersRef.current.clear();
  }, []);

  const connectOne = useCallback((config: RobotConfig) => {
    const existingRos = rosInstancesRef.current.get(config.id);
    if (existingRos) {
      existingRos.close();
    }

    const url = `ws://${config.ip}:${config.port}`;
    const rosInstance = new Ros({ url });

    rosInstance.on("connection", () => {
      if (!isMountedRef.current) return;
      setConnections((previous) =>
        previous.map((conn) =>
          conn.config.id === config.id
            ? { ...conn, ros: rosInstance, isConnected: true, connectionError: null }
            : conn
        )
      );
    });

    rosInstance.on("error", (error: unknown) => {
      if (!isMountedRef.current) return;
      setConnections((previous) =>
        previous.map((conn) =>
          conn.config.id === config.id
            ? { ...conn, isConnected: false, connectionError: String(error) }
            : conn
        )
      );
    });

    rosInstance.on("close", () => {
      if (!isMountedRef.current) return;
      setConnections((previous) =>
        previous.map((conn) =>
          conn.config.id === config.id
            ? { ...conn, isConnected: false }
            : conn
        )
      );
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          connectOne(config);
        }
      }, RECONNECT_DELAY_MS);
      reconnectTimersRef.current.set(config.id, timer);
    });

    rosInstancesRef.current.set(config.id, rosInstance);
  }, []);

  const disconnectAll = useCallback(() => {
    clearReconnectTimers();
    rosInstancesRef.current.forEach((rosInstance) => {
      rosInstance.close();
    });
    rosInstancesRef.current.clear();
    setConnections([]);
  }, [clearReconnectTimers]);

  const connectAll = useCallback(() => {
    clearReconnectTimers();
    rosInstancesRef.current.forEach((rosInstance) => {
      rosInstance.close();
    });
    rosInstancesRef.current.clear();

    const initialConnections: RobotConnection[] = configs.map((config) => ({
      config,
      ros: null,
      isConnected: false,
      connectionError: null,
    }));
    setConnections(initialConnections);

    configs.forEach((config) => {
      connectOne(config);
    });
  }, [configs, connectOne, clearReconnectTimers]);

  useEffect(() => {
    isMountedRef.current = true;
    connectAll();

    return () => {
      isMountedRef.current = false;
      clearReconnectTimers();
      rosInstancesRef.current.forEach((rosInstance) => {
        rosInstance.close();
      });
      rosInstancesRef.current.clear();
    };
  }, [connectAll, clearReconnectTimers]);

  return { connections, connectAll, disconnectAll };
}
