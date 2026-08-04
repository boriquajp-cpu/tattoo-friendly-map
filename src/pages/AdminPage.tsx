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

interface OfficialResponseRow {
  id: string;
  submitted_name_ja: string;
  submitted_address_ja: string;
  category: string;
  policy: string;
  conditions: string[];
  guidance_text: string | null;
  official_url: string | null;
  wants_listed: boolean;
  created_at: string;
}

interface FacilityOption {
  id: string;
  name_ja: string;
  address_ja: string;
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
  const [officialResponses, setOfficialResponses] = useState<OfficialResponseRow[]>([]);
  const [facilityOptions, setFacilityOptions] = useState<FacilityOption[]>([]);
  const [facilityMatchQuery, setFacilityMatchQuery] = useState<Record<string, string>>({});
  const [selectedFacilityId, setSelectedFacilityId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [requestSearch, setRequestSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const PAGE_SIZE = 30;
  const [visibleRequestCount, setVisibleRequestCount] = useState(PAGE_SIZE);
  const [visibleReportCount, setVisibleReportCount] = useState(PAGE_SIZE);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const reportColumns = 'id, facility_id, result, comment_original, visit_date, flagged, created_at, facilities(name_ja)';
    const [{ data: reqData }, { data: flaggedRepData }, { data: recentRepData }, { data: flagData }, { data: officialData }, { data: facilityData }] = await Promise.all([
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
      supabase
        .from('official_facility_responses')
        .select('id, submitted_name_ja, submitted_address_ja, category, policy, conditions, guidance_text, official_url, wants_listed, created_at')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: true }),
      supabase.from('facilities').select('id, name_ja, address_ja'),
    ]);
    setRequests(reqData ?? []);
    const merged = [...(flaggedRepData ?? []), ...(recentRepData ?? [])] as unknown as ReportRow[];
    setReports(merged);
    const counts: Record<string, number> = {};
    for (const row of flagData ?? []) {
      counts[row.report_id] = (counts[row.report_id] ?? 0) + 1;
    }
    setFlagCounts(counts);
    setOfficialResponses(officialData ?? []);
    setFacilityOptions(facilityData ?? []);
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

  const handleApproveOfficialResponse = async (resp: OfficialResponseRow) => {
    const facilityId = selectedFacilityId[resp.id];
    if (!facilityId) return;
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase
      .from('official_facility_responses')
      .update({ facility_id: facilityId, review_status: 'approved', reviewed_at: reviewedAt })
      .eq('id', resp.id);
    if (error) return;
    await supabase
      .from('facilities')
      .update({
        official_tattoo_policy: resp.policy,
        official_conditions: resp.conditions,
        official_guidance_text: resp.guidance_text,
        official_response_verified_at: reviewedAt,
      })
      .eq('id', facilityId);
    setOfficialResponses((prev) => prev.filter((r) => r.id !== resp.id));
  };

  const handleRejectOfficialResponse = async (id: string) => {
    await supabase
      .from('official_facility_responses')
      .update({ review_status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    setOfficialResponses((prev) => prev.filter((r) => r.id !== id));
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

      {/* 施設からの公式回答（アンケート）審査 */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
        {t('admin.officialResponses')} ({officialResponses.length})
      </h2>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
        {t('admin.officialResponsesHint')}
      </p>
      {officialResponses.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>{t('admin.noPendingOfficialResponses')}</p>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          {officialResponses.map((resp) => {
            const query = facilityMatchQuery[resp.id] ?? '';
            const matches = query.trim() === ''
              ? []
              : facilityOptions.filter((f) => f.name_ja.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
            const selectedId = selectedFacilityId[resp.id];
            const selectedFacility = facilityOptions.find((f) => f.id === selectedId);
            return (
              <div key={resp.id} style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    {!resp.wants_listed && (
                      <span
                        style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                          backgroundColor: '#fee2e2', color: '#991b1b', marginRight: '8px',
                        }}
                      >
                        {t('admin.wantsDelistBadge')}
                      </span>
                    )}
                    <strong style={{ fontSize: '14px' }}>{resp.submitted_name_ja}</strong>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{resp.created_at.slice(0, 10)}</span>
                </div>
                <p style={{ margin: '8px 0 4px', fontSize: '13px', color: '#374151' }}>
                  {t('admin.address')}: {resp.submitted_address_ja}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#374151' }}>
                  {t('admin.category')}: {t(`facility.categories.${resp.category}`)}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#1e3a8a' }}>
                  {t(`facility.officialResponse.policy.${resp.policy}`)}
                </p>
                {resp.conditions.length > 0 && (
                  <ul style={{ margin: '0 0 4px', paddingLeft: '20px', fontSize: '13px', color: '#374151' }}>
                    {resp.conditions.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                )}
                {resp.guidance_text && (
                  <p style={{ margin: '4px 0', fontSize: '13px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                    {resp.guidance_text}
                  </p>
                )}
                {resp.official_url && (
                  <p style={{ margin: '0 0 4px', fontSize: '13px' }}>
                    {t('admin.officialUrl')}: <a href={resp.official_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>{resp.official_url}</a>
                  </p>
                )}

                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e5e7eb' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                    {t('admin.linkToFacility')}
                  </p>
                  {selectedFacility ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '13px', padding: '4px 10px', borderRadius: '6px',
                          backgroundColor: '#e0e7ff', color: '#3730a3',
                        }}
                      >
                        {selectedFacility.name_ja}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFacilityId((prev) => { const next = { ...prev }; delete next[resp.id]; return next; })}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setFacilityMatchQuery((prev) => ({ ...prev, [resp.id]: e.target.value }))}
                        placeholder={t('admin.searchFacilityPlaceholder')}
                        style={{ ...searchInputStyle, marginBottom: matches.length > 0 ? '4px' : '10px' }}
                      />
                      {matches.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '10px' }}>
                          {matches.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setSelectedFacilityId((prev) => ({ ...prev, [resp.id]: f.id }))}
                              style={{
                                textAlign: 'left', padding: '6px 10px', fontSize: '13px',
                                border: '1px solid #e5e7eb', borderRadius: '6px',
                                backgroundColor: '#fff', cursor: 'pointer',
                              }}
                            >
                              {f.name_ja} <span style={{ color: '#9ca3af', fontSize: '12px' }}>{f.address_ja}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => { void handleApproveOfficialResponse(resp); }}
                      disabled={!selectedFacility}
                      style={{ ...buttonStyle(selectedFacility ? '#16a34a' : '#9ca3af'), cursor: selectedFacility ? 'pointer' : 'not-allowed' }}
                    >
                      {t('admin.approveAndReflect')}
                    </button>
                    <button type="button" onClick={() => { void handleRejectOfficialResponse(resp.id); }} style={buttonStyle('#dc2626')}>
                      {t('admin.reject')}
                    </button>
                    {!selectedFacility && (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('admin.noFacilitySelected')}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
