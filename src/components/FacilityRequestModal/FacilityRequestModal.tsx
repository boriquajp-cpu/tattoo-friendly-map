import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { FacilityCategory } from '../../types';

const CATEGORIES: FacilityCategory[] = ['onsen', 'gym_pool', 'outdoor'];

interface Props {
  onClose: () => void;
}

export default function FacilityRequestModal({ onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [nameJa, setNameJa] = useState('');
  const [addressJa, setAddressJa] = useState('');
  const [category, setCategory] = useState<FacilityCategory>('onsen');
  const [officialUrl, setOfficialUrl] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameJa.trim() || !addressJa.trim()) return;
    setSubmitting(true);
    setErrorMsg('');

    const { error } = await supabase.from('facility_requests').insert({
      name_ja: nameJa.trim(),
      address_ja: addressJa.trim(),
      category,
      official_url: officialUrl.trim() || null,
      message: message.trim() || null,
      user_id: user?.id ?? null,
    });

    setSubmitting(false);
    if (error) {
      setErrorMsg(t('facilityRequest.error'));
    } else {
      setSuccess(true);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '4px',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            {t('facilityRequest.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}
          >
            ×
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
            <p style={{ fontSize: '15px', color: '#374151', marginBottom: '20px' }}>
              {t('facilityRequest.success')}
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 24px',
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', marginTop: 0 }}>
              {t('facilityRequest.description')}
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>
                {t('facilityRequest.nameJa')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={nameJa}
                onChange={(e) => setNameJa(e.target.value)}
                required
                placeholder={t('facilityRequest.nameJaPlaceholder')}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>
                {t('facilityRequest.addressJa')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={addressJa}
                onChange={(e) => setAddressJa(e.target.value)}
                required
                placeholder={t('facilityRequest.addressJaPlaceholder')}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>{t('facilityRequest.category')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FacilityCategory)}
                style={{ ...inputStyle, backgroundColor: '#fff' }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`facility.categories.${cat}`)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>{t('facilityRequest.officialUrl')}</label>
              <input
                type="url"
                value={officialUrl}
                onChange={(e) => setOfficialUrl(e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>{t('facilityRequest.message')}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={t('facilityRequest.messagePlaceholder')}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {errorMsg && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !nameJa.trim() || !addressJa.trim()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: submitting || !nameJa.trim() || !addressJa.trim() ? '#c7d2fe' : '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? t('common.loading') : t('facilityRequest.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
