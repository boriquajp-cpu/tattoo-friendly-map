import { useState, useEffect, type ReactNode } from 'react';
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

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 680);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const changeLanguage = (lang: SupportedLang) => {
    const i18nLang = lang === 'zh_tw' ? 'zh-TW' : lang;
    void i18n.changeLanguage(i18nLang);
    setMenuOpen(false);
  };

  const currentLang = (i18n.language === 'zh-TW' ? 'zh_tw' : i18n.language) as SupportedLang;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setMenuOpen(false);
  };

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    textDecoration: 'none',
    padding: isMobile ? '10px 16px' : '6px 12px',
    borderRadius: '6px',
    fontSize: isMobile ? '15px' : '14px',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#6366f1' : '#374151',
    backgroundColor: isActive ? '#e0e7ff' : 'transparent',
    display: 'block',
  });

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
          zIndex: 200,
        }}
      >
        {/* ロゴ */}
        <button
          type="button"
          onClick={() => { navigate('/'); setMenuOpen(false); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '16px', color: '#111827', padding: 0,
          }}
        >
          🗺️ Tattoo Map
        </button>

        {isMobile ? (
          /* ---- モバイル: ハンバーガーボタン ---- */
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '22px', color: '#374151', padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        ) : (
          /* ---- PC: 通常ナビ ---- */
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <NavLink to="/" end style={navLinkStyle}>{t('nav.map')}</NavLink>
            <NavLink to="/list" style={navLinkStyle}>{t('nav.list')}</NavLink>
            {user ? (
              <>
                <NavLink to="/my-reports" style={navLinkStyle}>{t('nav.mypage')}</NavLink>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '14px',
                    color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  {t('auth.logoutButton')}
                </button>
              </>
            ) : (
              <NavLink to="/login" style={navLinkStyle}>{t('nav.login')}</NavLink>
            )}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => changeLanguage(code)}
                  style={{
                    padding: '4px 8px', border: '1px solid',
                    borderColor: currentLang === code ? '#6366f1' : '#d1d5db',
                    borderRadius: '6px',
                    backgroundColor: currentLang === code ? '#e0e7ff' : '#fff',
                    color: currentLang === code ? '#3730a3' : '#374151',
                    cursor: 'pointer', fontSize: '11px',
                    fontWeight: currentLang === code ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* モバイルドロワーメニュー */}
      {isMobile && menuOpen && (
        <>
          {/* オーバーレイ */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: '56px 0 0 0',
              backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 150,
            }}
          />
          {/* メニュー本体 */}
          <div
            style={{
              position: 'fixed', top: '56px', left: 0, right: 0,
              backgroundColor: '#fff',
              borderBottom: '1px solid #e5e7eb',
              zIndex: 160, padding: '8px 16px 16px',
            }}
          >
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
              <NavLink to="/" end style={navLinkStyle} onClick={() => setMenuOpen(false)}>{t('nav.map')}</NavLink>
              <NavLink to="/list" style={navLinkStyle} onClick={() => setMenuOpen(false)}>{t('nav.list')}</NavLink>
              {user ? (
                <>
                  <NavLink to="/my-reports" style={navLinkStyle} onClick={() => setMenuOpen(false)}>{t('nav.mypage')}</NavLink>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    style={{
                      padding: '10px 16px', borderRadius: '6px', fontSize: '15px',
                      color: '#6b7280', background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {t('auth.logoutButton')}
                  </button>
                </>
              ) : (
                <NavLink to="/login" style={navLinkStyle} onClick={() => setMenuOpen(false)}>{t('nav.login')}</NavLink>
              )}
            </nav>

            {/* 言語切り替え */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => changeLanguage(code)}
                  style={{
                    flex: 1, padding: '8px 4px',
                    border: '1px solid',
                    borderColor: currentLang === code ? '#6366f1' : '#d1d5db',
                    borderRadius: '8px',
                    backgroundColor: currentLang === code ? '#e0e7ff' : '#fff',
                    color: currentLang === code ? '#3730a3' : '#374151',
                    cursor: 'pointer', fontSize: '13px',
                    fontWeight: currentLang === code ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* メインコンテンツ */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}
