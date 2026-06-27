import type { ReactNode } from 'react';
import './FeltBackdrop.css';

export function FeltBackdrop(): ReactNode {
  return (
    <div className="room__felt-backdrop" aria-hidden="true">
      <svg className="room__felt-crest" viewBox="0 0 240 280" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M68 178c-18-28-8-62 14-78 8-6 16-4 22 2M172 178c18-28 8-62-14-78-8-6-16-4-22 2"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M82 168c-6-18 2-36 16-46M158 168c6-18-2-36-16-46"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="120" cy="158" r="54" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="120" cy="158" r="46" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        <path
          d="M120 118c-16.5 0-30 12.2-30 27.4 0 11.8 9.5 18.8 19 21.2-7.2 9.6-12 16.8-12 16.8h46s-4.8-7.2-12-16.8c9.5-2.4 19-9.4 19-21.2 0-15.2-13.5-27.4-30-27.4z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M92 76h56l-10 18-12-14-10 16-10-16-12 14z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M98 76V68h8v8M134 76V68h8v8M116 68v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M120 52v10M108 58l4 8M132 58l-4 8"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.65"
        />
      </svg>
    </div>
  );
}
