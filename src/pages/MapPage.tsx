import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import { useTranslation } from 'react-i18next';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { FacilityCategory, FacilityWithStats, SummaryLabel } from '../types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// 許可レベルごとのピン色
const SUMMARY_COLORS: Record<SummaryLabel, string> = {
  high: '#22c55e',        // 緑
  conditional: '#eab308', // 黄
  mixed: '#f97316',       // 橙
  low: '#ef4444',         // 赤
  no_data: '#9ca3af',     // 灰
};

const ALL_CATEGORIES: FacilityCategory[] = ['onsen', 'gym_pool', 'outdoor'];

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
];

export default function MapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [facilities] = useState<FacilityWithStats[]>(DUMMY_FACILITIES);

  const toggleCategory = useCallback((cat: FacilityCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const filteredFacilities = facilities.filter((f) => activeCategories.has(f.category));

  const getPinColor = (facility: FacilityWithStats): string => {
    const label: SummaryLabel = facility.stats?.summary_label ?? 'no_data';
    return SUMMARY_COLORS[label];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* カテゴリフィルター */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap',
        }}
      >
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
      </div>

      {/* マップ */}
      <div style={{ flex: 1 }}>
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            longitude: 121.5654,
            latitude: 25.033,
            zoom: 11,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
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
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '6px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e7eb',
          flexWrap: 'wrap',
          fontSize: '12px',
        }}
      >
        {(Object.entries(SUMMARY_COLORS) as [SummaryLabel, string][]).map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: color,
                display: 'inline-block',
              }}
            />
            {t(`facility.summaryLabel.${label}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
