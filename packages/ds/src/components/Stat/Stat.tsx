import './Stat.css';

export interface StatProps {
  label: string;
  value: string;
  delta?: string;
}

export function Stat({ label, value, delta }: StatProps) {
  return (
    <div className="ds-stat">
      <span className="ds-stat__label">{label}</span>
      <strong className="ds-stat__value">{value}</strong>
      {delta ? <span className="ds-stat__delta">{delta}</span> : null}
    </div>
  );
}
