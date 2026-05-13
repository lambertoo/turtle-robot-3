"use client";

import { useTranslations } from "next-intl";
import { Ros, Topic } from "roslib";

interface RosConnection {
  ros: Ros | null;
  isConnected: boolean;
}

interface EmergencyStopButtonProps {
  ros?: Ros | null;
  isConnected?: boolean;
  connections?: RosConnection[];
  onStop: () => void;
}

function sendStopToRos(rosInstance: Ros) {
  const velocityPublisher = new Topic({
    ros: rosInstance,
    name: "/cmd_vel",
    messageType: "geometry_msgs/msg/Twist",
  });

  const zeroVelocity = { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } };
  velocityPublisher.publish(zeroVelocity);
  velocityPublisher.publish(zeroVelocity);
  velocityPublisher.publish(zeroVelocity);

  const cancelGoalPublisher = new Topic({
    ros: rosInstance,
    name: "/navigate_to_pose/_action/cancel_goal",
    messageType: "action_msgs/msg/CancelGoal",
  });
  cancelGoalPublisher.publish({
    goal_info: { goal_id: { uuid: [] }, stamp: { sec: 0, nanosec: 0 } },
  });
}

export function EmergencyStopButton({ ros, isConnected, connections, onStop }: EmergencyStopButtonProps) {
  const t = useTranslations("operations.stop");

  function handleEmergencyStop() {
    if (connections && connections.length > 0) {
      connections.forEach(({ ros: rosInstance, isConnected: connected }) => {
        if (rosInstance && connected) {
          sendStopToRos(rosInstance);
        }
      });
    } else if (ros && isConnected) {
      sendStopToRos(ros);
    }

    onStop();
  }

  return (
    <button
      onClick={handleEmergencyStop}
      className="flex h-20 w-full items-center justify-center rounded-xl bg-[var(--color-accent-red)] text-2xl font-black uppercase tracking-wider text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
    >
      {t("title")}
    </button>
  );
}
