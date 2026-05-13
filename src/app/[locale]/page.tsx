"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import robotConfig from "../../../config/robot.json";
import { loadRobotConfigs, getDefaultRobotConfigs, type RobotConfig } from "@/lib/robot-storage";
import { useMultiRosbridge } from "@/hooks/use-multi-rosbridge";
import { useRobotStatus } from "@/hooks/use-robot-status";
import { useTeleop } from "@/hooks/use-teleop";
import { useMapSubscription } from "@/hooks/use-map-subscription";
import { RobotStatusBar } from "@/components/robot-status-bar";
import { OperationCard } from "@/components/operation-card";
import { MapCanvas } from "@/components/map-canvas";
import { VirtualJoystick } from "@/components/virtual-joystick";
import { EmergencyStopButton } from "@/components/emergency-stop-button";
import { RobotSelector } from "@/components/robot-selector";
import { RobotConfigModal } from "@/components/robot-config-modal";

export default function OperatorPage() {
  const t = useTranslations("operations");

  const [robotConfigs, setRobotConfigs] = useState<RobotConfig[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  useEffect(() => {
    const stored = loadRobotConfigs();
    setRobotConfigs(stored.length > 0 ? stored : getDefaultRobotConfigs());
  }, []);

  const handleConfigsChange = useCallback((updated: RobotConfig[]) => {
    setRobotConfigs(updated);
  }, []);

  const openConfigModal = useCallback(() => setIsConfigModalOpen(true), []);
  const closeConfigModal = useCallback(() => setIsConfigModalOpen(false), []);

  const { connections } = useMultiRosbridge(robotConfigs);
  const { activeMode, activateMode, deactivateCurrentMode, controlledRobotId, setControlledRobotId } =
    useRobotStatus();

  useEffect(() => {
    if (connections.length > 0 && !controlledRobotId) {
      const firstConnected = connections.find((c) => c.isConnected);
      if (firstConnected) {
        setControlledRobotId(firstConnected.config.id);
      }
    }
  }, [connections, controlledRobotId, setControlledRobotId]);

  const controlledConnection = connections.find((c) => c.config.id === controlledRobotId) ?? null;
  const controlledRos = controlledConnection?.ros ?? null;
  const controlledIsConnected = controlledConnection?.isConnected ?? false;

  const { setVelocity, stopMovement } = useTeleop({
    ros: controlledRos,
    isConnected: controlledIsConnected,
    isActive: activeMode === "teleop",
  });

  const { occupancyGrid, robotPose } = useMapSubscription({
    ros: controlledRos,
    isConnected: controlledIsConnected,
    isActive: activeMode === "slam" || activeMode === "patrol",
  });

  function handleEmergencyStop() {
    stopMovement();
    deactivateCurrentMode();
  }

  const patrolWaypoints = activeMode === "patrol" ? robotConfig.patrol_waypoints : undefined;

  const connectedRobotCount = connections.filter((c) => c.isConnected).length;
  const controlledRobotName = controlledConnection?.config.name ?? null;

  const mapRobots = connections
    .filter((c) => c.isConnected)
    .map((c) => ({
      pose: c.config.id === controlledRobotId ? robotPose : null,
      color: c.config.color,
      name: c.config.name,
    }));

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <RobotStatusBar
        activeMode={activeMode}
        connectedRobotCount={connectedRobotCount}
        totalRobotCount={connections.length}
        controlledRobotName={controlledRobotName}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-72 flex-shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--color-surface)] bg-[var(--color-background)] p-4">
          <RobotSelector
            connections={connections}
            controlledRobotId={controlledRobotId}
            onSelectRobot={setControlledRobotId}
            onOpenConfigModal={openConfigModal}
          />

          <OperationCard
            title={t("slam.title")}
            description={t("slam.description")}
            mode="slam"
            activeMode={activeMode}
            isConnected={controlledIsConnected}
            onActivate={activateMode}
          />
          <OperationCard
            title={t("patrol.title")}
            description={t("patrol.description")}
            mode="patrol"
            activeMode={activeMode}
            isConnected={controlledIsConnected}
            onActivate={activateMode}
          />
          <OperationCard
            title={t("teleop.title")}
            description={t("teleop.description")}
            mode="teleop"
            activeMode={activeMode}
            isConnected={controlledIsConnected}
            onActivate={activateMode}
          />
          <div className="mt-auto pt-4">
            <EmergencyStopButton
              connections={connections.map((c) => ({ ros: c.ros, isConnected: c.isConnected }))}
              onStop={handleEmergencyStop}
            />
          </div>
        </aside>

        <main className="flex flex-1 items-center justify-center overflow-hidden p-6">
          {activeMode === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <img
                src="/turtlebot3-waffle-pi.svg"
                alt="TurtleBot3 Waffle Pi"
                className="h-40 drop-shadow-lg"
              />
              <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-16 opacity-80" />
              <h1 className="text-4xl font-black tracking-tight text-[var(--color-text-primary)]">
                UNIPOD MADAGASCAR
              </h1>
              <p className="text-lg text-[var(--color-text-secondary)]">TurtleBot3 Waffle Pi</p>
            </div>
          )}

          {(activeMode === "slam" || activeMode === "patrol") && (
            <div className="h-full w-full">
              <MapCanvas
                occupancyGrid={occupancyGrid}
                robots={mapRobots}
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

      <RobotConfigModal
        isOpen={isConfigModalOpen}
        onClose={closeConfigModal}
        robotConfigs={robotConfigs}
        onConfigsChange={handleConfigsChange}
      />
    </div>
  );
}
