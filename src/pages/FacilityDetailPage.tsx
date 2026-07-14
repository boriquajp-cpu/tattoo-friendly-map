import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import CorrectionModal from '../components/CorrectionModal/CorrectionModal';
import { useFavorites } from '../hooks/useFavorites';
import type { FacilityWithStats, Report, SummaryLabel } from '../types';

const SHARE_COLORS: Record<string, string> = {
  line: '#06C755',
  twitter: '#000',
  copy: '#6366f1',
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
  const [facility, setFacility] = useState<FacilityWithStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [{ data: f }, { data: r }] = await Promise.all([
        supabase.from('facilities').select('*, facility_stats(*)').eq('id', id).single(),
        supabase.from('reports').select('*').eq('facility_id', id).order('visit_date', { ascending: false }).limit(50),
      ]);
      if (f) {
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
            admitted_count: 0,
            conditional_count: 0,
            denied_count: 0,
            summary_label: f.facility_stats.summary_label as SummaryLabel,
            confidence: f.facility_stats.confidence_level ?? 'low',
            last_updated: f.facility_stats.last_updated,
          } : null,
        });
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

  const handleShare = async (platform: 'line' | 'twitter' | 'copy') => {
    const url = window.location.href;
    const text = `${facility?.name ?? ''} | Tattoo Map Japan`;
    if (platform === 'line') {
      window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // レポートから件数を計算
  const admittedCount = reports.filter((r) =>
    ['admitted', 'admitted_with_sticker', 'admitted_with_cover'].includes(r.result)
  ).length;
  const conditionalCount = reports.filter((r) =>
    ['admitted_with_sticker', 'admitted_with_cover'].includes(r.result)
  ).length;
  const deniedCount = reports.filter((r) => r.result === 'denied').length;

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
            style={{ background: 'none', border: 'none', fontSize: '26px', cursor: 'pointer', flexShrink: 0, padding: '2px', lineHeight: 1 }}
          >
            {isFavorite(facility.id) ? '❤️' : '🤍'}
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

      {/* 公式ポリシー */}
      {facility.official_policy && (
        <div
          style={{
            border: '1px solid #e5e7eb', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '20px', backgroundColor: '#f9fafb',
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
            {t('facility.officialPolicy')}
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>{facility.official_policy}</p>
        </div>
      )}

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
            backgroundColor: '#f97316', color: '#fff',
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
          {(['line', 'twitter', 'copy'] as const).map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => { void handleShare(platform); }}
              style={{
                padding: '7px 16px',
                backgroundColor: SHARE_COLORS[platform],
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {platform === 'line' && 'LINE'}
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
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
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
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {report.visit_date ?? report.created_at.slice(0, 10)}
                </span>
              </div>

              {report.comment && (
                <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>{report.comment}</p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
