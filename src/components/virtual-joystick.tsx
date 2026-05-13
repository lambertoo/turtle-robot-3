"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import robotConfig from "../../config/robot.json";

interface VirtualJoystickProps {
  onMove: (linearX: number, angularZ: number) => void;
  onRelease: () => void;
}

const JOYSTICK_RADIUS = 96;
const KNOB_RADIUS = 32;
const MAX_DISPLACEMENT = JOYSTICK_RADIUS - KNOB_RADIUS;

export function VirtualJoystick({ onMove, onRelease }: VirtualJoystickProps) {
  const t = useTranslations("joystick");
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0 });

  const calculateAndEmitVelocity = useCallback(
    (deltaX: number, deltaY: number) => {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const clampedDistance = Math.min(distance, MAX_DISPLACEMENT);
      const scale = clampedDistance / MAX_DISPLACEMENT;

      const normalizedX = distance > 0 ? (deltaX / distance) * scale : 0;
      const normalizedY = distance > 0 ? (deltaY / distance) * scale : 0;

      const linearX = -normalizedY * robotConfig.max_linear_speed;
      const angularZ = -normalizedX * robotConfig.max_angular_speed;

      const clampedKnobX = (clampedDistance * (distance > 0 ? deltaX / distance : 0));
      const clampedKnobY = (clampedDistance * (distance > 0 ? deltaY / distance : 0));

      setKnobPosition({ x: clampedKnobX, y: clampedKnobY });
      onMove(linearX, angularZ);
    },
    [onMove]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      isDraggingRef.current = true;

      const rect = containerRef.current.getBoundingClientRect();
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const deltaX = event.clientX - centerRef.current.x;
      const deltaY = event.clientY - centerRef.current.y;
      calculateAndEmitVelocity(deltaX, deltaY);
    },
    [calculateAndEmitVelocity]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const deltaX = event.clientX - centerRef.current.x;
      const deltaY = event.clientY - centerRef.current.y;
      calculateAndEmitVelocity(deltaX, deltaY);
    },
    [calculateAndEmitVelocity]
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setKnobPosition({ x: 0, y: 0 });
    onRelease();
  }, [onRelease]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          onMove(robotConfig.max_linear_speed, 0);
          setKnobPosition({ x: 0, y: -MAX_DISPLACEMENT });
          break;
        case "ArrowDown":
          event.preventDefault();
          onMove(-robotConfig.max_linear_speed, 0);
          setKnobPosition({ x: 0, y: MAX_DISPLACEMENT });
          break;
        case "ArrowLeft":
          event.preventDefault();
          onMove(0, robotConfig.max_angular_speed);
          setKnobPosition({ x: -MAX_DISPLACEMENT, y: 0 });
          break;
        case "ArrowRight":
          event.preventDefault();
          onMove(0, -robotConfig.max_angular_speed);
          setKnobPosition({ x: MAX_DISPLACEMENT, y: 0 });
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        setKnobPosition({ x: 0, y: 0 });
        onRelease();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onMove, onRelease]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <span className="absolute -top-7 text-xl select-none text-[var(--color-text-secondary)]">▲</span>
        <span className="absolute -bottom-7 text-xl select-none text-[var(--color-text-secondary)]">▼</span>
        <span className="absolute -left-7 text-xl select-none text-[var(--color-text-secondary)]">◀</span>
        <span className="absolute -right-7 text-xl select-none text-[var(--color-text-secondary)]">▶</span>

        <div
          ref={containerRef}
          className="touch-none relative h-48 w-48 rounded-full cursor-pointer select-none"
          style={{
            background: "var(--color-surface)",
            border: "2px solid var(--color-surface-hover)",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="absolute h-16 w-16 rounded-full transition-transform"
            style={{
              background: "var(--color-accent-blue)",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${knobPosition.x}px), calc(-50% + ${knobPosition.y}px))`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              transition: isDraggingRef.current ? "none" : "transform 0.15s ease-out",
            }}
          />
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)]">{t("instruction")}</p>
      <p className="text-xs text-[var(--color-text-secondary)] opacity-70">{t("keyboard")}</p>
    </div>
  );
}
