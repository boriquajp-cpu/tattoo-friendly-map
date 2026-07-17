import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Report, ReportResult } from '../types';

const RESULT_COLORS: Record<ReportResult, { bg: string; color: string }> = {
  admitted:              { bg: '#dcfce7', color: '#166534' },
  admitted_with_sticker: { bg: '#d1fae5', color: '#065f46' },
  admitted_with_cover:   { bg: '#fef9c3', color: '#854d0e' },
  denied:                { bg: '#fee2e2', color: '#991b1b' },
  not_asked:             { bg: '#f3f4f6', color: '#374151' },
};

interface ReportWithFacility extends Report {
  facilityName: string;
  facilityId: string;
}

interface EditState {
  result: ReportResult;
  visit_date: string;
  comment: string;
}

export default function MyReportsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [reports, setReports] = useState<ReportWithFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ result: 'admitted', visit_date: '', comment: '' });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    void fetchMyReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchMyReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*, facilities(id, name_ja)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setReports(
      (data ?? []).map((r) => ({
        id: r.id,
        facility_id: r.facility_id,
        user_id: r.user_id,
        result: r.result as ReportResult,
        tattoo_size: r.tattoo_size,
        tattoo_locations: r.tattoo_location ?? [],
        facility_response: r.facility_response,
        visit_date: r.visit_date,
        comment: r.comment_original,
        lang: r.comment_lang ?? 'ja',
        helpful_count: 0,
        created_at: r.created_at,
        facilityName: (r.facilities as { name_ja: string } | null)?.name_ja ?? t('mypage.unknownFacility'),
        facilityId: r.facility_id,
      }))
    );
    setLoading(false);
  };

  const startEdit = (report: ReportWithFacility) => {
    setEditingId(report.id);
    setEditState({
      result: report.result,
      visit_date: report.visit_date ?? '',
      comment: report.comment ?? '',
    });
    setStatusMsg('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setStatusMsg('');
  };

  const saveEdit = async (reportId: string) => {
    setSaving(true);
    setStatusMsg('');
    const updatePayload: Record<string, unknown> = {
      result: editState.result,
      comment_original: editState.comment || null,
    };
    if (editState.visit_date) updatePayload.visit_date = editState.visit_date;

    const { error } = await supabase
      .from('reports')
      .update(updatePayload)
      .eq('id', reportId)
      .eq('user_id', user!.id);

    if (error) {
      setStatusMsg(t('mypage.editError'));
    } else {
      setStatusMsg(t('mypage.editSuccess'));
      setEditingId(null);
      void fetchMyReports();
    }
    setSaving(false);
  };

  const deleteReport = async (reportId: string) => {
    if (!window.confirm(t('mypage.deleteConfirm'))) return;
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId)
      .eq('user_id', user!.id);

    if (error) {
      setStatusMsg(t('mypage.deleteError'));
    } else {
      setStatusMsg(t('mypage.deleteSuccess'));
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    }
  };

  if (authLoading || loading) {
    return <p style={{ padding: '32px', textAlign: 'center' }}>{t('common.loading')}</p>;
  }

  const RESULTS: ReportResult[] = [
    'admitted', 'admitted_with_sticker', 'admitted_with_cover', 'denied', 'not_asked',
  ];

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px 16px 40px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{t('mypage.title')}</h1>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>{user?.email}</p>

      {statusMsg && (
        <p style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', fontSize: '14px', marginBottom: '16px' }}>
          {statusMsg}
        </p>
      )}

      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>{t('mypage.myReports')}（{reports.length}件）</h2>

      {reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280' }}>
          <p style={{ marginBottom: '16px' }}>{t('mypage.noReports')}</p>
          <Link to="/" style={{ color: '#6366f1', fontSize: '14px' }}>
            {t('mypage.exploreFacilities')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reports.map((report) => {
            const { bg, color } = RESULT_COLORS[report.result];
            const isEditing = editingId === report.id;

            return (
              <div
                key={report.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  backgroundColor: '#fff',
                }}
              >
                {/* 施設名リンク */}
                <Link
                  to={`/facility/${report.facilityId}`}
                  style={{ fontSize: '15px', fontWeight: 600, color: '#111827', textDecoration: 'none' }}
                >
                  {report.facilityName}
                </Link>

                {isEditing ? (
                  /* 編集フォーム */
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                        {t('report.result.label')}
                      </label>
                      <select
                        value={editState.result}
                        onChange={(e) => setEditState((p) => ({ ...p, result: e.target.value as ReportResult }))}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                      >
                        {RESULTS.map((r) => (
                          <option key={r} value={r}>{t(`report.result.${r}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                        {t('report.visitDate')}
                      </label>
                      <input
                        type="date"
                        value={editState.visit_date}
                        onChange={(e) => setEditState((p) => ({ ...p, visit_date: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                        {t('report.comment')}
                      </label>
                      <textarea
                        rows={3}
                        value={editState.comment}
                        onChange={(e) => setEditState((p) => ({ ...p, comment: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveEdit(report.id)}
                        style={{ padding: '7px 18px', backgroundColor: saving ? '#a5b4fc' : '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                      >
                        {saving ? t('common.submitting') : t('mypage.save')}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{ padding: '7px 18px', backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 表示モード */
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '12px', fontWeight: 600, padding: '2px 8px',
                          borderRadius: '4px', backgroundColor: bg, color,
                        }}
                      >
                        {t(`report.result.${report.result}`)}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {report.visit_date ?? report.created_at.slice(0, 10)}
                      </span>
                    </div>

                    {report.comment && (
                      <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#374151' }}>{report.comment}</p>
                    )}

                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => startEdit(report)}
                        style={{ padding: '5px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {t('mypage.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteReport(report.id)}
                        style={{ padding: '5px 14px', backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {t('mypage.delete')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
