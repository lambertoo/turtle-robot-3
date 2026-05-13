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
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-surface)] px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="/turtlebot3-waffle-pi.svg" alt="TurtleBot3 Waffle Pi" className="h-12" />
          <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-8" />
          <span className="text-lg font-bold">{tCommon("guest")}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                isConnected
                  ? "bg-[var(--color-accent-green)]"
                  : "bg-[var(--color-accent-red)]"
              }`}
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
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
