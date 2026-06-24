import logo from '../assets/ganatri-logo.png';

interface AdminAuthPageProps {
  email: string;
  secret: string;
  error: string | null;
  loading: boolean;
  onEmailChange: (v: string) => void;
  onSecretChange: (v: string) => void;
  onSubmit: () => void;
}

export function AdminAuthPage({
  email,
  secret,
  error,
  loading,
  onEmailChange,
  onSecretChange,
  onSubmit,
}: AdminAuthPageProps) {
  return (
    <div className="admin-auth">
      <div className="admin-auth__brand">
        <img src={logo} alt="Ganatri" className="admin-auth__logo" />
        <p className="admin-auth__tagline">CAPTURE. CALCULATE. CONQUER.</p>
      </div>
      <div className="admin__card admin-auth__card">
        <h1 className="admin__title admin-auth__title">Admin Control Center</h1>
        <p className="admin__subtitle">
          Enter your admin credentials to access the control panel.
        </p>
        <input
          className="admin__input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          disabled={loading}
          autoFocus
        />
        <input
          className="admin__input"
          type="password"
          placeholder="Admin secret (leave blank if not configured)"
          value={secret}
          onChange={e => onSecretChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          disabled={loading}
        />
        {error && <p className="admin__error">{error}</p>}
        <button
          type="button"
          className="admin__btn"
          onClick={onSubmit}
          disabled={loading || !email.trim()}
        >
          {loading ? 'Verifying…' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}
