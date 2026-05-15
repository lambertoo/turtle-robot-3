import { useState, useEffect, useRef } from "react";
import { Ros, Topic } from "roslib";

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface ImuMessage {
  orientation: Quaternion;
  angular_velocity: { x: number; y: number; z: number };
  linear_acceleration: { x: number; y: number; z: number };
}

export interface ImuData {
  headingDegrees: number | null;
  rollDegrees: number | null;
  pitchDegrees: number | null;
}

interface UseImuOptions {
  ros: Ros | null;
  isConnected: boolean;
}

function quaternionToEuler(q: Quaternion) {
  const sinRollCosP = 2 * (q.w * q.x + q.y * q.z);
  const cosRollCosP = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinRollCosP, cosRollCosP);

  const sinPitch = 2 * (q.w * q.y - q.z * q.x);
  const pitch = Math.abs(sinPitch) >= 1
    ? Math.sign(sinPitch) * (Math.PI / 2)
    : Math.asin(sinPitch);

  const sinYawCosP = 2 * (q.w * q.z + q.x * q.y);
  const cosYawCosP = 1 - 2 * (q.y * q.y + q.z * q.z);
  const yaw = Math.atan2(sinYawCosP, cosYawCosP);

  return {
    roll: roll * (180 / Math.PI),
    pitch: pitch * (180 / Math.PI),
    yaw: yaw * (180 / Math.PI),
  };
}

function normalizeHeading(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function useImu({ ros, isConnected }: UseImuOptions): ImuData {
  const [headingDegrees, setHeadingDegrees] = useState<number | null>(null);
  const [rollDegrees, setRollDegrees] = useState<number | null>(null);
  const [pitchDegrees, setPitchDegrees] = useState<number | null>(null);
  const topicRef = useRef<Topic | null>(null);

  useEffect(() => {
    if (!ros || !isConnected) {
      setHeadingDegrees(null);
      setRollDegrees(null);
      setPitchDegrees(null);
      return;
    }

    const imuTopic = new Topic({
      ros,
      name: "/imu",
      messageType: "sensor_msgs/msg/Imu",
      throttle_rate: 200,
    });

    imuTopic.subscribe((message: unknown) => {
      const imuMessage = message as ImuMessage;
      const euler = quaternionToEuler(imuMessage.orientation);
      setHeadingDegrees(normalizeHeading(euler.yaw));
      setRollDegrees(-euler.roll);
      setPitchDegrees(-euler.pitch);
    });

    topicRef.current = imuTopic;

    return () => {
      imuTopic.unsubscribe();
      topicRef.current = null;
    };
  }, [ros, isConnected]);

  return { headingDegrees, rollDegrees, pitchDegrees };
}
