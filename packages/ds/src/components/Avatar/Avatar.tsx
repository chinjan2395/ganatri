import type { ReactNode } from 'react';
import './Avatar.css';

const PRESET_COLORS: Record<string, string> = {
  'preset:1': '#c0392b',
  'preset:2': '#2980b9',
  'preset:3': '#27ae60',
  'preset:4': '#8e44ad',
  'preset:5': '#e67e22',
  'preset:6': '#16a085',
  'preset:7': '#d4ac0d',
  'preset:8': '#2c3e50',
};

export const PRESET_AVATAR_KEYS = [
  'preset:1',
  'preset:2',
  'preset:3',
  'preset:4',
  'preset:5',
  'preset:6',
  'preset:7',
  'preset:8',
] as const;

export type PresetAvatarKey = typeof PRESET_AVATAR_KEYS[number];

export function getPresetColor(key: string): string | undefined {
  return PRESET_COLORS[key];
}

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
  const presetColor = src && src.startsWith('preset:') ? PRESET_COLORS[src] : undefined;
  return (
    <div
      className={rootClass}
      style={{ width: size, height: size, ...(presetColor ? { backgroundColor: presetColor } : {}) }}
      aria-label={label}
    >
      {presetColor || !src ? (
        <span className="ds-avatar__initials" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img
          className="ds-avatar__img"
          src={src}
          alt=""
          referrerPolicy="no-referrer"
        />
      )}
      {online ? <span className="ds-avatar__online-dot" aria-label="Online" /> : null}
    </div>
  );
}
