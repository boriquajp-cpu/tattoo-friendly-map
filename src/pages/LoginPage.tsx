import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { c } from '../theme';

const GOOGLE_REDIRECT_NATIVE = 'com.tattoomapjapan.app://login-callback';

// Sign in with Apple はリプレイ攻撃対策として、認証リクエストに含めるnonceの
// ハッシュ値と、後段でSupabaseに渡す元のnonceを一致させる必要がある
// （Apple公式の推奨パターン。参照: Supabase Native Apple Sign-In docs）
function randomNonce(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => charset[v % charset.length]).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: `1px solid ${c.edge}`,
  borderRadius: '8px',
  fontSize: '16px',
  boxSizing: 'border-box',
};

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Googleログインはブラウザシート経由の非同期処理でセッションが確立するため、
  // ここでログイン完了を検知して画面遷移する（メール/パスワードはhandleLogin内で直接遷移）
  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resetMessages = () => { setErrorMsg(''); setSuccessMsg(''); };

  const handleGoogleLogin = async () => {
    const isNative = Capacitor.isNativePlatform();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: isNative ? GOOGLE_REDIRECT_NATIVE : window.location.origin,
        skipBrowserRedirect: isNative,
      },
    });
    // ネイティブではAuthContextのappUrlOpenリスナーがcom.tattoomapjapan.app://login-callback
    // を受け取ってセッション化する。ここではアプリ内シートでGoogleの認証画面を開くだけ。
    if (isNative && !error && data?.url) {
      await Browser.open({ url: data.url });
    }
  };

  const handleAppleLogin = async () => {
    resetMessages();
    try {
      const rawNonce = randomNonce();
      const hashedNonce = await sha256Hex(rawNonce);
      const { response } = await SignInWithApple.authorize({
        clientId: 'com.tattoomapjapan.app',
        redirectURI: `${window.location.origin}/login`,
        scopes: 'email name',
        nonce: hashedNonce,
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: response.identityToken,
        nonce: rawNonce,
      });
      if (error) setErrorMsg(error.message);
    } catch (err) {
      // ユーザーがApple側のシートをキャンセルした場合もここに来るため、
      // エラー表示はせず静かに終える
      console.error('Appleログインに失敗:', err);
    }
  };

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
      navigate('/');
    }
    setLoading(false);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px',
    border: 'none',
    borderBottom: active ? `2px solid ${c.ink}` : `2px solid ${c.edge}`,
    backgroundColor: 'transparent',
    color: active ? c.accent : c.muted,
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
          border: `1px solid ${c.edge}`,
          borderRadius: '16px',
          backgroundColor: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${c.edge}` }}>
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
            onClick={() => { void handleGoogleLogin(); }}
            style={{
              width: '100%', padding: '10px', marginBottom: '16px',
              border: `1px solid ${c.edge}`, borderRadius: '8px',
              backgroundColor: '#fff', color: c.inkSoft,
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.5 7.1 29 5 24 5c-7.5 0-14 4.1-17.7 9.7z"/><path fill="#4CAF50" d="M24 45c4.9 0 9.3-1.8 12.7-4.8l-6.2-5.2C28.7 36.3 26.5 37 24 37c-5.3 0-9.7-3.6-11.3-8.5l-6.5 5C9.7 40.5 16.4 45 24 45z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l.1-.1 6.2 5.2c-.4.4 6.6-4.8 6.6-13.7 0-1.3-.1-2.6-.4-3.9z"/></svg>
            {t('auth.googleLogin')}
          </button>

          {/* Sign in with Apple: Googleログイン等の第三者ログインを提供する場合、
              Apple Store審査ガイドライン4.8により、同等のプライバシー条件を満たす
              ログイン手段としてこれを併設することが必須（iOSのみ） */}
          {Capacitor.getPlatform() === 'ios' && (
            <button
              type="button"
              onClick={() => { void handleAppleLogin(); }}
              style={{
                width: '100%', padding: '10px', marginBottom: '16px',
                border: 'none', borderRadius: '8px',
                backgroundColor: '#000', color: '#fff',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M16.365 1.43c0 1.14-.463 2.267-1.194 3.093-.802.895-2.087 1.578-3.13 1.578-.116 0-.24-.02-.323-.03-.01-.083-.033-.27-.033-.46 0-1.09.542-2.234 1.208-2.972.808-.895 2.177-1.55 3.29-1.61.03.13.182.28.182.4zm4.343 15.05c-.61 1.4-.9 2.03-1.68 3.27-1.09 1.72-2.63 3.87-4.54 3.89-1.7.02-2.14-1.11-4.45-1.1-2.31.01-2.79 1.12-4.5 1.1-1.9-.02-3.35-1.95-4.44-3.67-3.04-4.79-3.37-10.41-1.48-13.4 1.34-2.13 3.46-3.38 5.45-3.38 2.02 0 3.3 1.11 4.97 1.11 1.62 0 2.62-1.11 4.97-1.11 1.77 0 3.65.96 4.99 2.63-4.39 2.41-3.68 8.68.69 10.66z"/></svg>
              {t('auth.appleLogin')}
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: c.edge }} />
            <span style={{ fontSize: '12px', color: c.muted }}>{t('auth.or')}</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: c.edge }} />
          </div>

          <form
            onSubmit={mode === 'login' ? handleLogin : handleRegister}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: c.inkSoft, marginBottom: '6px' }}
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
                style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: c.inkSoft, marginBottom: '6px' }}
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
                backgroundColor: loading ? c.muted : c.accent,
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
