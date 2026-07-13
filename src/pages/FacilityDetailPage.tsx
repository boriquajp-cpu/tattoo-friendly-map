import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FacilityWithStats, Report, SummaryLabel } from '../types';

const SUMMARY_BADGE_STYLE: Record<SummaryLabel, { bg: string; color: string }> = {
  high:        { bg: '#dcfce7', color: '#166534' },
  conditional: { bg: '#fef9c3', color: '#854d0e' },
  mixed:       { bg: '#ffedd5', color: '#9a3412' },
  low:         { bg: '#fee2e2', color: '#991b1b' },
  no_data:     { bg: '#f3f4f6', color: '#374151' },
};

// ダミーデータ（Supabase 接続前の表示確認用）
const DUMMY_FACILITY: FacilityWithStats = {
  id: '1',
  name: 'サンプル温泉 A',
  address: '台湾 台北市 中正区',
  category: 'onsen',
  latitude: 25.033,
  longitude: 121.565,
  country_code: 'TW',
  website_url: 'https://example.com',
  official_policy: '入れ墨・タトゥーをお持ちのお客様は入場できません。',
  created_at: '',
  updated_at: '',
  stats: {
    facility_id: '1',
    total_reports: 12,
    admitted_count: 9,
    conditional_count: 2,
    denied_count: 1,
    summary_label: 'high',
    confidence: 'high',
    last_updated: '',
  },
};

const DUMMY_REPORTS: Report[] = [
  {
    id: 'r1',
    facility_id: '1',
    user_id: null,
    result: 'admitted',
    tattoo_size: 'small',
    tattoo_locations: ['arm'],
    facility_response: 'nothing_asked',
    visit_date: '2026-06-15',
    comment: 'スタッフに何も言われず普通に入れました。',
    lang: 'ja',
    helpful_count: 5,
    created_at: '2026-06-15T10:00:00Z',
  },
  {
    id: 'r2',
    facility_id: '1',
    user_id: null,
    result: 'admitted_with_cover',
    tattoo_size: 'medium',
    tattoo_locations: ['back'],
    facility_response: 'verbal_check',
    visit_date: '2026-05-20',
    comment: 'カバーするよう口頭で言われましたが入れました。',
    lang: 'ja',
    helpful_count: 3,
    created_at: '2026-05-20T10:00:00Z',
  },
];

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [facility, setFacility] = useState<FacilityWithStats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    // TODO: Supabase から施設データ・報告を取得する
    // const { data } = await supabase.from('facilities').select('*, stats:facility_stats(*)').eq('id', id).single();
    setFacility(DUMMY_FACILITY);
    setReports(DUMMY_REPORTS);
    setLoading(false);
  }, [id]);

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
