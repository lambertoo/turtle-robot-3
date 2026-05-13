import { useState, useEffect, useRef, useCallback } from "react";
import { Ros } from "roslib";
import robotConfig from "../../config/robot.json";

export interface RosbridgeConnection {
  ros: Ros | null;
  isConnected: boolean;
  connectionError: string | null;
  reconnect: () => void;
}

export function useRosbridge(url?: string | null): RosbridgeConnection {
  const resolvedUrl = url ?? robotConfig.rosbridge_url;
  const [ros, setRos] = useState<Ros | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const rosRef = useRef<Ros | null>(null);

  const connect = useCallback(() => {
    if (rosRef.current) {
      rosRef.current.close();
    }

    const newRos = new Ros({ url: resolvedUrl });

    newRos.on("connection", () => {
      setRos(newRos);
      setIsConnected(true);
      setConnectionError(null);
    });

    newRos.on("error", (error: unknown) => {
      setConnectionError(String(error));
    });

    newRos.on("close", () => {
      setIsConnected(false);
    });

    rosRef.current = newRos;
  }, [resolvedUrl]);

  useEffect(() => {
    connect();

    return () => {
      if (rosRef.current) {
        rosRef.current.close();
        rosRef.current = null;
      }
    };
  }, [connect]);

  return {
    ros,
    isConnected,
    connectionError,
    reconnect: connect,
  };
}
