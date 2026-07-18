import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { translateComment } from '../lib/claudeApi';
import { translateFacilities } from '../lib/facilityTranslation';
import CorrectionModal from '../components/CorrectionModal/CorrectionModal';
import ReportFlagModal from '../components/ReportFlagModal/ReportFlagModal';
import HeartIcon from '../components/HeartIcon/HeartIcon';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import type { FacilityWithStats, Report, SummaryLabel, SupportedLang } from '../types';

const SHARE_COLORS: Record<string, string> = {
  line: '#06C755',
  facebook: '#1877F2',
  twitter: '#000',
  copy: '#6366f1',
};

// WCAG AA(4.5:1)を満たすため、明るい背景色のボタンは濃色テキストにする
const SHARE_TEXT_COLORS: Record<string, string> = {
  line: '#111827',
  facebook: '#111827',
  twitter: '#fff',
  copy: '#fff',
};

const SUMMARY_BADGE_STYLE: Record<SummaryLabel, { bg: string; color: string }> = {
  high:        { bg: '#dcfce7', color: '#166534' },
  conditional: { bg: '#fef9c3', color: '#854d0e' },
  mixed:       { bg: '#ffedd5', color: '#9a3412' },
  low:         { bg: '#fee2e2', color: '#991b1b' },
  no_data:     { bg: '#f3f4f6', color: '#374151' },
};

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const { isFavorite, toggle } = useFavorites();
  const { addItem } = useRecentlyViewed();
  const [facility, setFacility] = useState<FacilityWithStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [flaggingReportId, setFlaggingReportId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [showTranslated, setShowTranslated] = useState<Record<string, boolean>>({});

  const currentLang = (i18n.language === 'zh-TW' ? 'zh_tw' : i18n.language) as SupportedLang;

  const handleTranslate = async (report: Report) => {
    if (translations[report.id]) {
      setShowTranslated((prev) => ({ ...prev, [report.id]: !prev[report.id] }));
      return;
    }
    setTranslatingIds((prev) => new Set(prev).add(report.id));
    const result = await translateComment(report.id, currentLang, report.comment ?? '');
    setTranslations((prev) => ({ ...prev, [report.id]: result }));
    setShowTranslated((prev) => ({ ...prev, [report.id]: true }));
    setTranslatingIds((prev) => {
      const next = new Set(prev);
      next.delete(report.id);
      return next;
    });
  };

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [{ data: f }, { data: r }] = await Promise.all([
        supabase.from('facilities').select('*, facility_stats(*)').eq('id', id).single(),
        supabase.from('reports').select('*').eq('facility_id', id).order('visit_date', { ascending: false }).limit(50),
      ]);
      if (f) {
        addItem({
          id: f.id,
          name: i18n.language === 'zh-TW' ? (f.name_zh_tw ?? f.name_ja) : f.name_ja,
          category: f.category,
          summary_label: f.facility_stats?.summary_label ?? 'no_data',
        });
        const lang = i18n.language === 'zh-TW' ? 'zh_tw' : 'ja';
        setFacility({
          id: f.id,
          name: lang === 'zh_tw' ? f.name_zh_tw : f.name_ja,
          address: lang === 'zh_tw' ? f.address_zh_tw : f.address_ja,
          category: f.category,
          latitude: f.lat,
          longitude: f.lng,
          website_url: f.official_url ?? undefined,
          phone: f.phone ?? undefined,
          country_code: 'JP',
          created_at: f.created_at,
          updated_at: f.updated_at,
          stats: f.facility_stats ? {
            facility_id: f.facility_stats.facility_id,
            total_reports: f.facility_stats.report_count_12mo,
            admitted_count: f.facility_stats.admitted_count ?? 0,
            conditional_count: f.facility_stats.conditional_count ?? 0,
            denied_count: f.facility_stats.denied_count ?? 0,
            summary_label: f.facility_stats.summary_label as SummaryLabel,
            confidence: f.facility_stats.confidence_level ?? 'low',
            last_updated: f.facility_stats.last_updated,
          } : null,
        });

        // 英語・韓国語は facilities テーブルに専用列がないため、Claude 翻訳で補う
        if (i18n.language === 'en' || i18n.language === 'ko') {
          const targetLang = i18n.language as 'en' | 'ko';
          const translations = await translateFacilities([f.id], targetLang);
          if (translations[f.id]) {
            setFacility((prev) => prev ? { ...prev, name: translations[f.id].name, address: translations[f.id].address } : prev);
          }
        }
      }
      if (r) {
        setReports(r.map((rep) => ({
          id: rep.id,
          facility_id: rep.facility_id,
          user_id: rep.user_id,
          result: rep.result,
          tattoo_size: rep.tattoo_size,
          tattoo_locations: rep.tattoo_location ?? [],
          facility_response: rep.facility_response,
          visit_date: rep.visit_date,
          comment: rep.comment_original,
          lang: rep.comment_lang ?? 'ja',
          helpful_count: 0,
          created_at: rep.created_at,
        })));
      }
      setLoading(false);
    };
    void fetch();
  }, [id, i18n.language]);

  if (loading) {
    return <p style={{ padding: '32px', textAlign: 'center' }}>{t('common.loading')}</p>;
  }

  if (!facility) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <p>{t('common.error')}</p>
        <button type="button" onClick={() => navigate(-1)}>{t('common.retry')}</button>
      </div>
    );
  }

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleShare = async (platform: 'line' | 'facebook' | 'twitter' | 'copy') => {
    const url = window.location.href;
    const text = `${facility?.name ?? ''} | Tattoo Map Japan`;
    if (platform === 'line') {
      window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    const url = window.location.href;
    const text = `${facility?.name ?? ''} | Tattoo Map Japan`;
    try {
      await navigator.share({ title: text, url });
    } catch {
      /* ユーザーによるキャンセル等は無視 */
    }
  };

  // 内訳件数はサーバー側の12ヶ月集計（facility_stats）を使用する。
  // reports は直近50件までしか取得しないため、件数の多い施設ではクライアント集計が
  // 「N件の報告」バッジと食い違ってしまうのを避けるため。
  const admittedCount = facility.stats?.admitted_count ?? 0;
  const conditionalCount = facility.stats?.conditional_count ?? 0;
  const deniedCount = facility.stats?.denied_count ?? 0;

  const stats = facility.stats;
  const summaryLabel: SummaryLabel = stats?.summary_label ?? 'no_data';
  const { bg, color } = SUMMARY_BADGE_STYLE[summaryLabel];

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px' }}>
      {/* 戻るボタン */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          background: 'none', border: 'none', color: '#6366f1',
          cursor: 'pointer', fontSize: '14px', marginBottom: '12px', padding: 0,
        }}
      >
        ← {t('common.back')}
      </button>

      {/* 施設ヘッダー */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
          {t(`facility.categories.${facility.category}`)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ margin: '4px 0', fontSize: '22px', fontWeight: 700, flex: 1 }}>{facility.name}</h1>
          <button
            type="button"
            onClick={() => toggle(facility.id)}
            title={t('common.favorite')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <HeartIcon filled={isFavorite(facility.id)} color={isFavorite(facility.id) ? '#ef4444' : '#6b7280'} size={26} />
          </button>
        </div>
        <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '14px' }}>{facility.address}</p>

        {/* ② ナビボタン */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${facility.latitude},${facility.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px',
              backgroundColor: '#fff', border: '1px solid #d1d5db',
              color: '#374151', textDecoration: 'none', fontSize: '13px', fontWeight: 600,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            🗺️ {t('facility.navigateGoogle')}
          </a>
          <a
            href={`https://maps.apple.com/?ll=${facility.latitude},${facility.longitude}&q=${encodeURIComponent(facility.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px',
              backgroundColor: '#fff', border: '1px solid #d1d5db',
              color: '#374151', textDecoration: 'none', fontSize: '13px', fontWeight: 600,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            🍎 {t('facility.navigateApple')}
          </a>
        </div>
      </div>

      {/* 集計結果 */}
      <div style={{ backgroundColor: bg, borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '4px 14px', borderRadius: '9999px',
              backgroundColor: color, color: '#fff', fontWeight: 700, fontSize: '14px',
            }}
          >
            {t(`facility.summaryLabel.${summaryLabel}`)}
          </span>
          {stats && (
            <span style={{ fontSize: '13px', color: '#374151' }}>
              {t('facility.reportCount', { count: stats.total_reports })}
            </span>
          )}
          {stats?.confidence && (
            <span style={{ fontSize: '13px', color: '#374151' }}>
              {t(`facility.confidence.${stats.confidence}`)}
            </span>
          )}
          {stats?.last_updated && (
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              {t('facility.lastUpdated')}：{new Date(stats.last_updated).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* 件数内訳（レポートから計算） */}
        {reports.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '13px', flexWrap: 'wrap' }}>
            <span style={{ color: '#166534' }}>✓ {t('facility.admittedCount', { count: admittedCount })}</span>
            <span style={{ color: '#854d0e' }}>◎ {t('facility.conditionalCount', { count: conditionalCount })}</span>
            <span style={{ color: '#991b1b' }}>✕ {t('facility.deniedCount', { count: deniedCount })}</span>
          </div>
        )}
      </div>

      {/* 公式サイト */}
      {facility.website_url && (
        <div style={{ marginBottom: '20px' }}>
          <a
            href={facility.website_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', padding: '8px 16px',
              backgroundColor: '#6366f1', color: '#fff',
              borderRadius: '8px', textDecoration: 'none',
              fontSize: '14px', fontWeight: 500,
            }}
          >
            {t('facility.bookingLinks.official')}
          </a>
        </div>
      )}

      {/* 報告投稿ボタン＋情報修正ボタン */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <Link
          to={`/facility/${facility.id}/report`}
          style={{
            display: 'inline-block', padding: '10px 20px',
            backgroundColor: '#f97316', color: '#111827',
            borderRadius: '8px', textDecoration: 'none',
            fontSize: '14px', fontWeight: 600,
          }}
        >
          {t('report.title')}
        </Link>
        <button
          type="button"
          onClick={() => setShowCorrection(true)}
          style={{
            padding: '10px 18px',
            backgroundColor: '#fff', color: '#374151',
            border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✏️ {t('facility.correctInfo')}
        </button>
      </div>

      {/* ⑩ SNSシェア */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>{t('facility.share')}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canNativeShare && (
            <button
              type="button"
              onClick={() => { void handleNativeShare(); }}
              style={{
                padding: '7px 16px',
                backgroundColor: '#374151',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📤 {t('facility.shareNative')}
            </button>
          )}
          {(['line', 'facebook', 'twitter', 'copy'] as const).map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => { void handleShare(platform); }}
              style={{
                padding: '7px 16px',
                backgroundColor: SHARE_COLORS[platform],
                color: SHARE_TEXT_COLORS[platform],
                border: 'none',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {platform === 'line' && 'LINE'}
              {platform === 'facebook' && 'Facebook'}
              {platform === 'twitter' && '𝕏 Twitter'}
              {platform === 'copy' && (copied ? t('facility.shareCopied') : t('facility.shareCopyLink'))}
            </button>
          ))}
        </div>
      </div>

      {/* ③ 情報修正モーダル */}
      {showCorrection && (
        <CorrectionModal
          facilityId={facility.id}
          facilityName={facility.name}
          facilityCategory={facility.category}
          onClose={() => setShowCorrection(false)}
        />
      )}

      {/* 報告一覧 */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
        {t('facility.reportList')}
      </h2>
      {reports.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>
          {t('facility.noReports')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reports.map((report) => (
            <div
              key={report.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: '10px',
                padding: '14px 16px', backgroundColor: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '12px', fontWeight: 600,
                    padding: '2px 8px', borderRadius: '4px',
                    backgroundColor: '#e0e7ff', color: '#3730a3',
                  }}
                >
                  {t(`report.result.${report.result}`)}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {report.visit_date ?? report.created_at.slice(0, 10)}
                </span>
              </div>

              {report.comment && (
                <>
                  <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
                    {showTranslated[report.id] ? translations[report.id] : report.comment}
                  </p>
                  {report.lang !== currentLang && (
                    <button
                      type="button"
                      onClick={() => { void handleTranslate(report); }}
                      disabled={translatingIds.has(report.id)}
                      style={{
                        marginTop: '6px', background: 'none', border: 'none',
                        color: '#6366f1', fontSize: '12px', fontWeight: 600,
                        cursor: translatingIds.has(report.id) ? 'default' : 'pointer', padding: 0,
                      }}
                    >
                      {translatingIds.has(report.id)
                        ? t('report.translating')
                        : showTranslated[report.id]
                          ? t('report.viewOriginal')
                          : t('report.viewTranslation')}
                    </button>
                  )}
                </>
              )}

              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#6b7280' }}>
                {report.tattoo_size && <span>{t(`report.tattooSize.${report.tattoo_size}`)}</span>}
                {report.tattoo_locations?.map((loc) => (
                  <span key={loc}>{t(`report.tattooLocation.${loc}`)}</span>
                ))}
                {report.facility_response && (
                  <span>{t(`report.facilityResponse.${report.facility_response}`)}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setFlaggingReportId(report.id)}
                style={{
                  marginTop: '8px', background: 'none', border: 'none',
                  color: '#6b7280', fontSize: '12px', cursor: 'pointer', padding: 0,
                }}
              >
                🚩 {t('reportFlag.reportButton')}
              </button>
            </div>
          ))}
        </div>
      )}

      {flaggingReportId && (
        <ReportFlagModal reportId={flaggingReportId} onClose={() => setFlaggingReportId(null)} />
      )}
    </div>
  );
}
