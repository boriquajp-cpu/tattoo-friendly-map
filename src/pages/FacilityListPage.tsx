import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FacilityCard from '../components/FacilityCard/FacilityCard';
import type { FacilityCategory, FacilityWithStats, SummaryLabel } from '../types';

const ALL_CATEGORIES: FacilityCategory[] = ['onsen', 'gym_pool', 'outdoor'];
const ALL_LABELS: SummaryLabel[] = ['high', 'conditional', 'mixed', 'low', 'no_data'];

// ダミーデータ（Supabase 接続前の表示確認用）
const DUMMY_FACILITIES: FacilityWithStats[] = [
  {
    id: '1',
    name: 'サンプル温泉 A',
    address: '台湾 台北市',
    category: 'onsen',
    latitude: 25.033,
    longitude: 121.565,
    country_code: 'TW',
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
  },
  {
    id: '2',
    name: 'サンプルジム B',
    address: '台湾 台北市',
    category: 'gym_pool',
    latitude: 25.04,
    longitude: 121.55,
    country_code: 'TW',
    created_at: '',
    updated_at: '',
    stats: {
      facility_id: '2',
      total_reports: 4,
      admitted_count: 1,
      conditional_count: 1,
      denied_count: 2,
      summary_label: 'low',
      confidence: 'medium',
      last_updated: '',
    },
  },
  {
    id: '3',
    name: 'サンプルアウトドア C',
    address: '台湾 新北市',
    category: 'outdoor',
    latitude: 25.01,
    longitude: 121.46,
    country_code: 'TW',
    created_at: '',
    updated_at: '',
    stats: null,
  },
];

export default function FacilityListPage() {
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState('');
  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(new Set());
  const [activeLabels, setActiveLabels] = useState<Set<SummaryLabel>>(new Set());

  const toggleCategory = (cat: FacilityCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleLabel = (label: SummaryLabel) => {
    setActiveLabels((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const filtered = DUMMY_FACILITIES.filter((f) => {
    const matchSearch =
      searchText === '' ||
      f.name.toLowerCase().includes(searchText.toLowerCase()) ||
      f.address.toLowerCase().includes(searchText.toLowerCase());

    const matchCategory =
      activeCategories.size === 0 || activeCategories.has(f.category);

    const matchLabel =
      activeLabels.size === 0 ||
      (f.stats ? activeLabels.has(f.stats.summary_label) : activeLabels.has('no_data'));

    return matchSearch && matchCategory && matchLabel;
  });

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px' }}>
      {/* 検索ボックス */}
      <input
        type="text"
        placeholder={t('common.search')}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />

      {/* カテゴリフィルター */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            style={{
              padding: '3px 12px',
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: activeCategories.has(cat) ? '#6366f1' : '#d1d5db',
              backgroundColor: activeCategories.has(cat) ? '#6366f1' : '#fff',
              color: activeCategories.has(cat) ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {t(`facility.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* 許可レベルフィルター */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {ALL_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => toggleLabel(label)}
            style={{
              padding: '3px 12px',
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: activeLabels.has(label) ? '#6366f1' : '#d1d5db',
              backgroundColor: activeLabels.has(label) ? '#6366f1' : '#fff',
              color: activeLabels.has(label) ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {t(`facility.summaryLabel.${label}`)}
          </button>
        ))}
      </div>

      {/* 件数 */}
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280' }}>
        {filtered.length} 件
      </p>

      {/* 施設一覧 */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>
          {t('common.noData')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}
        </div>
      )}
    </div>
  );
}
