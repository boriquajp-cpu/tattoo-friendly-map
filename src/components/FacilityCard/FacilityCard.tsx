import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HeartIcon from '../HeartIcon/HeartIcon';
import type { FacilityWithStats, SummaryLabel, ConfidenceLevel } from '../../types';

interface FacilityCardProps {
  facility: FacilityWithStats;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

const SUMMARY_BADGE_STYLE: Record<SummaryLabel, { bg: string; color: string }> = {
  high:        { bg: '#dcfce7', color: '#166534' },
  conditional: { bg: '#fef9c3', color: '#854d0e' },
  mixed:       { bg: '#ffedd5', color: '#9a3412' },
  low:         { bg: '#fee2e2', color: '#991b1b' },
  no_data:     { bg: '#f3f4f6', color: '#374151' },
};

const CONFIDENCE_DOT: Record<ConfidenceLevel, string> = {
  high:   '#22c55e',
  medium: '#eab308',
  low:    '#9ca3af',
};

export default function FacilityCard({ facility, isFavorite = false, onToggleFavorite }: FacilityCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stats = facility.stats;
  const summaryLabel: SummaryLabel = stats?.summary_label ?? 'no_data';
  const confidence: ConfidenceLevel | undefined = stats?.confidence;
  const { bg, color } = SUMMARY_BADGE_STYLE[summaryLabel];

  return (
    <div
      onClick={() => navigate(`/facility/${facility.id}`)}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        backgroundColor: '#fff',
        transition: 'box-shadow 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* ハートボタン */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(facility.id); }}
          title={t('common.favorite')}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '2px',
            display: 'flex',
            transition: 'color 0.15s',
          }}
        >
          <HeartIcon filled={isFavorite} color={isFavorite ? '#ef4444' : '#9ca3af'} size={20} />
        </button>
      )}

      {/* ヘッダー行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', paddingRight: onToggleFavorite ? '28px' : '0' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t(`facility.categories.${facility.category}`)}
          </p>
          <h3 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {facility.name}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>{facility.address}</p>
        </div>
        <span
          style={{
            flexShrink: 0,
            padding: '2px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: bg,
            color,
          }}
        >
          {t(`facility.summaryLabel.${summaryLabel}`)}
        </span>
      </div>

      {/* フッター行 */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
        <span>
          {stats ? t('facility.reportCount', { count: stats.total_reports }) : t('facility.noReports')}
        </span>
        {confidence && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: CONFIDENCE_DOT[confidence], display: 'inline-block' }} />
            {t(`facility.confidence.${confidence}`)}
          </span>
        )}
      </div>
    </div>
  );
}
