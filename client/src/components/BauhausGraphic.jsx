import React from 'react';

/**
 * Bauhaus / Swiss geometric wireframe illustration
 * Matching the exact geometric motif from the reference photo:
 * Overlapping circle, filled/outline square, triangle, diagonal line, and accent dots.
 */
export function BauhausGraphic({ variant = 'light', className = 'w-full h-full' }) {
  const isDark = variant === 'dark';
  const strokeColor = isDark ? '#FFFFFF' : '#000000';
  const fillColor = isDark ? '#FFFFFF' : '#000000';
  const secondaryFill = isDark ? '#1F2937' : '#E5E7EB';
  const bgCard = isDark ? '#111111' : '#FFFFFF';

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 400 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto max-h-72 select-none"
      >
        {/* Wireframe browser/canvas window frame */}
        <rect
          x="10"
          y="10"
          width="380"
          height="260"
          rx="2"
          fill={bgCard}
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        
        {/* Header bar line */}
        <line
          x1="10"
          y1="40"
          x2="390"
          y2="40"
          stroke={strokeColor}
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Small window dots */}
        <circle cx="28" cy="25" r="3" fill={fillColor} />
        <circle cx="40" cy="25" r="3" stroke={strokeColor} strokeWidth="1" fill="none" />
        <circle cx="52" cy="25" r="3" stroke={strokeColor} strokeWidth="1" fill="none" />

        {/* Top right label */}
        <text
          x="370"
          y="28"
          textAnchor="end"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing="0.1em"
          fill={strokeColor}
        >
          LIVE // TELEMETRY
        </text>

        {/* Geometric Composition */}
        <g transform="translate(100, 70)">
          {/* Outlined Circle (top left) */}
          <circle
            cx="50"
            cy="50"
            r="28"
            stroke={strokeColor}
            strokeWidth="2"
            fill="none"
          />

          {/* Solid Black / White Square (top right) */}
          <rect
            x="95"
            y="22"
            width="56"
            height="56"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
          />

          {/* Outlined Triangle (bottom center) */}
          <polygon
            points="70,140 135,140 102.5,82"
            stroke={strokeColor}
            strokeWidth="2"
            fill="none"
          />

          {/* Lower Outlined Circle */}
          <circle
            cx="75"
            cy="120"
            r="22"
            stroke={strokeColor}
            strokeWidth="2"
            fill="none"
          />

          {/* Diagonal connecting wireframe line */}
          <line
            x1="25"
            y1="130"
            x2="155"
            y2="30"
            stroke={strokeColor}
            strokeWidth="1.5"
          />

          {/* Accent Dots */}
          <circle cx="16" cy="75" r="4.5" fill={fillColor} />
          <circle cx="170" cy="65" r="4.5" fill={fillColor} />
          <circle cx="60" cy="6" r="3.5" fill={fillColor} />
        </g>
      </svg>
    </div>
  );
}

export default BauhausGraphic;
