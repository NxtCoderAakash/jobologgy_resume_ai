"use client";

/**
 * Yeti mascot next to the logo (blue theme, not red). Idle → a soft, faded
 * resting state (pale circle, slightly smaller); while the user is interacting
 * (mouse / key / scroll / tap) it transitions to VIVID — solid brand-blue
 * circle, full size — looks down and smiles, then eases back to faded on idle.
 * Eyes blink continuously (botBlink keyframes in globals.css).
 */
import { useEffect, useRef, useState } from "react";

export default function BotMascot() {
  const [active, setActive] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onActivity = () => {
      setActive(true);
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(() => setActive(false), 1600);
    };
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "scroll",
      "pointerdown",
      "touchstart",
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (idle.current) clearTimeout(idle.current);
    };
  }, []);

  const mouth = active
    ? "M18.5 30 Q22 33.4 25.5 30" // smile
    : "M20.4 30.4 Q22 31.4 23.6 30.4"; // neutral

  return (
    <span
      aria-hidden
      title="Hi, I'm Yeti"
      className="inline-block h-10 w-10 shrink-0 select-none"
      style={{
        opacity: active ? 1 : 0.9,
        transform: active ? "scale(1)" : "scale(0.95)",
        transition: "opacity .4s ease, transform .4s ease",
      }}
    >
      <svg viewBox="0 0 44 44" className="h-full w-full">
        {/* themed circle: pale when idle, vivid brand-blue while interacting */}
        <circle
          cx="22"
          cy="23"
          r="21"
          style={{ fill: active ? "#2563eb" : "#bfdbfe", transition: "fill .4s ease" }}
        />
        {/* ears (behind head) */}
        <circle cx="9" cy="24" r="3" fill="#fff" />
        <circle cx="35" cy="24" r="3" fill="#fff" />
        {/* fluffy head with spiky top */}
        <path
          fill="#fff"
          d="M9 25 C9 17 12 13 15.5 13.5 L16.5 9 L19 13 L22 8 L25 13 L27.5 9 L28.5 13.5 C32 13 35 17 35 25 C35 32 30 37 22 37 C14 37 9 32 9 25 Z"
        />
        {/* pale-blue face patch */}
        <ellipse cx="22" cy="26" rx="8.6" ry="7.6" fill="#cfe0fb" />
        {/* eyebrows */}
        <path d="M16.6 22 Q18.4 21.2 20.1 21.7" stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <path d="M27.4 22 Q25.6 21.2 23.9 21.7" stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        {/* eyes: outer = look direction (state), inner = blink (CSS) */}
        <g
          style={{
            transform: active ? "translateY(1.8px)" : "translateY(0)",
            transition: "transform .35s ease",
          }}
        >
          <g className="bot-eyes">
            <circle cx="18.7" cy="24.6" r="1.5" fill="#1f2937" />
            <circle cx="25.3" cy="24.6" r="1.5" fill="#1f2937" />
          </g>
        </g>
        {/* nose */}
        <path d="M20.9 26.4 L23.1 26.4 L22 28.1 Z" fill="#1f2937" />
        {/* mouth: smiles while interacting */}
        <path d={mouth} stroke="#1f2937" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
