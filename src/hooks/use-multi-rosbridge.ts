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

export function useMultiRosbridge(configs: RobotConfig[]): MultiRosbridgeResult {
  const [connections, setConnections] = useState<RobotConnection[]>([]);
  const rosInstancesRef = useRef<Map<string, Ros>>(new Map());

  const disconnectAll = useCallback(() => {
    rosInstancesRef.current.forEach((rosInstance) => {
      rosInstance.close();
    });
    rosInstancesRef.current.clear();
    setConnections([]);
  }, []);

  const connectAll = useCallback(() => {
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
      const url = `ws://${config.ip}:${config.port}`;
      const rosInstance = new Ros({ url });

      rosInstance.on("connection", () => {
        setConnections((previous) =>
          previous.map((conn) =>
            conn.config.id === config.id
              ? { ...conn, ros: rosInstance, isConnected: true, connectionError: null }
              : conn
          )
        );
      });

      rosInstance.on("error", (error: unknown) => {
        setConnections((previous) =>
          previous.map((conn) =>
            conn.config.id === config.id
              ? { ...conn, isConnected: false, connectionError: String(error) }
              : conn
          )
        );
      });

      rosInstance.on("close", () => {
        setConnections((previous) =>
          previous.map((conn) =>
            conn.config.id === config.id
              ? { ...conn, isConnected: false }
              : conn
          )
        );
      });

      rosInstancesRef.current.set(config.id, rosInstance);
    });
  }, [configs]);

  useEffect(() => {
    connectAll();

    return () => {
      rosInstancesRef.current.forEach((rosInstance) => {
        rosInstance.close();
      });
      rosInstancesRef.current.clear();
    };
  }, [connectAll]);

  return { connections, connectAll, disconnectAll };
}
