import { useEffect } from 'react';
import './Toast.css';

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps): React.ReactNode {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className="toast" role="alert" onClick={onDismiss}>
      {message}
    </div>
  );
}
