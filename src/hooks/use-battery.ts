import { useState, useEffect, useRef } from "react";
import { Ros, Topic } from "roslib";

interface BatteryState {
  voltage: number;
  percentage: number;
}

interface UseBatteryOptions {
  ros: Ros | null;
  isConnected: boolean;
}

export function useBattery({ ros, isConnected }: UseBatteryOptions) {
  const [batteryVoltage, setBatteryVoltage] = useState<number | null>(null);
  const [batteryPercentage, setBatteryPercentage] = useState<number | null>(null);
  const topicRef = useRef<Topic | null>(null);

  useEffect(() => {
    if (!ros || !isConnected) {
      if (topicRef.current) {
        topicRef.current.unsubscribe();
        topicRef.current = null;
      }
      setBatteryVoltage(null);
      setBatteryPercentage(null);
      return;
    }

    const topic = new Topic({
      ros,
      name: "/battery_state",
      messageType: "sensor_msgs/msg/BatteryState",
      throttle_rate: 5000,
    });

    topic.subscribe((message: unknown) => {
      const battery = message as BatteryState;
      setBatteryVoltage(battery.voltage);
      setBatteryPercentage(battery.percentage);
    });

    topicRef.current = topic;

    return () => {
      topic.unsubscribe();
      topicRef.current = null;
    };
  }, [ros, isConnected]);

  return { batteryVoltage, batteryPercentage };
}
