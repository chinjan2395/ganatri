import { useEffect, useRef, type ReactNode } from 'react';
import { DsIcon } from '../Icon';
import './Modal.css';

export interface DsModalProps {
  title: string;
  onClose: () => void;
  ariaLabel?: string;
  children: ReactNode;
  /** Footer slot — rendered below children. Optional. */
  footer?: ReactNode;
  /** Max width override, e.g. "520px". Default: "460px" */
  maxWidth?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function DsModal({
  title,
  onClose,
  ariaLabel,
  children,
  footer,
  maxWidth = '460px',
}: DsModalProps): ReactNode {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(): void {
    onClose();
  }

  function handlePanelClick(e: React.MouseEvent<HTMLDivElement>): void {
    e.stopPropagation();
  }

  return (
    <div className="ds-modal" onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className="ds-modal__panel"
        style={{ '--ds-modal-max-w': maxWidth } as React.CSSProperties}
        onClick={handlePanelClick}
        tabIndex={-1}
      >
        <div className="ds-modal__header">
          <h2 className="ds-modal__title">{title}</h2>
          <button
            type="button"
            className="ds-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            <DsIcon name="close" size={18} aria-hidden />
          </button>
        </div>
        <div className="ds-modal__body">
          {children}
        </div>
        {footer !== undefined ? (
          <div className="ds-modal__footer">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
