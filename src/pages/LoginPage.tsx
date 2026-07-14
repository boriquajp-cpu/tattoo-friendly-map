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
