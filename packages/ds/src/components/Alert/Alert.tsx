import type { ReactNode } from 'react';
import './Alert.css';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface DsAlertProps {
  tone: Tone;
  title: string;
  description: string;
}

export function DsAlert({ tone, title, description }: DsAlertProps): ReactNode {
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
