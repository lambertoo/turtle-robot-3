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

function StopOctagonIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polygon points="7.86,2 16.14,2 22,7.86 22,16.14 16.14,22 7.86,22 2,16.14 2,7.86" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

export function EmergencyStopButton({ ros, isConnected, connections, onStop }: EmergencyStopButtonProps) {
  const t = useTranslations("operations.stop");
  const hudT = useTranslations("hud");

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
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-accent-red)] opacity-70">
        {hudT("emergency")}
      </span>
      <button
        onClick={handleEmergencyStop}
        className="flex h-24 w-full items-center justify-center gap-3 rounded-xl text-xl font-black uppercase tracking-widest text-white transition-all active:scale-95"
        style={{
          background: "linear-gradient(135deg, #dc2626, #991b1b)",
          border: "2px solid rgba(239, 68, 68, 0.5)",
          boxShadow: "0 0 20px rgba(239, 68, 68, 0.3), 0 0 40px rgba(239, 68, 68, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
          outline: "2px solid rgba(239, 68, 68, 0.15)",
          outlineOffset: "3px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 30px rgba(239, 68, 68, 0.5), 0 0 60px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 20px rgba(239, 68, 68, 0.3), 0 0 40px rgba(239, 68, 68, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)";
        }}
      >
        <StopOctagonIcon />
        {t("title")}
      </button>
    </div>
  );
}
