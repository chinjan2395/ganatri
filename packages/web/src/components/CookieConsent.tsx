import { useState } from 'react';
import { DsButton } from '@ganatri/ds';
import './CookieConsent.css';

const CONSENT_KEY = 'ganatri_consent_v1';

export function CookieConsent(): React.ReactNode {
  const [dismissed, setDismissed] = useState<boolean>(
    () => {
      try {
        const v = localStorage.getItem(CONSENT_KEY);
        return v === 'accepted' || v === 'declined';
      } catch {
        return true; // If localStorage is unavailable, hide the banner
      }
    },
  );

  if (dismissed) return null;

  function accept(): void {
    try { localStorage.setItem(CONSENT_KEY, 'accepted'); } catch { /* ignore */ }
    setDismissed(true);
  }

  function decline(): void {
    try { localStorage.setItem(CONSENT_KEY, 'declined'); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="cookie-consent" role="alertdialog" aria-label="Cookie consent">
      <p className="cookie-consent__text">
        We use cookies to keep your session and optional analytics to improve the game.
        You can decline analytics at any time.
      </p>
      <div className="cookie-consent__actions">
        <DsButton tone="primary" onClick={accept}>Accept</DsButton>
        <DsButton tone="secondary" onClick={decline}>Decline</DsButton>
      </div>
    </div>
  );
}
