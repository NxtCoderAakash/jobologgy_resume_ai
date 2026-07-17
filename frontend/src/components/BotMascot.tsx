"use client";

/**
 * Little robot mascot next to the logo. It blinks continuously; its eyes look
 * DOWN while the user is interacting (mouse move / key / scroll / tap) and
 * return to looking straight ahead after a short idle. Pure inline SVG + CSS
 * (blink keyframes live in globals.css as .bot-eyes) — no image asset.
 */
import { useEffect, useRef, useState } from "react";

export default function BotMascot() {
  const [looking, setLooking] = useState(false); // true = looking down (active)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onActivity = () => {
      setLooking(true); // React skips re-render if already true
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(() => setLooking(false), 1600);
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

  return (
    <span
      aria-hidden
      title="Hi, I'm Joby"
      className="inline-block h-9 w-9 shrink-0 select-none"
    >
      <svg viewBox="0 0 40 40" className="h-full w-full">
        {/* antenna */}
        <line x1="20" y1="9" x2="20" y2="4" stroke="#93c5fd" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="20" cy="3" r="2" fill="#d946ef" />
        {/* ears */}
        <rect x="3.5" y="16" width="3" height="8" rx="1.5" fill="#1d4ed8" />
        <rect x="33.5" y="16" width="3" height="8" rx="1.5" fill="#1d4ed8" />
        {/* head */}
        <rect x="6" y="9" width="28" height="25" rx="8" fill="#2563eb" />
        {/* visor */}
        <rect x="9.5" y="13.5" width="21" height="14" rx="6" fill="#0f172a" />
        {/* eyes: outer group = look direction (state), inner = blink (CSS) */}
        <g
          style={{
            transform: looking ? "translateY(2.6px)" : "translateY(0)",
            transition: "transform .35s ease",
          }}
        >
          <g className="bot-eyes">
            <rect x="13.8" y="18" width="4" height="5.6" rx="2" fill="#7dd3fc" />
            <rect x="22.2" y="18" width="4" height="5.6" rx="2" fill="#7dd3fc" />
          </g>
        </g>
      </svg>
    </span>
  );
}
