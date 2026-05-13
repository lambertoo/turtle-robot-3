"use client";

import { useTranslations } from "next-intl";
import { useRosbridge } from "@/hooks/use-rosbridge";
import { useTeleop } from "@/hooks/use-teleop";
import { VirtualJoystick } from "@/components/virtual-joystick";
import { EmergencyStopButton } from "@/components/emergency-stop-button";
import { LanguageToggle } from "@/components/language-toggle";

export default function GuestPage() {
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");

  const { ros, isConnected } = useRosbridge();
  const { setVelocity, stopMovement } = useTeleop({
    ros,
    isConnected,
    isActive: true,
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-surface)] px-6 py-3">
        <div className="flex items-center gap-3">
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
