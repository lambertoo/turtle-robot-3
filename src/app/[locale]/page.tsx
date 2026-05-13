"use client";

import { useTranslations } from "next-intl";
import robotConfig from "../../../config/robot.json";
import { useRosbridge } from "@/hooks/use-rosbridge";
import { useRobotStatus } from "@/hooks/use-robot-status";
import { useTeleop } from "@/hooks/use-teleop";
import { useMapSubscription } from "@/hooks/use-map-subscription";
import { RobotStatusBar } from "@/components/robot-status-bar";
import { OperationCard } from "@/components/operation-card";
import { MapCanvas } from "@/components/map-canvas";
import { VirtualJoystick } from "@/components/virtual-joystick";
import { EmergencyStopButton } from "@/components/emergency-stop-button";

export default function OperatorPage() {
  const t = useTranslations("operations");

  const { ros, isConnected } = useRosbridge();
  const { activeMode, activateMode, deactivateCurrentMode } = useRobotStatus();
  const { setVelocity, stopMovement } = useTeleop({
    ros,
    isConnected,
    isActive: activeMode === "teleop",
  });
  const { occupancyGrid, robotPose } = useMapSubscription({
    ros,
    isConnected,
    isActive: activeMode === "slam" || activeMode === "patrol",
  });

  function handleEmergencyStop() {
    stopMovement();
    deactivateCurrentMode();
  }

  const patrolWaypoints = activeMode === "patrol" ? robotConfig.patrol_waypoints : undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <RobotStatusBar isConnected={isConnected} activeMode={activeMode} />

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-72 flex-shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--color-surface)] bg-[var(--color-background)] p-4">
          <OperationCard
            title={t("slam.title")}
            description={t("slam.description")}
            mode="slam"
            activeMode={activeMode}
            isConnected={isConnected}
            onActivate={activateMode}
          />
          <OperationCard
            title={t("patrol.title")}
            description={t("patrol.description")}
            mode="patrol"
            activeMode={activeMode}
            isConnected={isConnected}
            onActivate={activateMode}
          />
          <OperationCard
            title={t("teleop.title")}
            description={t("teleop.description")}
            mode="teleop"
            activeMode={activeMode}
            isConnected={isConnected}
            onActivate={activateMode}
          />
          <div className="mt-auto pt-4">
            <EmergencyStopButton
              ros={ros}
              isConnected={isConnected}
              onStop={handleEmergencyStop}
            />
          </div>
        </aside>

        <main className="flex flex-1 items-center justify-center overflow-hidden p-6">
          {activeMode === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-24 opacity-80" />
              <h1 className="text-4xl font-black tracking-tight text-[var(--color-text-primary)]">
                UNIPOD MADAGASCAR
              </h1>
              <p className="text-lg text-[var(--color-text-secondary)]">Madagascar</p>
            </div>
          )}

          {(activeMode === "slam" || activeMode === "patrol") && (
            <div className="h-full w-full">
              <MapCanvas
                occupancyGrid={occupancyGrid}
                robotPose={robotPose}
                patrolWaypoints={patrolWaypoints}
              />
            </div>
          )}

          {activeMode === "teleop" && (
            <VirtualJoystick
              onMove={setVelocity}
              onRelease={stopMovement}
            />
          )}
        </main>
      </div>
    </div>
  );
}
