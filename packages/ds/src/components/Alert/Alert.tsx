import './Alert.css';

export type AlertTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface AlertProps {
  tone: AlertTone;
  title: string;
  description: string;
}

export function Alert({ tone, title, description }: AlertProps) {
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
