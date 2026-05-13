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
  const [isDragging, setIsDragging] = useState(false);
  const centerRef = useRef({ x: 0, y: 0 });
  const [readoutLinearX, setReadoutLinearX] = useState(0);
  const [readoutAngularZ, setReadoutAngularZ] = useState(0);

  const calculateAndEmitVelocity = useCallback(
    (deltaX: number, deltaY: number) => {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const clampedDistance = Math.min(distance, MAX_DISPLACEMENT);
      const scale = clampedDistance / MAX_DISPLACEMENT;

      const normalizedX = distance > 0 ? (deltaX / distance) * scale : 0;
      const normalizedY = distance > 0 ? (deltaY / distance) * scale : 0;

      const linearX = -normalizedY * robotConfig.max_linear_speed;
      const angularZ = -normalizedX * robotConfig.max_angular_speed;

      const clampedKnobX = clampedDistance * (distance > 0 ? deltaX / distance : 0);
      const clampedKnobY = clampedDistance * (distance > 0 ? deltaY / distance : 0);

      setKnobPosition({ x: clampedKnobX, y: clampedKnobY });
      setReadoutLinearX(linearX);
      setReadoutAngularZ(angularZ);
      onMove(linearX, angularZ);
    },
    [onMove]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      isDraggingRef.current = true;
      setIsDragging(true);

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
    setIsDragging(false);
    setKnobPosition({ x: 0, y: 0 });
    setReadoutLinearX(0);
    setReadoutAngularZ(0);
    onRelease();
  }, [onRelease]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          onMove(robotConfig.max_linear_speed, 0);
          setKnobPosition({ x: 0, y: -MAX_DISPLACEMENT });
          setReadoutLinearX(robotConfig.max_linear_speed);
          setReadoutAngularZ(0);
          break;
        case "ArrowDown":
          event.preventDefault();
          onMove(-robotConfig.max_linear_speed, 0);
          setKnobPosition({ x: 0, y: MAX_DISPLACEMENT });
          setReadoutLinearX(-robotConfig.max_linear_speed);
          setReadoutAngularZ(0);
          break;
        case "ArrowLeft":
          event.preventDefault();
          onMove(0, robotConfig.max_angular_speed);
          setKnobPosition({ x: -MAX_DISPLACEMENT, y: 0 });
          setReadoutLinearX(0);
          setReadoutAngularZ(robotConfig.max_angular_speed);
          break;
        case "ArrowRight":
          event.preventDefault();
          onMove(0, -robotConfig.max_angular_speed);
          setKnobPosition({ x: MAX_DISPLACEMENT, y: 0 });
          setReadoutLinearX(0);
          setReadoutAngularZ(-robotConfig.max_angular_speed);
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        setKnobPosition({ x: 0, y: 0 });
        setReadoutLinearX(0);
        setReadoutAngularZ(0);
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

  const joystickSize = JOYSTICK_RADIUS * 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center">
        <span className="absolute -top-7 text-base select-none text-[var(--color-text-secondary)] opacity-40">▲</span>
        <span className="absolute -bottom-7 text-base select-none text-[var(--color-text-secondary)] opacity-40">▼</span>
        <span className="absolute -left-7 text-base select-none text-[var(--color-text-secondary)] opacity-40">◀</span>
        <span className="absolute -right-7 text-base select-none text-[var(--color-text-secondary)] opacity-40">▶</span>

        <div
          ref={containerRef}
          className="touch-none relative cursor-pointer select-none"
          style={{
            width: joystickSize,
            height: joystickSize,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)",
            border: "2px solid rgba(59, 130, 246, 0.25)",
            boxShadow: "inset 0 2px 12px rgba(0,0,0,0.5), 0 0 20px rgba(59,130,246,0.05)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <svg
            className="absolute inset-0 pointer-events-none"
            width={joystickSize}
            height={joystickSize}
          >
            {[0.25, 0.5, 0.75].map((fraction) => (
              <circle
                key={fraction}
                cx={JOYSTICK_RADIUS}
                cy={JOYSTICK_RADIUS}
                r={JOYSTICK_RADIUS * fraction}
                fill="none"
                stroke="rgba(59, 130, 246, 0.08)"
                strokeWidth="1"
              />
            ))}
            <line
              x1={JOYSTICK_RADIUS}
              y1="4"
              x2={JOYSTICK_RADIUS}
              y2={joystickSize - 4}
              stroke="rgba(59, 130, 246, 0.1)"
              strokeWidth="1"
            />
            <line
              x1="4"
              y1={JOYSTICK_RADIUS}
              x2={joystickSize - 4}
              y2={JOYSTICK_RADIUS}
              stroke="rgba(59, 130, 246, 0.1)"
              strokeWidth="1"
            />
          </svg>

          <div
            className="absolute rounded-full"
            style={{
              width: KNOB_RADIUS * 2,
              height: KNOB_RADIUS * 2,
              background: "radial-gradient(circle at 35% 35%, rgba(96,165,250,0.9), rgba(37,99,235,0.8))",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${knobPosition.x}px), calc(-50% + ${knobPosition.y}px))`,
              boxShadow: isDragging
                ? "0 0 20px rgba(59,130,246,0.7), 0 0 40px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.5)"
                : "0 2px 8px rgba(0,0,0,0.5), 0 0 8px rgba(59,130,246,0.2)",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
          />
        </div>
      </div>

      <div className="font-mono-data text-sm flex gap-6 text-[var(--color-text-secondary)]">
        <span>
          LIN: <span className="text-[var(--color-accent-blue)]">{readoutLinearX.toFixed(2)}</span>
        </span>
        <span>
          ANG: <span className="text-[var(--color-accent-blue)]">{readoutAngularZ.toFixed(2)}</span>
        </span>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)]">{t("instruction")}</p>
      <p className="text-xs text-[var(--color-text-secondary)] opacity-70">{t("keyboard")}</p>
    </div>
  );
}
