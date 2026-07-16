import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  reportId: string;
  onClose: () => void;
}

const FLAG_REASONS = ['spam', 'false_info', 'inappropriate', 'privacy', 'other'] as const;
type FlagReason = typeof FLAG_REASONS[number];

export default function ReportFlagModal({ reportId, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reason, setReason] = useState<FlagReason | ''>('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('report_flags').insert({
        report_id: reportId,
        reason,
        detail: detail.trim() || null,
        flagged_by_user_id: user?.id ?? null,
      });
      if (error) throw error;
      setDone(true);
    } catch {
      setErrorMsg(t('reportFlag.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff', borderRadius: '20px 20px 0 0',
          padding: '24px 20px 36px', width: '100%', maxWidth: '560px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{t('reportFlag.title')}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
            <p style={{ fontSize: '15px', color: '#374151', margin: '0 0 20px' }}>{t('reportFlag.success')}</p>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 28px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                {t('reportFlag.reason')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {FLAG_REASONS.map((r) => (
                  <label
                    key={r}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      border: '1px solid',
                      borderColor: reason === r ? '#6366f1' : '#e5e7eb',
                      backgroundColor: reason === r ? '#eef2ff' : '#fff',
                    }}
                  >
                    <input
                      type="radio"
                      name="flagReason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      style={{ accentColor: '#6366f1' }}
                    />
                    <span style={{ fontSize: '14px', color: reason === r ? '#3730a3' : '#374151', fontWeight: reason === r ? 600 : 400 }}>
                      {t(`reportFlag.reasons.${r}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                {t('reportFlag.detail')}
              </label>
              <textarea
                rows={3}
                placeholder={t('reportFlag.detailPlaceholder')}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {errorMsg && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>
            )}

            <button
              type="button"
              disabled={!reason || submitting}
              onClick={() => { void handleSubmit(); }}
              style={{
                width: '100%', padding: '12px',
                backgroundColor: !reason || submitting ? '#a5b4fc' : '#6366f1',
                color: '#fff', border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: 700,
                cursor: !reason || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? t('auth.processing') : t('reportFlag.submit')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
