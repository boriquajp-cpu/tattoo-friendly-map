import { useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type {
  ReportFormData,
  ReportResult,
  TattooSize,
  TattooLocation,
  FacilityResponse,
} from '../types';

const RESULTS: ReportResult[] = [
  'admitted',
  'admitted_with_sticker',
  'admitted_with_cover',
  'denied',
  'not_asked',
];

const TATTOO_SIZES: TattooSize[] = ['small', 'medium', 'large', 'multiple'];

const TATTOO_LOCATIONS: TattooLocation[] = [
  'arm',
  'leg',
  'back',
  'chest_stomach',
  'neck_face',
  'other',
];

const FACILITY_RESPONSES: FacilityResponse[] = [
  'nothing_asked',
  'verbal_check',
  'written_agreement',
  'private_bath_offered',
  'other_condition',
];

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: '#fff',
};

export default function ReportFormPage() {
  const { id: facilityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [formData, setFormData] = useState<Partial<ReportFormData>>({
    facility_id: facilityId ?? '',
    lang: 'ja',
    tattoo_locations: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleLocation = (loc: TattooLocation) => {
    setFormData((prev) => {
      const current = prev.tattoo_locations ?? [];
      return {
        ...prev,
        tattoo_locations: current.includes(loc)
          ? current.filter((l) => l !== loc)
          : [...current, loc],
      };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.result) {
      setErrorMsg('入場結果を選択してください。');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('reports').insert({
        facility_id: formData.facility_id,
        visit_date: formData.visit_date ?? new Date().toISOString().slice(0, 10),
        result: formData.result,
        tattoo_size: formData.tattoo_size ?? 'small',
        tattoo_location: formData.tattoo_locations ?? [],
        facility_response: formData.facility_response ?? 'nothing_asked',
        comment_original: formData.comment ?? null,
        comment_lang: formData.lang ?? 'ja',
        user_id: user?.id ?? null,
      });
      if (error) throw error;
      alert(t('report.submitSuccess'));
      navigate(`/facility/${facilityId}`);
    } catch (err) {
      console.error(err);
      setErrorMsg(t('report.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
      {/* 戻るボタン */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '14px', marginBottom: '12px', padding: 0 }}
      >
        ← {t('common.back')}
      </button>

      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
        {t('report.title')}
      </h1>

      {/* ⑪ 未ログイン誘導バナー */}
      {!user && (
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span>{t('report.loginPrompt')}</span>
          <Link
            to="/login"
            style={{ color: '#1d4ed8', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'underline' }}
          >
            {t('report.loginLink')}
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* 訪問日 */}
        <div>
          <label htmlFor="visitDate" style={labelStyle}>{t('report.visitDate')}</label>
          <input
            id="visitDate"
            type="date"
            style={inputStyle}
            value={formData.visit_date ?? ''}
            onChange={(e) => setFormData((p) => ({ ...p, visit_date: e.target.value }))}
          />
        </div>

        {/* 入場結果 */}
        <div>
          <label htmlFor="result" style={labelStyle}>
            {t('report.result.label')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            id="result"
            required
            style={selectStyle}
            value={formData.result ?? ''}
            onChange={(e) =>
              setFormData((p) => ({ ...p, result: e.target.value as ReportResult }))
            }
          >
            <option value="">{t('common.selectPlaceholder')}</option>
            {RESULTS.map((r) => (
              <option key={r} value={r}>
                {t(`report.result.${r}`)}
              </option>
            ))}
          </select>
        </div>

        {/* タトゥーのサイズ */}
        <div>
          <label htmlFor="tattooSize" style={labelStyle}>{t('report.tattooSize.label')}</label>
          <select
            id="tattooSize"
            style={selectStyle}
            value={formData.tattoo_size ?? ''}
            onChange={(e) =>
              setFormData((p) => ({ ...p, tattoo_size: (e.target.value || undefined) as TattooSize | undefined }))
            }
          >
            <option value="">{t('common.selectPlaceholder')}</option>
            {TATTOO_SIZES.map((s) => (
              <option key={s} value={s}>
                {t(`report.tattooSize.${s}`)}
              </option>
            ))}
          </select>
        </div>

        {/* タトゥーの位置（複数選択） */}
        <div>
          <p style={{ ...labelStyle, marginBottom: '8px' }}>{t('report.tattooLocation.label')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TATTOO_LOCATIONS.map((loc) => {
              const checked = formData.tattoo_locations?.includes(loc) ?? false;
              return (
                <label
                  key={loc}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 12px',
                    border: '1px solid',
                    borderColor: checked ? '#6366f1' : '#d1d5db',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    backgroundColor: checked ? '#e0e7ff' : '#fff',
                    color: checked ? '#3730a3' : '#374151',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLocation(loc)}
                    style={{ display: 'none' }}
                  />
                  {t(`report.tattooLocation.${loc}`)}
                </label>
              );
            })}
          </div>
        </div>

        {/* 施設の対応 */}
        <div>
          <label htmlFor="facilityResponse" style={labelStyle}>
            {t('report.facilityResponse.label')}
          </label>
          <select
            id="facilityResponse"
            style={selectStyle}
            value={formData.facility_response ?? ''}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                facility_response: (e.target.value || undefined) as FacilityResponse | undefined,
              }))
            }
          >
            <option value="">{t('common.selectPlaceholder')}</option>
            {FACILITY_RESPONSES.map((fr) => (
              <option key={fr} value={fr}>
                {t(`report.facilityResponse.${fr}`)}
              </option>
            ))}
          </select>
        </div>

        {/* コメント */}
        <div>
          <label htmlFor="comment" style={labelStyle}>{t('report.comment')}</label>
          <textarea
            id="comment"
            rows={4}
            placeholder={t('report.commentPlaceholder')}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={formData.comment ?? ''}
            onChange={(e) => setFormData((p) => ({ ...p, comment: e.target.value }))}
          />
        </div>

        {/* 写真 */}
        <div>
          <label htmlFor="photo" style={labelStyle}>{t('report.photo')}</label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            style={{ fontSize: '14px' }}
            onChange={() => {/* TODO: Supabase Storage upload */}}
          />
        </div>

        {/* エラーメッセージ */}
        {errorMsg && (
          <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        )}

        {/* 送信・キャンセル */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: submitting ? '#a5b4fc' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? t('common.submitting') : t('common.submit')}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#fff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
