"use client";

import { useTranslations } from "next-intl";
import type { RobotConnection } from "@/hooks/use-multi-rosbridge";

interface RobotSelectorProps {
  connections: RobotConnection[];
  controlledRobotId: string | null;
  onSelectRobot: (id: string) => void;
  onOpenConfigModal: () => void;
}

function connectionStatusDotClass(isConnected: boolean, hasError: boolean): string {
  if (isConnected) return "status-dot-connected";
  if (hasError) return "status-dot-disconnected";
  return "bg-[var(--color-text-secondary)]";
}

export function RobotSelector({
  connections,
  controlledRobotId,
  onSelectRobot,
  onOpenConfigModal,
}: RobotSelectorProps) {
  const t = useTranslations("robotSelector");
  const hudT = useTranslations("hud");

  if (connections.length === 0) {
    return (
      <div className="rounded-xl hud-panel p-3">
        <p className="mb-1 font-mono-data text-xs font-semibold uppercase tracking-widest text-[var(--color-accent-blue)] opacity-70">
          {hudT("fleet")}
        </p>
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">{t("noRobots")}</p>
        <button
          onClick={onOpenConfigModal}
          className="text-sm text-[var(--color-accent-blue)] underline hover:opacity-80 transition-opacity"
        >
          {t("addInSettings")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl hud-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono-data text-xs font-semibold uppercase tracking-widest text-[var(--color-accent-blue)] opacity-70">
          {hudT("fleet")}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenConfigModal}
            className="rounded px-1 py-0.5 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            title="Configure robots"
          >
            +
          </button>
          <button
            onClick={onOpenConfigModal}
            className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            title="Robot settings"
          >
            ⚙
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {connections.map(({ config, isConnected, connectionError }) => {
          const isControlled = controlledRobotId === config.id;
          return (
            <button
              key={config.id}
              onClick={() => onSelectRobot(config.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                isControlled
                  ? "bg-[var(--color-surface-hover)] font-semibold border-l-2"
                  : "hover:bg-[var(--color-surface-hover)] border-l-2 border-transparent"
              }`}
              style={isControlled ? { borderLeftColor: config.color } : undefined}
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: config.color }}
              />
              <span className="flex-1 truncate font-mono-data">{config.name}</span>
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${connectionStatusDotClass(isConnected, connectionError !== null)}`}
              />
              {isControlled && (
                <span className="font-mono-data text-xs text-[var(--color-accent-blue)] opacity-70">
                  {t("controlling")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
