/**
 * Jobologyy logo mark — an SVG recreation of the badge (blue tile, white
 * starburst seal, yellow lightbulb). Crisp at any size and bundled, unlike a
 * hotlinked raster. Sized by the caller via className (default h-9 w-9).
 */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span className={`inline-block shrink-0 ${className}`} aria-label="Jobologyy">
      <svg viewBox="0 0 48 48" className="h-full w-full">
        {/* blue tile */}
        <rect width="48" height="48" rx="10" fill="#2557a8" />
        {/* white 12-point starburst seal */}
        <polygon
          fill="#ffffff"
          points="24,4 27.9,9.2 34,6.6 34.6,13.2 41.4,13.8 38.5,19.7 44,24 38.5,28.3 41.4,34.2 34.6,34.8 34,41.4 27.9,38.8 24,44 20.1,38.8 14,41.4 13.4,34.8 6.6,34.2 9.5,28.3 4,24 9.5,19.7 6.6,13.8 13.4,13.2 14,6.6 20.1,9.2"
        />
        {/* lightbulb rays */}
        <g stroke="#f5b800" strokeWidth="1.5" strokeLinecap="round">
          <line x1="24" y1="12.5" x2="24" y2="15" />
          <line x1="18" y1="14.4" x2="19.6" y2="16.4" />
          <line x1="30" y1="14.4" x2="28.4" y2="16.4" />
          <line x1="15.3" y1="20" x2="17.8" y2="20.6" />
          <line x1="32.7" y1="20" x2="30.2" y2="20.6" />
        </g>
        {/* bulb glass */}
        <circle cx="24" cy="21.2" r="5" fill="#ffd21f" />
        {/* screw base */}
        <rect x="21.9" y="25.4" width="4.2" height="3" rx="1" fill="#c9ced6" />
        <line x1="22.3" y1="28.6" x2="25.7" y2="28.6" stroke="#c9ced6" strokeWidth="1" strokeLinecap="round" />
        {/* mini "JOBOLOGYY" banner */}
        <rect x="10" y="32.5" width="28" height="7" rx="1.5" fill="#2557a8" />
        <text
          x="24"
          y="37.6"
          textAnchor="middle"
          fontSize="4.2"
          fontWeight="800"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
          letterSpacing="0.2"
        >
          JOBOLOGYY
        </text>
      </svg>
    </span>
  );
}
