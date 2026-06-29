import type { ReactNode } from 'react';
import './Avatar.css';

export interface DsAvatarProps {
  src?: string | null;
  /** Display name used for initials fallback and aria-label */
  displayName: string;
  /** Alias for displayName (convenience) */
  name?: string;
  size?: number;
  className?: string;
  /** Show green online indicator dot */
  online?: boolean;
}

export function DsAvatar({
  src,
  displayName,
  name,
  size = 40,
  className,
  online,
}: DsAvatarProps): ReactNode {
  const label = displayName || name || '';
  const rootClass = `ds-avatar${className ? ` ${className}` : ''}${online ? ' ds-avatar--online' : ''}`;
  return (
    <div
      className={rootClass}
      style={{ width: size, height: size }}
      aria-label={label}
    >
      {src ? (
        <img
          className="ds-avatar__img"
          src={src}
          alt=""
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="ds-avatar__initials" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      {online ? <span className="ds-avatar__online-dot" aria-label="Online" /> : null}
    </div>
  );
}
