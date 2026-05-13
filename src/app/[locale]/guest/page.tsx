"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { loadRobotConfigs, getDefaultRobotConfigs, type RobotConfig } from "@/lib/robot-storage";
import { useRosbridge } from "@/hooks/use-rosbridge";
import { useTeleop } from "@/hooks/use-teleop";
import { VirtualJoystick } from "@/components/virtual-joystick";
import { EmergencyStopButton } from "@/components/emergency-stop-button";
import { LanguageToggle } from "@/components/language-toggle";

export default function GuestPage() {
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const tRobotSelector = useTranslations("robotSelector");
  const hudT = useTranslations("hud");

  const [robotConfigs, setRobotConfigs] = useState<RobotConfig[]>([]);
  const [selectedConfigIndex, setSelectedConfigIndex] = useState(0);

  useEffect(() => {
    const stored = loadRobotConfigs();
    const configs = stored.length > 0 ? stored : getDefaultRobotConfigs();
    setRobotConfigs(configs);
  }, []);

  const selectedConfig = robotConfigs[selectedConfigIndex] ?? null;
  const rosbridgeUrl = selectedConfig ? `ws://${selectedConfig.ip}:${selectedConfig.port}` : null;

  const { ros, isConnected } = useRosbridge(rosbridgeUrl);
  const { setVelocity, stopMovement } = useTeleop({
    ros,
    isConnected,
    isActive: true,
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden grid-bg">
      <header className="relative flex items-center justify-between hud-panel border-b border-blue-500/20 px-6 py-3">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--color-madagascar-green)] via-[var(--color-accent-blue)] to-[var(--color-madagascar-green)]" />
        <div className="flex items-center gap-3">
          <img src="/turtlebot3-waffle-pi.svg" alt="TurtleBot3 Waffle Pi" className="h-12" />
          <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-8" />
          <span className="text-lg font-bold tracking-wide">{tCommon("guest")}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-xs text-[var(--color-text-secondary)] tracking-widest uppercase">
              {hudT("system")}
            </span>
            <div
              className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                isConnected ? "status-dot-connected animate-pulse-glow" : "status-dot-disconnected"
              }`}
            />
            <span className="font-mono-data text-sm text-[var(--color-text-secondary)]">
              {isConnected ? tCommon("connected") : tCommon("disconnected")}
            </span>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8">
        {robotConfigs.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {tRobotSelector("selectRobot")}:
            </span>
            {robotConfigs.map((config, index) => (
              <button
                key={config.id}
                onClick={() => setSelectedConfigIndex(index)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1 text-sm transition ${
                  selectedConfigIndex === index
                    ? "bg-[var(--color-surface-hover)] font-semibold"
                    : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: config.color }}
                />
                {config.name}
              </button>
            ))}
          </div>
        )}

        {isConnected ? (
          <>
            <VirtualJoystick onMove={setVelocity} onRelease={stopMovement} />
            <div className="w-64">
              <EmergencyStopButton
                ros={ros}
                isConnected={isConnected}
                onStop={stopMovement}
              />
            </div>
          </>
        ) : (
          <p className="text-lg text-[var(--color-text-secondary)]">
            {tStatus("connecting")}
          </p>
        )}
      </main>
    </div>
  );
}
