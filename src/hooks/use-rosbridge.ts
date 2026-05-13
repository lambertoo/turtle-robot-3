import { useState, useEffect, useRef, useCallback } from "react";
import { Ros } from "roslib";
import robotConfig from "../../config/robot.json";

export interface RosbridgeConnection {
  ros: Ros | null;
  isConnected: boolean;
  connectionError: string | null;
  reconnect: () => void;
}

export function useRosbridge(): RosbridgeConnection {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const rosRef = useRef<Ros | null>(null);

  const connect = useCallback(() => {
    if (rosRef.current) {
      rosRef.current.close();
    }

    const ros = new Ros({ url: robotConfig.rosbridge_url });

    ros.on("connection", () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    ros.on("error", (error: unknown) => {
      setConnectionError(String(error));
    });

    ros.on("close", () => {
      setIsConnected(false);
    });

    rosRef.current = ros;
  }, []);

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
    ros: rosRef.current,
    isConnected,
    connectionError,
    reconnect: connect,
  };
}
