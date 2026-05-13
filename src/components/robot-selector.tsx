"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import type { RobotConnection } from "@/hooks/use-multi-rosbridge";

interface RobotSelectorProps {
  connections: RobotConnection[];
  controlledRobotId: string | null;
  onSelectRobot: (id: string) => void;
}

function connectionStatusColor(isConnected: boolean, hasError: boolean): string {
  if (isConnected) return "bg-[var(--color-accent-green)]";
  if (hasError) return "bg-[var(--color-accent-red)]";
  return "bg-[var(--color-text-secondary)]";
}

export function RobotSelector({ connections, controlledRobotId, onSelectRobot }: RobotSelectorProps) {
  const t = useTranslations("robotSelector");
  const pathname = usePathname();
  const router = useRouter();

  const localePrefix = pathname.split("/").slice(0, 2).join("/");
  const settingsPath = `${localePrefix}/settings`;

  if (connections.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--color-surface)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {t("title")}
        </p>
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">{t("noRobots")}</p>
        <button
          onClick={() => router.push(settingsPath)}
          className="text-sm text-[var(--color-accent-blue)] underline"
        >
          {t("addInSettings")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {t("title")}
        </p>
        <button
          onClick={() => router.push(settingsPath)}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          title="Settings"
        >
          ⚙
        </button>
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
                  ? "bg-[var(--color-surface-hover)] font-semibold"
                  : "hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ background: config.color }}
              />
              <span className="flex-1 truncate">{config.name}</span>
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${connectionStatusColor(isConnected, connectionError !== null)}`}
              />
              {isControlled && (
                <span className="text-xs text-[var(--color-text-secondary)]">
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
