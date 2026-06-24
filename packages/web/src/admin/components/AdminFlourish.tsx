interface AdminFlourishProps {
  mirrored?: boolean;
}

export function AdminFlourish({ mirrored = false }: AdminFlourishProps) {
  return (
    <span
      className={`admin-flourish ${mirrored ? 'admin-flourish--mirrored' : ''}`}
      aria-hidden="true"
    >
      <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
        <path
          d="M0 7 Q7 2 14 7 Q21 12 28 7"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          opacity="0.7"
        />
        <circle cx="14" cy="7" r="1.5" fill="currentColor" />
        <path d="M4 7 L6 5 M4 7 L6 9" stroke="currentColor" strokeWidth="0.8" />
        <path d="M24 7 L22 5 M24 7 L22 9" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </span>
  );
}
