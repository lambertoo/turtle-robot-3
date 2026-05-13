"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import robotConfig from "../../../config/robot.json";
import { loadRobotConfigs, getDefaultRobotConfigs, type RobotConfig } from "@/lib/robot-storage";
import { useMultiRosbridge } from "@/hooks/use-multi-rosbridge";
import { useRobotStatus } from "@/hooks/use-robot-status";
import { useTeleop } from "@/hooks/use-teleop";
import { useMapSubscription } from "@/hooks/use-map-subscription";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { RobotStatusBar } from "@/components/robot-status-bar";
import { OperationCard } from "@/components/operation-card";
import { MapCanvas } from "@/components/map-canvas";
import { VirtualJoystick } from "@/components/virtual-joystick";
import { EmergencyStopButton } from "@/components/emergency-stop-button";
import { RobotSelector } from "@/components/robot-selector";
import { RobotConfigModal } from "@/components/robot-config-modal";
import { CameraFeed } from "@/components/camera-feed";
import { FloatingControls } from "@/components/floating-controls";

export default function OperatorPage() {
  const t = useTranslations("operations");
  const hudT = useTranslations("hud");

  const [robotConfigs, setRobotConfigs] = useState<RobotConfig[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const stored = loadRobotConfigs();
    setRobotConfigs(stored.length > 0 ? stored : getDefaultRobotConfigs());
  }, []);

  const handleConfigsChange = useCallback((updated: RobotConfig[]) => {
    setRobotConfigs(updated);
  }, []);

  const openConfigModal = useCallback(() => setIsConfigModalOpen(true), []);
  const closeConfigModal = useCallback(() => setIsConfigModalOpen(false), []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((previous) => {
      const next = !previous;
      if (next) {
        document.documentElement.requestFullscreen?.().catch(() => undefined);
      } else {
        document.exitFullscreen?.().catch(() => undefined);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F11" || event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [toggleFullscreen]);

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

  const { occupancyGrid: realOccupancyGrid, robotPose: realRobotPose } = useMapSubscription({
    ros: controlledRos,
    isConnected: controlledIsConnected,
    isActive: activeMode === "slam" || activeMode === "patrol",
  });

  const { isDemoMode, toggleDemoMode, demoOccupancyGrid, demoRobotPose, demoIsConnected } =
    useDemoMode();

  const effectiveIsConnected = isDemoMode ? demoIsConnected : controlledIsConnected;
  const effectiveOccupancyGrid = isDemoMode ? demoOccupancyGrid : realOccupancyGrid;
  const effectiveRobotPose = isDemoMode ? demoRobotPose : realRobotPose;

  function handleEmergencyStop() {
    stopMovement();
    deactivateCurrentMode();
  }

  const patrolWaypoints = activeMode === "patrol" ? robotConfig.patrol_waypoints : undefined;

  const connectedRobotCount = isDemoMode
    ? 1
    : connections.filter((c) => c.isConnected).length;
  const totalRobotCount = isDemoMode ? 1 : connections.length;
  const controlledRobotName = isDemoMode ? "DEMO BOT" : (controlledConnection?.config.name ?? null);

  const mapRobots = isDemoMode
    ? [{ pose: effectiveRobotPose, color: "#f59e0b", name: "DEMO" }]
    : connections
        .filter((c) => c.isConnected)
        .map((c) => ({
          pose: c.config.id === controlledRobotId ? realRobotPose : null,
          color: c.config.color,
          name: c.config.name,
        }));

  return (
    <div className="flex h-screen flex-col overflow-hidden grid-bg">
      <RobotStatusBar
        activeMode={activeMode}
        connectedRobotCount={connectedRobotCount}
        totalRobotCount={totalRobotCount}
        controlledRobotName={controlledRobotName}
        onOpenSettings={openConfigModal}
        isDemoMode={isDemoMode}
        onToggleDemoMode={toggleDemoMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <div className="flex flex-1 overflow-hidden">
        {!isFullscreen && (
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
              isConnected={effectiveIsConnected}
              onActivate={activateMode}
            />
            <OperationCard
              title={t("patrol.title")}
              description={t("patrol.description")}
              mode="patrol"
              activeMode={activeMode}
              isConnected={effectiveIsConnected}
              onActivate={activateMode}
            />
            <OperationCard
              title={t("teleop.title")}
              description={t("teleop.description")}
              mode="teleop"
              activeMode={activeMode}
              isConnected={effectiveIsConnected}
              onActivate={activateMode}
            />
            <div className="mt-auto flex flex-col items-center gap-3 pt-4">
              <img src="/undp-logo.svg" alt="UNDP" className="h-42 opacity-80" />
              <EmergencyStopButton
                connections={connections.map((c) => ({ ros: c.ros, isConnected: c.isConnected }))}
                onStop={handleEmergencyStop}
              />
            </div>
          </aside>
        )}

        <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
          {activeMode === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(4,104,177,0.15) 0%, transparent 70%)",
                    transform: "scale(1.8)",
                  }}
                />
                <img
                  src="/turtlebot3-waffle-pi.svg"
                  alt="TurtleBot3 Waffle Pi"
                  className="relative h-40 drop-shadow-lg"
                  style={{ filter: "drop-shadow(0 0 16px rgba(4,104,177,0.4))" }}
                />
              </div>
              <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-16 opacity-80" />
              <h1 className="text-4xl font-black tracking-widest uppercase text-[var(--color-text-primary)]">
                UNIPOD MADAGASCAR
              </h1>
              <p className="font-mono-data text-base text-[var(--color-text-secondary)]">TurtleBot3 Waffle Pi</p>
              <p className="font-mono-data text-sm tracking-widest uppercase text-[var(--color-accent-green)] animate-blink">
                {hudT("systemReady")}
              </p>
            </div>
          )}

          {(activeMode === "slam" || activeMode === "patrol") && (
            <div className="h-full w-full">
              <MapCanvas
                occupancyGrid={effectiveOccupancyGrid}
                robots={mapRobots}
                patrolWaypoints={patrolWaypoints}
              />
            </div>
          )}

          {activeMode === "teleop" && (
            <VirtualJoystick
              onMove={isDemoMode ? () => undefined : setVelocity}
              onRelease={isDemoMode ? () => undefined : stopMovement}
            />
          )}

          <CameraFeed
            robotConfig={controlledConnection?.config ?? null}
            isConnected={controlledIsConnected}
          />
        </main>
      </div>

      {isFullscreen && (
        <FloatingControls
          activeMode={activeMode}
          isConnected={effectiveIsConnected}
          onActivateMode={activateMode}
          onEmergencyStop={handleEmergencyStop}
        />
      )}

      <RobotConfigModal
        isOpen={isConfigModalOpen}
        onClose={closeConfigModal}
        robotConfigs={robotConfigs}
        onConfigsChange={handleConfigsChange}
      />
    </div>
  );
}
