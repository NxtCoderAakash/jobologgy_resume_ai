"use client";

/**
 * Panda mascot next to the logo. Simple, high-contrast line art so the eyes and
 * their movement read even at ~36px. It blinks continuously; while the user is
 * interacting (mouse / key / scroll / tap) it looks DOWN and smiles, and after
 * a short idle it looks straight ahead with a neutral mouth. Blink keyframes
 * live in globals.css (.bot-eyes).
 */
import { useEffect, useRef, useState } from "react";

export default function BotMascot() {
  const [active, setActive] = useState(false); // interacting → look down + smile
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onActivity = () => {
      setActive(true); // React skips re-render if unchanged
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
    ? "M16 28.5 Q20 33 24 28.5" // smile
    : "M17.8 29.2 Q20 30.4 22.2 29.2"; // neutral

  return (
    <span aria-hidden title="Hi, I'm Pip" className="inline-block h-9 w-9 shrink-0 select-none">
      <svg viewBox="0 0 40 40" className="h-full w-full">
        {/* ears */}
        <circle cx="11" cy="10" r="5" fill="#0f172a" />
        <circle cx="29" cy="10" r="5" fill="#0f172a" />
        {/* head */}
        <ellipse cx="20" cy="22" rx="14" ry="12.5" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
        {/* eye patches (tilted teardrops) */}
        <ellipse cx="15" cy="20" rx="4.2" ry="5.4" fill="#0f172a" transform="rotate(20 15 20)" />
        <ellipse cx="25" cy="20" rx="4.2" ry="5.4" fill="#0f172a" transform="rotate(-20 25 20)" />
        {/* eyes: outer group = look direction (state), inner = blink (CSS) */}
        <g
          style={{
            transform: active ? "translateY(2px)" : "translateY(0)",
            transition: "transform .35s ease",
          }}
        >
          <g className="bot-eyes">
            <circle cx="15" cy="20" r="2.3" fill="#fff" />
            <circle cx="15" cy="20" r="1.2" fill="#0f172a" />
            <circle cx="25" cy="20" r="2.3" fill="#fff" />
            <circle cx="25" cy="20" r="1.2" fill="#0f172a" />
          </g>
        </g>
        {/* nose */}
        <ellipse cx="20" cy="25.6" rx="1.9" ry="1.3" fill="#0f172a" />
        {/* mouth: smiles while interacting */}
        <path d={mouth} stroke="#0f172a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
