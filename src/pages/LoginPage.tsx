import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resetMessages = () => { setErrorMsg(''); setSuccessMsg(''); };

  const switchMode = (next: Mode) => { setMode(next); resetMessages(); };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg(t('auth.emailRequired'));
      return;
    }
    setLoading(true);
    resetMessages();

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg(t('auth.confirmEmailSent'));
    }
    setLoading(false);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px',
    border: 'none',
    borderBottom: active ? '2px solid #6366f1' : '2px solid #e5e7eb',
    backgroundColor: 'transparent',
    color: active ? '#6366f1' : '#6b7280',
    fontWeight: active ? 700 : 400,
    fontSize: '14px',
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '60px auto',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          backgroundColor: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button type="button" style={tabStyle(mode === 'login')} onClick={() => switchMode('login')}>
            {t('auth.loginTitle')}
          </button>
          <button type="button" style={tabStyle(mode === 'register')} onClick={() => switchMode('register')}>
            {t('auth.registerTitle')}
          </button>
        </div>

        <div style={{ padding: '28px 24px' }}>
          {/* Googleログイン */}
          <button
            type="button"
            onClick={() => { void supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); }}
            style={{
              width: '100%', padding: '10px', marginBottom: '16px',
              border: '1px solid #d1d5db', borderRadius: '8px',
              backgroundColor: '#fff', color: '#374151',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5c-7.5 0-14 4.1-17.7 9.7z"/><path fill="#4CAF50" d="M24 45c4.9 0 9.3-1.8 12.7-4.8l-6.2-5.2C28.7 36.3 26.5 37 24 37c-5.3 0-9.7-3.6-11.3-8.5l-6.5 5C9.7 40.5 16.4 45 24 45z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l.1-.1 6.2 5.2c-.4.4 6.6-4.8 6.6-13.7 0-1.3-.1-2.6-.4-3.9z"/></svg>
            {t('auth.googleLogin')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{t('auth.or')}</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
          </div>

          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}
              >
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                style={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}
              >
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {errorMsg && (
              <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
            )}
            {successMsg && (
              <p style={{ color: '#22c55e', fontSize: '13px', margin: 0 }}>{successMsg}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '11px',
                backgroundColor: loading ? '#a5b4fc' : '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? t('auth.processing')
                : mode === 'login'
                ? t('auth.loginButton')
                : t('auth.registerButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
