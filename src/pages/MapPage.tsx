import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useTranslation } from 'react-i18next';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';
import FacilityRequestModal from '../components/FacilityRequestModal/FacilityRequestModal';
import type { FacilityCategory, FacilityWithStats, SummaryLabel } from '../types';

const SUMMARY_COLORS: Record<SummaryLabel, string> = {
  high: '#22c55e',
  conditional: '#eab308',
  mixed: '#f97316',
  low: '#ef4444',
  no_data: '#9ca3af',
};

const ALL_CATEGORIES: FacilityCategory[] = ['onsen', 'gym_pool', 'outdoor'];

const getInitialViewState = () => {
  const saved = sessionStorage.getItem('mapViewState');
  if (saved) {
    try { return JSON.parse(saved) as { longitude: number; latitude: number; zoom: number }; }
    catch { /* ignore */ }
  }
  return { longitude: 135.5, latitude: 35.0, zoom: 5 };
};

export default function MapPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const mapRef = useRef<MapRef>(null);

  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(new Set(ALL_CATEGORIES));
  const [facilities, setFacilities] = useState<FacilityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithStats | null>(null);
  const [viewState, setViewState] = useState(getInitialViewState);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [mapMoved, setMapMoved] = useState(false);
  const [areaBounds, setAreaBounds] = useState<{ n: number; s: number; e: number; w: number } | null>(null);

  useEffect(() => {
    const fetchFacilities = async () => {
      const { data, error } = await supabase.from('facilities').select('*, facility_stats(*)');
      if (error) { setLoading(false); return; }

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
        stats: f.facility_stats ? {
          facility_id: f.facility_stats.facility_id,
          total_reports: f.facility_stats.report_count_12mo,
          admitted_count: 0,
          conditional_count: 0,
          denied_count: 0,
          summary_label: f.facility_stats.summary_label as SummaryLabel,
          confidence: f.facility_stats.confidence_level ?? 'low',
          last_updated: f.facility_stats.last_updated,
        } : null,
      }));
      setFacilities(mapped);
      setLoading(false);
    };
    void fetchFacilities();
  }, [i18n.language]);

  const toggleCategory = useCallback((cat: FacilityCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const handleSearchArea = useCallback(() => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;
    setAreaBounds({ n: bounds.getNorth(), s: bounds.getSouth(), e: bounds.getEast(), w: bounds.getWest() });
    setMapMoved(false);
  }, []);

  const categoryFiltered = facilities.filter((f) => activeCategories.has(f.category));
  const filteredFacilities = areaBounds
    ? categoryFiltered.filter((f) =>
        f.latitude >= areaBounds.s && f.latitude <= areaBounds.n &&
        f.longitude >= areaBounds.w && f.longitude <= areaBounds.e)
    : categoryFiltered;

  // GeoJSON for clustering
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredFacilities.map((f) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] as [number, number] },
      properties: {
        id: f.id,
        name: f.name,
        address: f.address ?? '',
        summary_label: f.stats?.summary_label ?? 'no_data',
      },
    })),
  }), [filteredFacilities]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapClick = useCallback((event: any) => {
    const features = event.features as Array<{ layer: { id: string }; geometry: { coordinates: [number, number] }; properties: Record<string, unknown> }> | undefined;

    if (!features?.length) {
      setSelectedFacility(null);
      return;
    }

    const feature = features[0];

    if (feature.layer.id === 'clusters') {
      const [lng, lat] = feature.geometry.coordinates;
      const currentZoom = mapRef.current?.getZoom() ?? 5;
      setViewState((prev) => ({ ...prev, longitude: lng, latitude: lat, zoom: Math.min(currentZoom + 3, 16) }));
      return;
    }

    if (feature.layer.id === 'unclustered-point') {
      const fid = feature.properties.id as string;
      const found = facilities.find((f) => f.id === fid);
      if (found) {
        setSelectedFacility(found);
        setViewState((prev) => ({ ...prev, longitude: found.longitude, latitude: found.latitude, zoom: Math.max(prev.zoom, 11) }));
      }
    }
  }, [facilities]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setGeoError(t('map.geoError')); setTimeout(() => setGeoError(''), 3000); return; }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { longitude: pos.coords.longitude, latitude: pos.coords.latitude, zoom: 13 };
        setViewState(next);
        sessionStorage.setItem('mapViewState', JSON.stringify(next));
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setGeoError(t('map.geoError'));
        setTimeout(() => setGeoError(''), 3000);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* カテゴリフィルター */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            style={{
              padding: '4px 14px', borderRadius: '9999px', border: '1px solid',
              borderColor: activeCategories.has(cat) ? '#6366f1' : '#d1d5db',
              backgroundColor: activeCategories.has(cat) ? '#6366f1' : '#fff',
              color: activeCategories.has(cat) ? '#fff' : '#374151',
              cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            }}
          >
            {t(`facility.categories.${cat}`)}
          </button>
        ))}
        {loading && <span style={{ fontSize: '12px', color: '#9ca3af', alignSelf: 'center' }}>{t('common.loading')}</span>}
        {!loading && <span style={{ fontSize: '12px', color: '#6b7280', alignSelf: 'center' }}>{filteredFacilities.length}{t('map.facilityCount')}</span>}
      </div>

      {/* ジオエラートースト */}
      {geoError && (
        <div style={{
          position: 'absolute', top: '52px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1f2937', color: '#fff', padding: '8px 18px',
          borderRadius: '20px', fontSize: '13px', zIndex: 30, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {geoError}
        </div>
      )}

      {/* マップ */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => {
            setViewState(evt.viewState);
            sessionStorage.setItem('mapViewState', JSON.stringify(evt.viewState));
            setMapMoved(true);
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          interactiveLayerIds={['clusters', 'unclustered-point']}
          onClick={handleMapClick}
          cursor="auto"
        >
          <NavigationControl position="top-right" />

          <Source
            id="facilities"
            type="geojson"
            data={geojson}
            cluster={true}
            clusterMaxZoom={13}
            clusterRadius={45}
          >
            {/* クラスター円 */}
            <Layer
              id="clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': '#6366f1',
                'circle-radius': ['step', ['get', 'point_count'], 22, 10, 30, 50, 38],
                'circle-opacity': 0.9,
              }}
            />
            {/* クラスター件数 */}
            <Layer
              id="cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': '{point_count_abbreviated}',
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 13,
              }}
              paint={{ 'text-color': '#fff' }}
            />
            {/* 個別ピン */}
            <Layer
              id="unclustered-point"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': [
                  'match', ['get', 'summary_label'],
                  'high', '#22c55e',
                  'conditional', '#eab308',
                  'mixed', '#f97316',
                  'low', '#ef4444',
                  '#9ca3af',
                ],
                'circle-radius': 12,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff',
              }}
            />
            {/* 選択中ピン（ハイライト） */}
            <Layer
              id="unclustered-point-selected"
              type="circle"
              filter={selectedFacility
                ? ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], selectedFacility.id]]
                : ['boolean', false]}
              paint={{
                'circle-color': [
                  'match', ['get', 'summary_label'],
                  'high', '#22c55e',
                  'conditional', '#eab308',
                  'mixed', '#f97316',
                  'low', '#ef4444',
                  '#9ca3af',
                ],
                'circle-radius': 17,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#6366f1',
              }}
            />
          </Source>
        </Map>

        {/* このエリアを検索 / リセットボタン */}
        <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '8px' }}>
          {mapMoved && (
            <button
              type="button"
              onClick={handleSearchArea}
              style={{
                padding: '8px 16px', borderRadius: '20px',
                backgroundColor: '#fff', border: '1px solid #d1d5db',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)', color: '#374151',
              }}
            >
              🔍 {t('map.searchThisArea')}
            </button>
          )}
          {areaBounds && (
            <button
              type="button"
              onClick={() => { setAreaBounds(null); setMapMoved(false); }}
              style={{
                padding: '8px 16px', borderRadius: '20px',
                backgroundColor: '#6366f1', border: 'none',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)', color: '#fff',
              }}
            >
              ✕ {t('map.resetArea')}
            </button>
          )}
        </div>

        {/* 凡例オーバーレイ */}
        <div style={{
          position: 'absolute', bottom: '28px', left: '8px',
          backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: '8px', padding: '7px 10px',
          fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.12)', pointerEvents: 'none',
        }}>
          {(Object.entries(SUMMARY_COLORS) as [SummaryLabel, string][]).map(([label, color]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
              {t(`facility.summaryLabel.${label}`)}
            </span>
          ))}
        </div>
      </div>

      {/* ポップアップ（ボトムカード） */}
      {selectedFacility && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: '52px', left: '12px', right: '12px',
            backgroundColor: '#fff', borderRadius: '14px', padding: '14px 16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)', zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>
                {t(`facility.categories.${selectedFacility.category}`)}
              </p>
              <h3 style={{ margin: '2px 0 4px', fontSize: '16px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFacility.name}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFacility.address}
              </p>
              <span style={{
                display: 'inline-block', marginTop: '6px', padding: '2px 10px',
                borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                backgroundColor: SUMMARY_COLORS[selectedFacility.stats?.summary_label ?? 'no_data'],
                color: '#fff',
              }}>
                {t(`facility.summaryLabel.${selectedFacility.stats?.summary_label ?? 'no_data'}`)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFacility(null)}
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9ca3af', flexShrink: 0, padding: '0 0 0 8px' }}
            >
              ✕
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/facility/${selectedFacility.id}`)}
            style={{
              marginTop: '12px', width: '100%', padding: '9px',
              backgroundColor: '#6366f1', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('common.viewDetail')}
          </button>
        </div>
      )}

      {/* 現在地ボタン */}
      <button
        type="button"
        onClick={handleGeolocate}
        title={t('map.nearMe')}
        style={{
          position: 'absolute', bottom: selectedFacility ? '172px' : '16px', right: '16px',
          width: '40px', height: '40px', borderRadius: '50%',
          backgroundColor: '#fff', border: '1px solid #d1d5db', fontSize: '18px',
          cursor: geoLoading ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, transition: 'bottom 0.2s', opacity: geoLoading ? 0.6 : 1,
        }}
      >
        {geoLoading ? '⏳' : '📍'}
      </button>

      {/* 施設追加申請ボタン */}
      <button
        type="button"
        onClick={() => setShowRequestModal(true)}
        title={t('facilityRequest.title')}
        style={{
          position: 'absolute', bottom: selectedFacility ? '224px' : '68px', right: '16px',
          width: '44px', height: '44px', borderRadius: '50%',
          backgroundColor: '#6366f1', color: '#fff', border: 'none', fontSize: '22px',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, transition: 'bottom 0.2s',
        }}
      >
        ＋
      </button>

      {showRequestModal && <FacilityRequestModal onClose={() => setShowRequestModal(false)} />}
    </div>
  );
}
