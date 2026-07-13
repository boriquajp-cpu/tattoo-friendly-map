import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import { useTranslation } from 'react-i18next';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';
import type { FacilityCategory, FacilityWithStats, SummaryLabel } from '../types';

const SUMMARY_COLORS: Record<SummaryLabel, string> = {
  high: '#22c55e',
  conditional: '#eab308',
  mixed: '#f97316',
  low: '#ef4444',
  no_data: '#9ca3af',
};

const ALL_CATEGORIES: FacilityCategory[] = ['onsen', 'gym_pool', 'outdoor'];

export default function MapPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [facilities, setFacilities] = useState<FacilityWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFacilities = async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('*, facility_stats(*)');

      if (error) {
        console.error('施設データ取得エラー:', error);
        setLoading(false);
        return;
      }

      // DBフィールド → TypeScript型にマッピング
      const lang = i18n.language === 'zh-TW' ? 'zh_tw' : 'ja';
      const mapped: FacilityWithStats[] = (data ?? []).map((f) => ({
        id: f.id,
        name: lang === 'zh_tw' ? f.name_zh_tw : f.name_ja,
        address: lang === 'zh_tw' ? f.address_zh_tw : f.address_ja,
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

  const toggleCategory = useCallback((cat: FacilityCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const filteredFacilities = facilities.filter((f) => activeCategories.has(f.category));

  const getPinColor = (facility: FacilityWithStats): string =>
    SUMMARY_COLORS[facility.stats?.summary_label ?? 'no_data'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* カテゴリフィルター */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            style={{
              padding: '4px 14px',
              borderRadius: '9999px',
              border: '1px solid',
              borderColor: activeCategories.has(cat) ? '#6366f1' : '#d1d5db',
              backgroundColor: activeCategories.has(cat) ? '#6366f1' : '#fff',
              color: activeCategories.has(cat) ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {t(`facility.categories.${cat}`)}
          </button>
        ))}
        {loading && <span style={{ fontSize: '12px', color: '#9ca3af', alignSelf: 'center' }}>読み込み中...</span>}
        {!loading && <span style={{ fontSize: '12px', color: '#6b7280', alignSelf: 'center' }}>{filteredFacilities.length}件</span>}
      </div>

      {/* マップ */}
      <div style={{ flex: 1 }}>
        <Map
          initialViewState={{ longitude: 135.5, latitude: 35.0, zoom: 5 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
        >
          <NavigationControl position="top-right" />
          {filteredFacilities.map((facility) => (
            <Marker
              key={facility.id}
              longitude={facility.longitude}
              latitude={facility.latitude}
              anchor="bottom"
              onClick={() => navigate(`/facility/${facility.id}`)}
            >
              <div
                title={facility.name}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: getPinColor(facility),
                  border: '2px solid #fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                }}
              />
            </Marker>
          ))}
        </Map>
      </div>

      {/* 凡例 */}
      <div style={{ display: 'flex', gap: '12px', padding: '6px 16px', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap', fontSize: '12px' }}>
        {(Object.entries(SUMMARY_COLORS) as [SummaryLabel, string][]).map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
            {t(`facility.summaryLabel.${label}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
