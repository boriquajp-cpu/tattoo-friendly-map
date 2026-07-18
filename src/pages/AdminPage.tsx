import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FacilityRequestRow {
  id: string;
  name_ja: string;
  address_ja: string;
  category: string;
  official_url: string | null;
  message: string | null;
  created_at: string;
}

interface ReportRow {
  id: string;
  facility_id: string;
  result: string;
  comment_original: string | null;
  visit_date: string;
  flagged: boolean;
  created_at: string;
  facilities: { name_ja: string } | null;
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '14px 16px',
  backgroundColor: '#fff',
  marginBottom: '12px',
};

const buttonStyle = (color: string): React.CSSProperties => ({
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  color: '#fff',
  backgroundColor: color,
});

export default function AdminPage() {
  const { t } = useTranslation();
  const { user, isAdmin, loading: authLoading, roleLoading } = useAuth();

  const [requests, setRequests] = useState<FacilityRequestRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [flagCounts, setFlagCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [requestSearch, setRequestSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const PAGE_SIZE = 30;
  const [visibleRequestCount, setVisibleRequestCount] = useState(PAGE_SIZE);
  const [visibleReportCount, setVisibleReportCount] = useState(PAGE_SIZE);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const reportColumns = 'id, facility_id, result, comment_original, visit_date, flagged, created_at, facilities(name_ja)';
    const [{ data: reqData }, { data: flaggedRepData }, { data: recentRepData }, { data: flagData }] = await Promise.all([
      // 上限を設けると、超過分が管理者から見えないまま埋もれてしまうため無制限に取得する
      supabase
        .from('facility_requests')
        .select('id, name_ja, address_ja, category, official_url, message, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      // フラグ済みは古いものが一覧から取りこぼされないよう、上限なしで全件取得
      supabase
        .from('reports')
        .select(reportColumns)
        .eq('flagged', true)
        .order('created_at', { ascending: false }),
      // 未フラグは直近100件のみ（新規の通報候補をブラウズする用途）
      supabase
        .from('reports')
        .select(reportColumns)
        .eq('flagged', false)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('report_flags').select('report_id'),
    ]);
    setRequests(reqData ?? []);
    const merged = [...(flaggedRepData ?? []), ...(recentRepData ?? [])] as unknown as ReportRow[];
    setReports(merged);
    const counts: Record<string, number> = {};
    for (const row of flagData ?? []) {
      counts[row.report_id] = (counts[row.report_id] ?? 0) + 1;
    }
    setFlagCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void fetchData();
  }, [isAdmin, fetchData]);

  const handleRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    await supabase.from('facility_requests').update({ status }).eq('id', id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggleFlag = async (report: ReportRow) => {
    const nextFlagged = !report.flagged;
    await supabase.from('reports').update({ flagged: nextFlagged }).eq('id', report.id);
    setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, flagged: nextFlagged } : r)));
  };

  if (authLoading || roleLoading || (isAdmin && loading)) {
    return <p style={{ padding: '32px', textAlign: 'center' }}>{t('common.loading')}</p>;
  }

  if (!user) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <p>{t('admin.loginRequired')}</p>
        <Link to="/login" style={{ color: '#6366f1' }}>{t('nav.login')}</Link>
      </div>
    );
  }

  if (!isAdmin) {
    return <p style={{ padding: '32px', textAlign: 'center' }}>{t('admin.noPermission')}</p>;
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box',
  };

  const filteredRequests = requests.filter((req) =>
    requestSearch === '' || req.name_ja.toLowerCase().includes(requestSearch.toLowerCase())
  );
  const filteredReports = reports.filter((rep) =>
    reportSearch === '' || (rep.facilities?.name_ja ?? '').toLowerCase().includes(reportSearch.toLowerCase())
  );
  const visibleRequests = filteredRequests.slice(0, visibleRequestCount);
  const sortedReports = [...filteredReports].sort((a, b) => (flagCounts[b.id] ?? 0) - (flagCounts[a.id] ?? 0));
  const visibleReports = sortedReports.slice(0, visibleReportCount);

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>{t('admin.title')}</h1>

      {/* 施設リクエスト・修正報告 */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
        {t('admin.facilityRequests')} ({filteredRequests.length}{requestSearch ? ` / ${requests.length}` : ''})
      </h2>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
        {t('admin.facilityRequestsHint')}
      </p>
      {requests.length > 0 && (
        <input
          type="text"
          value={requestSearch}
          onChange={(e) => { setRequestSearch(e.target.value); setVisibleRequestCount(PAGE_SIZE); }}
          placeholder={t('admin.searchByName')}
          style={searchInputStyle}
        />
      )}
      {requests.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>{t('admin.noPendingRequests')}</p>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          {visibleRequests.map((req) => {
            const isCorrection = req.name_ja.startsWith('[修正報告]');
            return (
              <div key={req.id} style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                        backgroundColor: isCorrection ? '#fef9c3' : '#e0e7ff',
                        color: isCorrection ? '#854d0e' : '#3730a3',
                        marginRight: '8px',
                      }}
                    >
                      {isCorrection ? t('admin.typeCorrection') : t('admin.typeNewFacility')}
                    </span>
                    <strong style={{ fontSize: '14px' }}>{req.name_ja}</strong>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{req.created_at.slice(0, 10)}</span>
                </div>
                {isCorrection ? (
                  <p style={{ margin: '8px 0 4px', fontSize: '13px' }}>
                    <Link to={`/facility/${req.address_ja}`} target="_blank" style={{ color: '#6366f1' }}>
                      {t('admin.viewTargetFacility')} →
                    </Link>
                  </p>
                ) : (
                  <p style={{ margin: '8px 0 4px', fontSize: '13px', color: '#374151' }}>
                    {t('admin.address')}: {req.address_ja}
                  </p>
                )}
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#374151' }}>
                  {t('admin.category')}: {t(`facility.categories.${req.category}`)}
                </p>
                {req.official_url && (
                  <p style={{ margin: '0 0 4px', fontSize: '13px' }}>
                    <a href={req.official_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                      {req.official_url}
                    </a>
                  </p>
                )}
                {req.message && (
                  <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                    {req.message}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => { void handleRequestStatus(req.id, 'approved'); }} style={buttonStyle('#16a34a')}>
                    {t('admin.approve')}
                  </button>
                  <button type="button" onClick={() => { void handleRequestStatus(req.id, 'rejected'); }} style={buttonStyle('#dc2626')}>
                    {t('admin.reject')}
                  </button>
                </div>
              </div>
            );
          })}
          {filteredRequests.length > visibleRequestCount && (
            <button
              type="button"
              onClick={() => setVisibleRequestCount((c) => c + PAGE_SIZE)}
              style={{
                width: '100%', padding: '10px', backgroundColor: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('admin.showMore')}
            </button>
          )}
        </div>
      )}

      {/* 報告管理（フラグ操作） */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>
        {t('admin.reportsManagement')} ({filteredReports.length}{reportSearch ? ` / ${reports.length}` : ''})
      </h2>
      <input
        type="text"
        value={reportSearch}
        onChange={(e) => { setReportSearch(e.target.value); setVisibleReportCount(PAGE_SIZE); }}
        placeholder={t('admin.searchByName')}
        style={searchInputStyle}
      />
      <div>
        {visibleReports.map((rep) => (
          <div
            key={rep.id}
            style={{
              ...sectionStyle,
              backgroundColor: rep.flagged ? '#fef2f2' : '#fff',
              borderColor: rep.flagged ? '#fecaca' : '#e5e7eb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: '14px' }}>{rep.facilities?.name_ja ?? '—'}</strong>
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>
                  {t(`report.result.${rep.result}`)}
                </span>
                {(flagCounts[rep.id] ?? 0) > 0 && (
                  <span
                    style={{
                      marginLeft: '8px', fontSize: '11px', fontWeight: 700,
                      padding: '2px 8px', borderRadius: '9999px',
                      backgroundColor: '#fee2e2', color: '#991b1b',
                    }}
                  >
                    🚩 {t('admin.flagCount', { count: flagCounts[rep.id] })}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{rep.visit_date}</span>
            </div>
            {rep.comment_original && (
              <p style={{ margin: '8px 0', fontSize: '13px', color: '#374151' }}>{rep.comment_original}</p>
            )}
            <button
              type="button"
              onClick={() => { void handleToggleFlag(rep); }}
              style={buttonStyle(rep.flagged ? '#16a34a' : '#dc2626')}
            >
              {rep.flagged ? t('admin.unflag') : t('admin.flag')}
            </button>
          </div>
        ))}
        {filteredReports.length > visibleReportCount && (
          <button
            type="button"
            onClick={() => setVisibleReportCount((c) => c + PAGE_SIZE)}
            style={{
              width: '100%', padding: '10px', backgroundColor: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('admin.showMore')}
          </button>
        )}
      </div>
    </div>
  );
}
