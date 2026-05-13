import { useState, useCallback } from "react";
import type { RobotMode } from "@/lib/ros-types";

export interface RobotStatus {
  activeMode: RobotMode;
  setActiveMode: (mode: RobotMode) => void;
  activateMode: (mode: RobotMode) => void;
  deactivateCurrentMode: () => void;
  controlledRobotId: string | null;
  setControlledRobotId: (id: string | null) => void;
}

export function useRobotStatus(): RobotStatus {
  const [activeMode, setActiveMode] = useState<RobotMode>("idle");
  const [controlledRobotId, setControlledRobotId] = useState<string | null>(null);

  const activateMode = useCallback((mode: RobotMode) => {
    setActiveMode(mode);
  }, []);

  const deactivateCurrentMode = useCallback(() => {
    setActiveMode("idle");
  }, []);

  return {
    activeMode,
    setActiveMode,
    activateMode,
    deactivateCurrentMode,
    controlledRobotId,
    setControlledRobotId,
  };
}
