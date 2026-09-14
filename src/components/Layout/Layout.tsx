import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { c } from '../../theme';
import type { SupportedLang } from '../../types';

interface LayoutProps {
  children: ReactNode;
}

const LANGUAGES: { code: SupportedLang; label: string }[] = [
  { code: 'ja', label: '日本語' },
  { code: 'zh_tw', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
];

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  usePushNotifications();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 680);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const changeLanguage = (lang: SupportedLang) => {
    const i18nLang = lang === 'zh_tw' ? 'zh-TW' : lang as string;
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
    color: isActive ? c.ink : c.inkSoft,
    backgroundColor: isActive ? c.accentSoft : 'transparent',
    display: 'block',
  });

  const tabBarLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    padding: '6px 0',
    textDecoration: 'none',
    fontSize: '11px',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? c.ink : c.muted,
  });

  const langButtonStyle = (active: boolean, mobile: boolean): React.CSSProperties => ({
    ...(mobile ? { flex: 1, padding: '8px 4px', fontSize: '13px' } : { padding: '4px 8px', fontSize: '11px' }),
    border: '1px solid',
    borderColor: active ? c.ink : c.edge,
    borderRadius: mobile ? '8px' : '6px',
    backgroundColor: active ? c.accentSoft : c.surface,
    color: active ? c.ink : c.inkSoft,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh', backgroundColor: c.bg }}>
      {/* ヘッダー */}
      <header
        style={{
          backgroundColor: c.surface,
          borderBottom: `1px solid ${c.edge}`,
          padding: '0 16px',
          paddingTop: 'env(safe-area-inset-top)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 'calc(56px + env(safe-area-inset-top))',
          boxSizing: 'border-box',
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
            fontWeight: 700, fontSize: '16px', color: c.ink, padding: 0,
            letterSpacing: '-0.01em',
          }}
        >
          🗺️ Tattour
        </button>

        {isMobile ? (
          /* ---- モバイル: ハンバーガーボタン ---- */
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '22px', color: c.inkSoft, padding: '4px 8px',
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
                {isAdmin && <NavLink to="/admin" style={navLinkStyle}>{t('nav.admin')}</NavLink>}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '14px',
                    color: c.muted, background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  {t('auth.logoutButton')}
                </button>
              </>
            ) : (
              <NavLink to="/login" style={navLinkStyle}>{t('nav.login')}</NavLink>
            )}
            <a
              href="mailto:tattoomapjapan.dev@gmail.com"
              style={{
                textDecoration: 'none', padding: '6px 12px', borderRadius: '6px',
                fontSize: '14px', color: c.muted,
              }}
            >
              {t('nav.contact')}
            </a>
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => changeLanguage(code)}
                  style={langButtonStyle(currentLang === code, false)}
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
              position: 'fixed', inset: 'calc(56px + env(safe-area-inset-top)) 0 0 0',
              backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 150,
            }}
          />
          {/* メニュー本体 */}
          <div
            style={{
              position: 'fixed', top: 'calc(56px + env(safe-area-inset-top))', left: 0, right: 0,
              backgroundColor: c.surface,
              borderBottom: `1px solid ${c.edge}`,
              zIndex: 160, padding: '8px 16px 16px',
            }}
          >
            {/* マップ・一覧・マイページ／ログインは下部タブバーに集約したため、
                ここには頻度の低い項目（管理・ログアウト・お問い合わせ）のみ残す */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
              {isAdmin && <NavLink to="/admin" style={navLinkStyle} onClick={() => setMenuOpen(false)}>{t('nav.admin')}</NavLink>}
              {user && (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  style={{
                    padding: '10px 16px', borderRadius: '6px', fontSize: '15px',
                    color: c.muted, background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {t('auth.logoutButton')}
                </button>
              )}
              <a
                href="mailto:tattoomapjapan.dev@gmail.com"
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: '10px 16px', borderRadius: '6px', fontSize: '15px',
                  color: c.muted, textDecoration: 'none',
                }}
              >
                {t('nav.contact')}
              </a>
            </nav>

            {/* 言語切り替え */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => changeLanguage(code)}
                  style={langButtonStyle(currentLang === code, true)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* メインコンテンツ */}
      <main
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
          paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom))' : 0,
        }}
      >
        {children}
      </main>

      {/* モバイル: 下部タブバー（主要ナビゲーション） */}
      {isMobile && (
        <nav
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            display: 'flex', backgroundColor: c.surface,
            borderTop: `1px solid ${c.edge}`, zIndex: 200,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <NavLink to="/" end style={tabBarLinkStyle}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>🗺️</span>
            {t('nav.map')}
          </NavLink>
          <NavLink to="/list" style={tabBarLinkStyle}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>📋</span>
            {t('nav.list')}
          </NavLink>
          <NavLink to={user ? '/my-reports' : '/login'} style={tabBarLinkStyle}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>👤</span>
            {user ? t('nav.mypage') : t('nav.login')}
          </NavLink>
        </nav>
      )}
    </div>
  );
}
