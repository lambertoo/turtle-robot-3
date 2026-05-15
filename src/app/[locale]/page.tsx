"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Service } from "roslib";
import robotConfig from "../../../config/robot.json";
import { loadRobotConfigs, getDefaultRobotConfigs, type RobotConfig } from "@/lib/robot-storage";
import { useMultiRosbridge } from "@/hooks/use-multi-rosbridge";
import { useRobotStatus } from "@/hooks/use-robot-status";
import { useTeleop } from "@/hooks/use-teleop";
import { useMapSubscription } from "@/hooks/use-map-subscription";
import { useSlam } from "@/hooks/use-slam";
import { useBattery } from "@/hooks/use-battery";
import { useImu } from "@/hooks/use-imu";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { RobotStatusBar } from "@/components/robot-status-bar";
import { OperationCard } from "@/components/operation-card";
import { MapCanvas } from "@/components/map-canvas";
import { VirtualJoystick } from "@/components/virtual-joystick";
import { EmergencyStopButton } from "@/components/emergency-stop-button";
import { RobotSelector } from "@/components/robot-selector";
import { RobotConfigModal } from "@/components/robot-config-modal";
import { CameraFeed } from "@/components/camera-feed";
import { PatrolControls } from "@/components/patrol-controls";
import { SlamControls } from "@/components/slam-controls";
import { CompassHud } from "@/components/hud/compass-hud";
import { BatteryHud } from "@/components/hud/battery-hud";
import { StatusPill } from "@/components/hud/status-pill";
import { TelemetryStrip } from "@/components/hud/telemetry-strip";
import { AttitudeIndicator } from "@/components/hud/attitude-indicator";
import { EmergencyStopHud } from "@/components/hud/emergency-stop-hud";
import { useCleaning } from "@/hooks/use-cleaning";
import { CleaningControls } from "@/components/cleaning-controls";

export default function OperatorPage() {
  const t = useTranslations("operations");
  const hudT = useTranslations("hud");

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
  const { activeMode, activateMode: rawActivateMode, deactivateCurrentMode, controlledRobotId, setControlledRobotId } =
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

  const enableMotors = useCallback(() => {
    if (controlledRos && controlledIsConnected) {
      const motorService = new Service({
        ros: controlledRos,
        name: "/motor_power",
        serviceType: "std_srvs/srv/SetBool",
      });
      motorService.callService({ data: true }, () => {}, () => {});
    }
  }, [controlledRos, controlledIsConnected]);

  const activateMode = useCallback((mode: import("@/lib/ros-types").RobotMode) => {
    rawActivateMode(mode);
  }, [rawActivateMode]);

  const { batteryVoltage, batteryPercentage } = useBattery({
    ros: controlledRos,
    isConnected: controlledIsConnected,
  });

  const { headingDegrees, rollDegrees, pitchDegrees } = useImu({
    ros: controlledRos,
    isConnected: controlledIsConnected,
  });

  const {
    slamState, explorerStatus, selectNewMap, startMapping, selectSavedMaps, backToChoose,
    saveCurrentMap, loadSavedMap, stopExploring,
  } = useSlam({
    ros: controlledRos,
    isConnected: controlledIsConnected,
    isActive: activeMode === "slam",
  });

  const {
    cleaningState, selectMap: selectCleaningMap,
    startCleaning, pauseCleaning, resumeCleaning, stopCleaning,
  } = useCleaning({
    ros: controlledRos,
    isConnected: controlledIsConnected,
    isActive: activeMode === "cleaning",
    plannerConfig: {
      stripeWidth: robotConfig.cleaning?.stripe_width ?? 0.3,
      wallMargin: robotConfig.cleaning?.wall_margin ?? 0.15,
      waypointSpacing: robotConfig.cleaning?.waypoint_spacing ?? 0.5,
    },
  });

  const handleStartMapping = useCallback(() => {
    enableMotors();
    startMapping();
  }, [enableMotors, startMapping]);

  const isSlamManualDrive = activeMode === "slam" && slamState.phase === "new-map" && slamState.exploreMode === "manual";

  const { setVelocity: rawSetVelocity, stopMovement } = useTeleop({
    ros: controlledRos,
    isConnected: controlledIsConnected,
    isActive: activeMode === "teleop" || isSlamManualDrive,
  });

  const motorsEnabledForJoystick = useRef(false);

  useEffect(() => {
    if (activeMode === "idle") {
      motorsEnabledForJoystick.current = false;
    }
  }, [activeMode]);

  const setVelocity = useCallback((linearX: number, angularZ: number) => {
    if (!motorsEnabledForJoystick.current) {
      enableMotors();
      motorsEnabledForJoystick.current = true;
    }
    rawSetVelocity(linearX, angularZ);
  }, [rawSetVelocity, enableMotors]);

  const { occupancyGrid: realOccupancyGrid, robotPose: realRobotPose, robotVelocity: realRobotVelocity } = useMapSubscription({
    ros: controlledRos,
    isConnected: controlledIsConnected,
    isActive: activeMode === "slam" || activeMode === "patrol" || activeMode === "cleaning",
  });

  const {
    isDemoMode, toggleDemoMode, demoOccupancyGrid, demoRobotPose, demoIsConnected,
    patrolState, addWaypoint, removeWaypoint, clearWaypoints, togglePatrolLoop, startPatrol,
  } = useDemoMode();

  const effectiveIsConnected = isDemoMode ? demoIsConnected : controlledIsConnected;
  const effectiveOccupancyGrid = isDemoMode
    ? demoOccupancyGrid
    : activeMode === "cleaning" && cleaningState.occupancyGrid
      ? cleaningState.occupancyGrid
      : realOccupancyGrid;
  const effectiveRobotPose = isDemoMode ? demoRobotPose : realRobotPose;

  function handleEmergencyStop() {
    stopMovement();
    if (!isDemoMode) {
      deactivateCurrentMode();
    }
  }

  function handleHudEmergencyStop() {
    stopMovement();
    if (controlledRos && controlledIsConnected) {
      const motorService = new Service({
        ros: controlledRos,
        name: "/motor_power",
        serviceType: "std_srvs/srv/SetBool",
      });
      motorService.callService({ data: false }, () => {}, () => {});
    }
  }

  const patrolWaypoints = activeMode === "patrol"
    ? (isDemoMode ? patrolState.waypoints : robotConfig.patrol_waypoints)
    : undefined;

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

  const showJoystick = activeMode === "teleop" || isSlamManualDrive;

  if (activeMode !== "idle") {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-black">
        {/* ── FULL-SCREEN MAP ── */}
        {(activeMode === "slam" || activeMode === "patrol" || activeMode === "cleaning") && (
          <MapCanvas
            occupancyGrid={effectiveOccupancyGrid}
            robots={mapRobots}
            patrolWaypoints={activeMode === "patrol" ? patrolWaypoints : undefined}
            isClickable={activeMode === "patrol" && isDemoMode && !patrolState.isPatrolRunning}
            onMapClick={activeMode === "patrol" && isDemoMode ? addWaypoint : undefined}
            coveragePath={activeMode === "cleaning" ? cleaningState.waypoints : undefined}
            coverageCurrentIndex={activeMode === "cleaning" ? cleaningState.currentWaypointIndex : undefined}
            coverageMissedIndices={activeMode === "cleaning" ? cleaningState.missedWaypoints : undefined}
          />
        )}

        {activeMode === "teleop" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid-bg absolute inset-0" />
          </div>
        )}

        {/* ── TOP-LEFT: Compass ── */}
        <div className="absolute top-3 left-3 z-10">
          <CompassHud headingDegrees={headingDegrees} />
        </div>

        {/* ── TOP-CENTER: Status pill ── */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <StatusPill
            activeMode={activeMode}
            isConnected={effectiveIsConnected}
            robotName={controlledRobotName}
            onExitMode={deactivateCurrentMode}
          />
        </div>

        {/* ── TOP-RIGHT: Battery ── */}
        <div className="absolute top-3 right-3 z-10">
          <BatteryHud voltage={batteryVoltage} percentage={batteryPercentage} />
        </div>

        {/* ── BOTTOM-LEFT: Mode controls ── */}
        <div className="absolute bottom-4 left-3 z-10">
          {activeMode === "slam" && (
            <SlamControls
              slamState={slamState}
              explorerStatus={explorerStatus}
              onSelectNewMap={selectNewMap}
              onStartMapping={handleStartMapping}
              onSelectSavedMaps={selectSavedMaps}
              onBack={backToChoose}
              onSaveMap={saveCurrentMap}
              onLoadMap={loadSavedMap}
              onStopExploring={stopExploring}
            />
          )}
          {activeMode === "patrol" && isDemoMode && (
            <PatrolControls
              waypoints={patrolState.waypoints}
              isLooping={patrolState.isLooping}
              isPatrolRunning={patrolState.isPatrolRunning}
              currentWaypointIndex={patrolState.currentWaypointIndex}
              onToggleLoop={togglePatrolLoop}
              onStart={startPatrol}
              onClear={clearWaypoints}
              onRemoveWaypoint={removeWaypoint}
            />
          )}
          {activeMode === "cleaning" && (
            <CleaningControls
              cleaningState={cleaningState}
              onSelectMap={selectCleaningMap}
              onStartCleaning={startCleaning}
              onPause={pauseCleaning}
              onResume={resumeCleaning}
              onStop={stopCleaning}
              onDone={deactivateCurrentMode}
            />
          )}
        </div>

        {/* ── LEFT: Attitude indicator (below compass) ── */}
        <div className="absolute top-[110px] left-3 z-10">
          <AttitudeIndicator rollDegrees={rollDegrees} pitchDegrees={pitchDegrees} />
        </div>

        {/* ── BOTTOM-CENTER: Telemetry strip ── */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <TelemetryStrip headingDegrees={headingDegrees} velocity={realRobotVelocity} />
        </div>

        {/* ── RIGHT-CENTER: Emergency stop ── */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
          <EmergencyStopHud onStop={handleHudEmergencyStop} />
        </div>

        {/* ── BOTTOM-RIGHT: Joystick ── */}
        {showJoystick && (
          <div className="absolute bottom-4 right-4 z-10">
            <VirtualJoystick
              onMove={isDemoMode ? () => undefined : setVelocity}
              onRelease={isDemoMode ? () => undefined : stopMovement}
            />
          </div>
        )}

        {/* ── Camera PiP ── */}
        <CameraFeed
          robotConfig={controlledConnection?.config ?? null}
          isConnected={controlledIsConnected}
        />

        <RobotConfigModal
          isOpen={isConfigModalOpen}
          onClose={closeConfigModal}
          robotConfigs={robotConfigs}
          onConfigsChange={handleConfigsChange}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden grid-bg">
      <RobotStatusBar
        activeMode={activeMode}
        connectedRobotCount={connectedRobotCount}
        totalRobotCount={totalRobotCount}
        controlledRobotName={controlledRobotName}
        batteryVoltage={batteryVoltage}
        batteryPercentage={batteryPercentage}
        headingDegrees={headingDegrees}
        onOpenSettings={openConfigModal}
        isDemoMode={isDemoMode}
        onToggleDemoMode={toggleDemoMode}
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
            isConnected={effectiveIsConnected}
            onActivate={activateMode}
            clickToStopLabel={t("clickToStop")}
          />
          <OperationCard
            title={t("patrol.title")}
            description={t("patrol.description")}
            mode="patrol"
            activeMode={activeMode}
            isConnected={effectiveIsConnected}
            onActivate={activateMode}
            clickToStopLabel={t("clickToStop")}
          />
          <OperationCard
            title={t("teleop.title")}
            description={t("teleop.description")}
            mode="teleop"
            activeMode={activeMode}
            isConnected={effectiveIsConnected}
            onActivate={activateMode}
            clickToStopLabel={t("clickToStop")}
          />
          <OperationCard
            title={t("clean.title")}
            description={t("clean.description")}
            mode="cleaning"
            activeMode={activeMode}
            isConnected={effectiveIsConnected}
            onActivate={activateMode}
            clickToStopLabel={t("clickToStop")}
          />
          <div className="mt-auto flex flex-col items-center gap-3 pt-4">
            <img src="/undp-logo.svg" alt="UNDP" className="h-42 opacity-80" />
            <EmergencyStopButton
              connections={connections.map((c) => ({ ros: c.ros, isConnected: c.isConnected }))}
              onStop={handleEmergencyStop}
            />
          </div>
        </aside>

        <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
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
