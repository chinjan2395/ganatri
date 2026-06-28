import type { ReactNode } from 'react';
import { DsIcon } from '../Icon';
import { DsTitleBlock } from '../TitleBlock';
import './ScreenHeader.css';

export interface DsScreenHeaderProps {
  /** Title shown in DsTitleBlock */
  title: string;
  /** Called when back button is clicked */
  onBack: () => void;
  /** Optional element rendered at trailing (right) position */
  trailing?: ReactNode;
  /** aria-label for the back button. Default: "Back" */
  backLabel?: string;
}

export function DsScreenHeader({
  title,
  onBack,
  trailing,
  backLabel = 'Back',
}: DsScreenHeaderProps): ReactNode {
  return (
    <header className="ds-screen-header" aria-label={title}>
      <button
        type="button"
        className="ds-screen-header__back"
        onClick={onBack}
        aria-label={backLabel}
      >
        <DsIcon name="back" size={22} aria-hidden />
      </button>

      <DsTitleBlock title={title} size="sm" />

      {trailing !== undefined ? (
        <span className="ds-screen-header__trailing" aria-hidden="true">
          {trailing}
        </span>
      ) : null}
    </header>
  );
}
