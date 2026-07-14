import { useTranslation } from 'react-i18next';

interface Props {
  onConfirm: () => void;
}

export default function DisclaimerModal({ onConfirm }: Props) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '28px 24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '16px', fontSize: '32px' }}>🗺️</div>
        <h2 style={{ margin: '0 0 14px', fontSize: '19px', fontWeight: 700, textAlign: 'center' }}>
          {t('disclaimer.title')}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#4b5563', lineHeight: 1.75 }}>
          {t('disclaimer.body')}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: '100%',
            padding: '13px',
            backgroundColor: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('disclaimer.confirm')}
        </button>
      </div>
    </div>
  );
}
