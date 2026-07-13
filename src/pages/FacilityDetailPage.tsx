import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { FacilityWithStats, Report, SummaryLabel } from '../types';

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

  const [facility, setFacility] = useState<FacilityWithStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const [{ data: f }, { data: r }] = await Promise.all([
        supabase.from('facilities').select('*, facility_stats(*)').eq('id', id).single(),
        supabase.from('reports').select('*').eq('facility_id', id).order('visit_date', { ascending: false }).limit(20),
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
          background: 'none',
          border: 'none',
          color: '#6366f1',
          cursor: 'pointer',
          fontSize: '14px',
          marginBottom: '12px',
          padding: 0,
        }}
      >
        ← 戻る
      </button>

      {/* 施設ヘッダー */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
          {t(`facility.categories.${facility.category}`)}
        </p>
        <h1 style={{ margin: '4px 0', fontSize: '22px', fontWeight: 700 }}>{facility.name}</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>{facility.address}</p>
      </div>

      {/* 集計結果 */}
      <div
        style={{
          backgroundColor: bg,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '4px 14px',
              borderRadius: '9999px',
              backgroundColor: color,
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
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
        </div>

        {/* 件数内訳 */}
        {stats && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '13px', flexWrap: 'wrap' }}>
            <span>入場可 {stats.admitted_count}件</span>
            <span>条件付 {stats.conditional_count}件</span>
            <span>拒否 {stats.denied_count}件</span>
          </div>
        )}
      </div>

      {/* 公式ポリシー */}
      {facility.official_policy && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            backgroundColor: '#f9fafb',
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>公式ポリシー</p>
          <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>{facility.official_policy}</p>
        </div>
      )}

      {/* 予約リンク */}
      {facility.website_url && (
        <div style={{ marginBottom: '20px' }}>
          <a
            href={facility.website_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#6366f1',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {t('facility.bookingLinks.official')}
          </a>
        </div>
      )}

      {/* 報告投稿ボタン */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          to={`/facility/${facility.id}/report`}
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#f97316',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {t('report.title')}
        </Link>
      </div>

      {/* 報告一覧 */}
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>報告一覧</h2>
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
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '14px 16px',
                backgroundColor: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
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

              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                参考になった {report.helpful_count}件
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
