export function ManualIcon({ className = 'evo-ico' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 20h30v16a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V20Z" />
      <g className="ico-letter">
        <rect x="15" y="9" width="18" height="15" rx="1.6" />
        <path d="M19 14h10" />
        <path d="M19 18h10" />
        <path d="M19 22h6" />
      </g>
      <path d="M9 20l15 11 15-11" />
      <path d="M9 37l11-8" />
      <path d="M39 37l-11-8" />
    </svg>
  )
}

export function OjsIcon({ className = 'evo-ico' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <g className="ico-gear-a">
        <circle cx="20" cy="27" r="7" />
        <circle cx="20" cy="27" r="2.6" />
        <path d="M20 20v-2.5" />
        <path d="M20 34v2.5" />
        <path d="M13 27h-2.5" />
        <path d="M27 27h2.5" />
        <path d="M15.05 22.05l-1.77-1.77" />
        <path d="M24.95 22.05l1.77-1.77" />
        <path d="M15.05 31.95l-1.77 1.77" />
        <path d="M24.95 31.95l1.77 1.77" />
      </g>
      <g className="ico-gear-b">
        <circle cx="33" cy="16" r="4.5" />
        <circle cx="33" cy="16" r="1.6" />
        <path d="M33 11.5v-2" />
        <path d="M33 20.5v2" />
        <path d="M28.5 16h-2" />
        <path d="M37.5 16h2" />
        <path d="M29.82 12.82l-1.4-1.4" />
        <path d="M36.18 19.18l1.4 1.4" />
        <path d="M29.82 19.18l-1.4 1.4" />
        <path d="M36.18 12.82l1.4-1.4" />
      </g>
    </svg>
  )
}

export function RocketIcon({ className = 'evo-ico' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <g className="ico-rkt">
        <path d="M24 5c4.6 3.8 6.8 9.4 6.8 16.2 0 3-.7 5.8-1.8 8.3H19c-1.1-2.5-1.8-5.3-1.8-8.3C17.2 14.4 19.4 8.8 24 5Z" />
        <circle cx="24" cy="17" r="3.1" />
        <path d="M17.4 25.5c-3 1-5.2 3.2-5.4 7.2 3.1.2 5.3-.9 7.2-2.4" />
        <path d="M30.6 25.5c3 1 5.2 3.2 5.4 7.2-3.1.2-5.3-.9-7.2-2.4" />
      </g>
      <g className="ico-flame">
        <path d="M21 30c0 3.2 1.4 6.1 3 8.4 1.6-2.3 3-5.2 3-8.4" />
        <path d="M22.6 30.5c0 2 .8 3.8 1.4 5.2.6-1.4 1.4-3.2 1.4-5.2" />
      </g>
      <circle className="ico-spark s1" cx="18.5" cy="40" r="1.1" />
      <circle className="ico-spark s2" cx="29.5" cy="42" r="1.1" />
      <path
        className="ico-star"
        d="M35 9.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z"
      />
    </svg>
  )
}

export function EvolutionIcon({ kind, className = 'evo-ico' }) {
  if (kind === 'ojs') return <OjsIcon className={className} />
  if (kind === 'manual') return <ManualIcon className={className} />
  return <RocketIcon className={className} />
}

export function EvolutionArrow({ vertical = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`evo-arrow-ico${vertical ? ' is-vertical' : ''}`}
    >
      <path className="ico-ch c1" d="M5 6l6 6-6 6" />
      <path className="ico-ch c2" d="M13 6l6 6-6 6" />
    </svg>
  )
}

export function ProcessIcon({ step, className = 'process-icon' }) {
  if (step === 1) {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          className="process-s1-page"
          d="M13 5h16l6 6v25a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"
        />
        <path className="process-s1-fold" d="M29 5v6h6" />
        <path className="process-s1-txt" d="M16 15h9" />
        <path className="process-s1-txt" d="M16 19h13" />
        <path className="process-s1-txt" d="M16 23h7" />
        <path
          className="process-s1-sign"
          d="M15 30c1.6-3.4 3-3.4 4 0s2.2 3.4 3.4 0 2.6-2.6 4-.2 2.8 1.2 3.6-1.2"
        />
        <g className="process-s1-pen">
          <path d="M29 22.5l3.5 3.5" />
          <path d="M32.5 19l3 3-8.5 8.5-4 1 1-4z" />
        </g>
        <g className="process-s1-seal">
          <circle cx="33" cy="34" r="6" />
          <path d="M30 34l2 2 4-4" />
        </g>
      </svg>
    )
  }
  if (step === 2) {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect className="process-s2-frame" x="6" y="8" width="32" height="26" rx="3" />
        <path className="process-s2-frame" d="M6 14.5h32" />
        <circle cx="10" cy="11.2" r="1" fill="currentColor" stroke="none" />
        <circle cx="13.4" cy="11.2" r="1" fill="currentColor" stroke="none" />
        <circle cx="16.8" cy="11.2" r="1" fill="currentColor" stroke="none" />
        <rect className="process-s2-block b1" x="9.5" y="18" width="8" height="12" rx="1.5" />
        <rect className="process-s2-block b2" x="21" y="18" width="13" height="5" rx="1.5" />
        <rect className="process-s2-block b3" x="21" y="25.5" width="9" height="4.5" rx="1.5" />
        <g className="process-s2-gear">
          <circle cx="37" cy="37" r="4" />
          <circle cx="37" cy="37" r="1.4" />
          <path d="M37 33v-2" />
          <path d="M37 41v2" />
          <path d="M33 37h-2" />
          <path d="M41 37h2" />
          <path d="M34.17 34.17l-1.41-1.41" />
          <path d="M39.83 39.83l1.41 1.41" />
          <path d="M34.17 39.83l-1.41 1.41" />
          <path d="M39.83 34.17l1.41-1.41" />
        </g>
        <g className="process-s2-pencil">
          <path d="M30 12.5l2.5 2.5" />
          <path d="M32 10.5l3 3-6.5 6.5-3.6 1 .9-3.6z" />
        </g>
      </svg>
    )
  }
  if (step === 3) {
    return (
      <svg
        className={className}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="18" width="30" height="18" rx="2.5" />
        <path d="M4 40h40" />
        <path d="M20.5 36l-1 4h9l-1-4" />
        <circle cx="24" cy="25.5" r="2.6" />
        <path d="M19.5 32.5c0-2.7 2-4.5 4.5-4.5s4.5 1.8 4.5 4.5" />
        <g className="process-s3-cap">
          <path d="M24 5 37 10 24 15 11 10 24 5Z" />
          <path d="M17 12v4.2c0 1.9 14 1.9 14 0V12" />
        </g>
        <g className="process-s3-tassel">
          <path d="M37 10v5.5" />
          <circle cx="37" cy="17" r="1.5" fill="currentColor" stroke="none" />
        </g>
        <path
          className="process-s3-spark"
          d="M42 24l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    )
  }
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="process-s4-gear">
        <circle cx="19" cy="26" r="7.5" />
        <circle cx="19" cy="26" r="2.8" />
        <path d="M19 18.5v-3" />
        <path d="M19 33.5v3" />
        <path d="M11.5 26h-3" />
        <path d="M26.5 26h3" />
        <path d="M13.7 20.7l-2.12-2.12" />
        <path d="M24.3 20.7l2.12-2.12" />
        <path d="M13.7 31.3l-2.12 2.12" />
        <path d="M24.3 31.3l2.12 2.12" />
      </g>
      <g className="process-s4-gear2">
        <circle cx="33" cy="14" r="4" />
        <circle cx="33" cy="14" r="1.5" />
        <path d="M33 10v-2" />
        <path d="M33 18v2" />
        <path d="M29 14h-2" />
        <path d="M37 14h2" />
        <path d="M30.17 11.17l-1.41-1.41" />
        <path d="M35.83 16.83l1.41 1.41" />
        <path d="M30.17 16.83l-1.41 1.41" />
        <path d="M35.83 11.17l1.41-1.41" />
      </g>
      <g className="process-s4-badge">
        <circle className="process-s4-badge-bg" cx="35" cy="35" r="6" />
        <path d="M35 38.2v-6.4" />
        <path d="M32.4 34.4 35 31.8l2.6 2.6" />
      </g>
    </svg>
  )
}
