import type { ReactNode } from 'react';
import './Avatar.css';

export interface DsAvatarProps {
  src?: string | null;
  displayName: string;
  size?: number;
  className?: string;
}

export function DsAvatar({
  src,
  displayName,
  size = 40,
  className,
}: DsAvatarProps): ReactNode {
  const rootClass = `ds-avatar${className ? ` ${className}` : ''}`;
  return (
    <div
      className={rootClass}
      style={{ width: size, height: size }}
      aria-label={displayName}
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
          {displayName.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
