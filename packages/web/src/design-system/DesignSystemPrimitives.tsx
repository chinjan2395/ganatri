import type { ReactNode } from 'react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';
type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost';

export function DsPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}): ReactNode {
  return (
    <header className="ds-hero">
      <div className="ds-hero__copy">
        <span className="ds-eyebrow">{eyebrow}</span>
        <h1 className="ds-hero__title">{title}</h1>
        <p className="ds-hero__description">{description}</p>
      </div>
      {actions ? <div className="ds-hero__actions">{actions}</div> : null}
    </header>
  );
}

export function DsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="ds-section">
      <div className="ds-section__header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

export function DsCard({
  title,
  subtitle,
  tone = 'default',
  children,
}: {
  title?: string;
  subtitle?: string;
  tone?: Tone;
  children: ReactNode;
}): ReactNode {
  return (
    <article className={`ds-card ds-card--${tone}`}>
      {title || subtitle ? (
        <div className="ds-card__header">
          {title ? <h3>{title}</h3> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function DsButton({
  label,
  tone = 'primary',
  compact = false,
  disabled = false,
}: {
  label: string;
  tone?: ButtonTone;
  compact?: boolean;
  disabled?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      className={`ds-button ds-button--${tone}${compact ? ' ds-button--compact' : ''}`}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function DsBadge({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: Tone;
}): ReactNode {
  return <span className={`ds-badge ds-badge--${tone}`}>{label}</span>;
}

export function DsField({
  label,
  value,
  placeholder,
  helper,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  helper?: string;
}): ReactNode {
  return (
    <label className="ds-field">
      <span className="ds-field__label">{label}</span>
      <input value={value} placeholder={placeholder} readOnly />
      {helper ? <span className="ds-field__helper">{helper}</span> : null}
    </label>
  );
}

export function DsStat({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}): ReactNode {
  return (
    <div className="ds-stat">
      <span className="ds-stat__label">{label}</span>
      <strong className="ds-stat__value">{value}</strong>
      {delta ? <span className="ds-stat__delta">{delta}</span> : null}
    </div>
  );
}

export function DsListRow({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}): ReactNode {
  return (
    <div className="ds-list-row">
      <div className="ds-list-row__avatar" aria-hidden="true">
        {title.charAt(0).toUpperCase()}
      </div>
      <div className="ds-list-row__copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {trailing ? <div className="ds-list-row__trailing">{trailing}</div> : null}
    </div>
  );
}

export function DsTabs({ items, active }: { items: string[]; active: string }): ReactNode {
  return (
    <div className="ds-tabs" role="tablist" aria-label="Preview tabs">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={item === active}
          className={`ds-tab${item === active ? ' is-active' : ''}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function DsAlert({
  tone,
  title,
  description,
}: {
  tone: Tone;
  title: string;
  description: string;
}): ReactNode {
  return (
    <div className={`ds-alert ds-alert--${tone}`}>
      <div className="ds-alert__dot" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}
