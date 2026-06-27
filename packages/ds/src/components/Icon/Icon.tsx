import type { ReactNode } from 'react';
import './Icon.css';

export type DsIconName =
  | 'home' | 'history' | 'stats' | 'leaderboard' | 'trophy'
  | 'profile' | 'back' | 'crown' | 'medal' | 'flourish'
  | 'bell' | 'gear' | 'gift' | 'people' | 'person'
  | 'share' | 'plus' | 'copy' | 'mic' | 'mic-off'
  | 'speaker' | 'settings' | 'exit' | 'close' | 'check';

export interface DsIconProps {
  name: DsIconName;
  size?: number;
  className?: string;
  'aria-hidden'?: boolean;
  /** For 'medal' only: 1=gold, 2=silver, 3=bronze; rank>3 shows '#N' */
  rank?: number;
}

function getMedalTone(rank: number): string {
  if (rank === 1) return 'ds-icon--medal-gold';
  if (rank === 2) return 'ds-icon--medal-silver';
  if (rank === 3) return 'ds-icon--medal-bronze';
  return 'ds-icon--medal-other';
}

function getMedalContent(rank: number): ReactNode {
  if (rank <= 3) {
    return (
      <>
        <circle cx="12" cy="10" r="7" />
        <path d="M8 17l-1 5 5-2 5 2-1-5" />
        <text
          x="12"
          y="14"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7"
          fontWeight="bold"
          fill="currentColor"
          className="ds-icon__medal-rank"
        >
          {rank}
        </text>
      </>
    );
  }
  return (
    <>
      <circle cx="12" cy="10" r="7" />
      <path d="M8 17l-1 5 5-2 5 2-1-5" />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="5"
        fontWeight="bold"
        fill="currentColor"
        className="ds-icon__medal-rank"
      >
        #{rank}
      </text>
    </>
  );
}

function getIconContent(name: DsIconName, rank?: number): ReactNode {
  switch (name) {
    case 'home':
      return <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />;
    case 'history':
      return <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" />;
    case 'stats':
      return <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor" />;
    case 'leaderboard':
    case 'trophy':
      return <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" />;
    case 'profile':
    case 'person':
      return <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />;
    case 'back':
      return <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />;
    case 'crown':
      return <path d="M3 18h18v2H3v-2zm2.5-9L7 12l5-7 5 7 1.5-3L21 14H3l2.5-5z" fill="currentColor" />;
    case 'flourish':
      return (
        <>
          <path d="M0 6c8-6 16-6 24 0M24 6c8 6 16 6 24 0" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="24" cy="6" r="2" fill="currentColor" />
        </>
      );
    case 'medal':
      return getMedalContent(rank ?? 1);
    case 'bell':
      return <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor" />;
    case 'gear':
    case 'settings':
      return <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor" />;
    case 'people':
      return <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />;
    case 'gift':
      return <path d="M20 6h-2.18c.07-.24.18-.46.18-.71C18 3.47 16.53 2 14.71 2c-.79 0-1.41.3-2.07.93L12 3.56l-.64-.63C10.72 2.3 10.1 2 9.29 2 7.47 2 6 3.47 6 5.29c0 .25.11.47.18.71H4c-1.1 0-2 .9-2 2v3h1v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-8h1V8c0-1.1-.9-2-2-2zm-5.29-2c.48 0 .29.29.29.29S15 5.48 15 5c0 .35-.23.64-.57.74C14.09 5.82 14 5.64 14 5.46V5c0-.15.3-.29.71-.29zM8 5.29C8 4.53 8.53 4 9.29 4c.35 0 .64.14.85.36L11 5.41V5c0 .46-.3.9-.71.74C9.93 5.64 9.71 5.35 9.71 5c0 .35-.23.64-.57.74.06.08.86.26.86.55v.71H10C9.12 7 8.71 6.52 8 5.86V5.29zM11 19H5v-8h6v8zm0-10H3V8h8v1zm2 10v-8h6v8h-6zm3-10h-8V8h8v1z" fill="currentColor" />;
    case 'share':
      return <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" fill="currentColor" />;
    case 'plus':
      return <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />;
    case 'copy':
      return <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor" />;
    case 'mic':
      return <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" fill="currentColor" />;
    case 'mic-off':
      return <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" fill="currentColor" />;
    case 'speaker':
      return <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor" />;
    case 'exit':
      return <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="currentColor" />;
    case 'close':
      return <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />;
    case 'check':
      return <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />;
  }
}

export function DsIcon({
  name,
  size = 24,
  className,
  'aria-hidden': ariaHidden = true,
  rank,
}: DsIconProps): ReactNode {
  const isFlourish = name === 'flourish';
  const isMedal = name === 'medal';
  const resolvedRank = rank ?? 1;
  const toneClass = isMedal ? ` ${getMedalTone(resolvedRank)}` : '';
  const rootClass = `ds-icon ds-icon--${name}${toneClass}${className ? ` ${className}` : ''}`;

  return (
    <svg
      width={size}
      height={isFlourish ? Math.round(size / 4) : size}
      viewBox={isFlourish ? '0 0 48 12' : '0 0 24 24'}
      fill={isFlourish ? 'none' : undefined}
      className={rootClass}
      aria-hidden={ariaHidden}
    >
      {getIconContent(name, resolvedRank)}
    </svg>
  );
}
