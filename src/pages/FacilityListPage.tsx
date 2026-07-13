import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import FacilityCard from '../components/FacilityCard/FacilityCard';
import type { FacilityCategory, FacilityWithStats, SummaryLabel } from '../types';

const ALL_CATEGORIES: FacilityCategory[] = ['onsen', 'gym_pool', 'outdoor'];
const ALL_LABELS: SummaryLabel[] = ['high', 'conditional', 'mixed', 'low', 'no_data'];

export default function FacilityListPage() {
  const { t, i18n } = useTranslation();

  const [facilities, setFacilities] = useState<FacilityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(new Set());
  const [activeLabels, setActiveLabels] = useState<Set<SummaryLabel>>(new Set());

  useEffect(() => {
    const fetchFacilities = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('facilities')
        .select('*, facility_stats(*)')
        .order('name_ja', { ascending: true });

      if (error) {
        console.error('施設データ取得エラー:', error);
        setLoading(false);
        return;
      }

      const lang = i18n.language === 'zh-TW' ? 'zh_tw' : 'ja';
      const mapped: FacilityWithStats[] = (data ?? []).map((f) => ({
        id: f.id,
        name: lang === 'zh_tw' ? (f.name_zh_tw ?? f.name_ja) : f.name_ja,
        address: lang === 'zh_tw' ? (f.address_zh_tw ?? f.address_ja) : f.address_ja,
        category: f.category as FacilityCategory,
        latitude: f.lat,
        longitude: f.lng,
        website_url: f.official_url ?? undefined,
        phone: f.phone ?? undefined,
        country_code: 'JP',
        created_at: f.created_at,
        updated_at: f.updated_at,
        stats: f.facility_stats
          ? {
              facility_id: f.facility_stats.facility_id,
              total_reports: f.facility_stats.report_count_12mo,
              admitted_count: 0,
              conditional_count: 0,
              denied_count: 0,
              summary_label: f.facility_stats.summary_label as SummaryLabel,
              confidence: f.facility_stats.confidence_level ?? 'low',
              last_updated: f.facility_stats.last_updated,
            }
          : null,
      }));

      setFacilities(mapped);
      setLoading(false);
    };

    void fetchFacilities();
  }, [i18n.language]);

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

  const filtered = facilities.filter((f) => {
    const q = searchText.toLowerCase();
    const matchSearch =
      q === '' ||
      f.name.toLowerCase().includes(q) ||
      f.address.toLowerCase().includes(q);

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
        {loading ? t('common.loading') : `${filtered.length} 件`}
      </p>

      {/* 施設一覧 */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>
          {t('common.loading')}
        </p>
      ) : filtered.length === 0 ? (
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
