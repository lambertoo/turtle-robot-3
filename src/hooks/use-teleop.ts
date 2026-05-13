import { useEffect, useRef, useCallback } from "react";
import { Ros, Topic } from "roslib";
import robotConfig from "../../config/robot.json";

interface VelocityCommand {
  linearX: number;
  angularZ: number;
}

interface UseTeleopOptions {
  ros: Ros | null;
  isConnected: boolean;
  isActive: boolean;
}

interface TeleopControls {
  setVelocity: (linearX: number, angularZ: number) => void;
  stopMovement: () => void;
}

export function useTeleop({ ros, isConnected, isActive }: UseTeleopOptions): TeleopControls {
  const velocityRef = useRef<VelocityCommand>({ linearX: 0, angularZ: 0 });
  const publishIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cmdVelTopicRef = useRef<Topic | null>(null);

  const publishCurrentVelocity = useCallback(() => {
    if (!cmdVelTopicRef.current) return;
    const { linearX, angularZ } = velocityRef.current;
    cmdVelTopicRef.current.publish({
      linear: { x: linearX, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: angularZ },
    });
  }, []);

  const publishZeroVelocity = useCallback(() => {
    if (!cmdVelTopicRef.current) return;
    cmdVelTopicRef.current.publish({
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    });
  }, []);

  useEffect(() => {
    if (!ros || !isConnected || !isActive) {
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
        publishIntervalRef.current = null;
      }
      publishZeroVelocity();
      cmdVelTopicRef.current = null;
      return;
    }

    cmdVelTopicRef.current = new Topic({
      ros,
      name: "/cmd_vel",
      messageType: "geometry_msgs/msg/Twist",
    });

    velocityRef.current = { linearX: 0, angularZ: 0 };

    publishIntervalRef.current = setInterval(publishCurrentVelocity, 100);

    return () => {
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
        publishIntervalRef.current = null;
      }
      publishZeroVelocity();
      cmdVelTopicRef.current = null;
    };
  }, [ros, isConnected, isActive, publishCurrentVelocity, publishZeroVelocity]);

  const setVelocity = useCallback((linearX: number, angularZ: number) => {
    const clampedLinearX = Math.max(
      -robotConfig.max_linear_speed,
      Math.min(robotConfig.max_linear_speed, linearX)
    );
    const clampedAngularZ = Math.max(
      -robotConfig.max_angular_speed,
      Math.min(robotConfig.max_angular_speed, angularZ)
    );
    velocityRef.current = { linearX: clampedLinearX, angularZ: clampedAngularZ };
  }, []);

  const stopMovement = useCallback(() => {
    velocityRef.current = { linearX: 0, angularZ: 0 };
    publishZeroVelocity();
  }, [publishZeroVelocity]);

  return { setVelocity, stopMovement };
}
