import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { SupportedLang } from '../../types';

interface LayoutProps {
  children: ReactNode;
}

const LANGUAGES: { code: SupportedLang; label: string }[] = [
  { code: 'ja', label: '日本語' },
  { code: 'zh_tw', label: '繁體中文' },
  { code: 'en', label: 'English' },
];

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  textDecoration: 'none',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: isActive ? 600 : 400,
  color: isActive ? '#6366f1' : '#374151',
  backgroundColor: isActive ? '#e0e7ff' : 'transparent',
});

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const changeLanguage = (lang: SupportedLang) => {
    const i18nLang = lang === 'zh_tw' ? 'zh-TW' : lang;
    void i18n.changeLanguage(i18nLang);
  };

  const currentLang = (i18n.language === 'zh-TW' ? 'zh_tw' : i18n.language) as SupportedLang;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb' }}>
      {/* ヘッダー */}
      <header
        style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* ロゴ */}
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '16px',
            color: '#111827',
            padding: 0,
          }}
        >
          🗺️ Tattoo Map
        </button>

        {/* ナビゲーション */}
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <NavLink to="/" end style={navLinkStyle}>
            {t('nav.map')}
          </NavLink>
          <NavLink to="/list" style={navLinkStyle}>
            {t('nav.list')}
          </NavLink>
          {user ? (
            <>
              <NavLink to="/my-reports" style={navLinkStyle}>
                {t('nav.mypage')}
              </NavLink>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 400,
                  color: '#6b7280',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('auth.logoutButton')}
              </button>
            </>
          ) : (
            <NavLink to="/login" style={navLinkStyle}>
              {t('nav.login')}
            </NavLink>
          )}
        </nav>

        {/* 言語切り替え */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => changeLanguage(code)}
              style={{
                padding: '4px 8px',
                border: '1px solid',
                borderColor: currentLang === code ? '#6366f1' : '#d1d5db',
                borderRadius: '6px',
                backgroundColor: currentLang === code ? '#e0e7ff' : '#fff',
                color: currentLang === code ? '#3730a3' : '#374151',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: currentLang === code ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}
