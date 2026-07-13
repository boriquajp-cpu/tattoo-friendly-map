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

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password) {
      setErrorMsg('メールアドレスとパスワードを入力してください。');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg('確認メールを送信しました。メールを確認してください。');
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '60px auto',
        padding: '32px',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        backgroundColor: '#fff',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}
    >
      <h1 style={{ fontSize: '22px', fontWeight: 700, textAlign: 'center', marginBottom: '24px' }}>
        {t('auth.loginTitle')}
      </h1>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* メールアドレス */}
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

        {/* パスワード */}
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
            autoComplete="current-password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* エラー / 成功メッセージ */}
        {errorMsg && (
          <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        )}
        {successMsg && (
          <p style={{ color: '#22c55e', fontSize: '13px', margin: 0 }}>{successMsg}</p>
        )}

        {/* ログインボタン */}
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
          {loading ? '処理中...' : t('auth.loginButton')}
        </button>
      </form>

      {/* 新規登録 */}
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleRegister}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            color: '#6366f1',
            cursor: 'pointer',
            fontSize: '14px',
            textDecoration: 'underline',
          }}
        >
          {t('auth.registerLink')}
        </button>
      </div>
    </div>
  );
}
