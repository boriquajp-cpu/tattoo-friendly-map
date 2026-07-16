import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import FacilityCard from '../components/FacilityCard/FacilityCard';
import HeartIcon from '../components/HeartIcon/HeartIcon';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import type { FacilityCategory, FacilityWithStats, SummaryLabel } from '../types';

const ALL_CATEGORIES: FacilityCategory[] = ['onsen', 'gym_pool', 'outdoor'];
const ALL_LABELS: SummaryLabel[] = ['high', 'conditional', 'mixed', 'low', 'no_data'];

const getPrefecture = (address: string): string => {
  const match = address.match(/^(.{2,4}[都道府県])/);
  return match ? match[1] : '';
};

const REGION_ORDER = [
  'hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu_okinawa', 'other',
] as const;
type RegionKey = typeof REGION_ORDER[number];

const PREFECTURE_TO_REGION: Record<string, RegionKey> = {
  '北海道': 'hokkaido',
  '青森県': 'tohoku', '岩手県': 'tohoku', '宮城県': 'tohoku', '秋田県': 'tohoku', '山形県': 'tohoku', '福島県': 'tohoku',
  '茨城県': 'kanto', '栃木県': 'kanto', '群馬県': 'kanto', '埼玉県': 'kanto', '千葉県': 'kanto', '東京都': 'kanto', '神奈川県': 'kanto',
  '新潟県': 'chubu', '富山県': 'chubu', '石川県': 'chubu', '福井県': 'chubu', '山梨県': 'chubu', '長野県': 'chubu', '岐阜県': 'chubu', '静岡県': 'chubu', '愛知県': 'chubu',
  '三重県': 'kinki', '滋賀県': 'kinki', '京都府': 'kinki', '大阪府': 'kinki', '兵庫県': 'kinki', '奈良県': 'kinki', '和歌山県': 'kinki',
  '鳥取県': 'chugoku', '島根県': 'chugoku', '岡山県': 'chugoku', '広島県': 'chugoku', '山口県': 'chugoku',
  '徳島県': 'shikoku', '香川県': 'shikoku', '愛媛県': 'shikoku', '高知県': 'shikoku',
  '福岡県': 'kyushu_okinawa', '佐賀県': 'kyushu_okinawa', '長崎県': 'kyushu_okinawa', '熊本県': 'kyushu_okinawa', '大分県': 'kyushu_okinawa', '宮崎県': 'kyushu_okinawa', '鹿児島県': 'kyushu_okinawa', '沖縄県': 'kyushu_okinawa',
};

const getRegion = (prefecture: string): RegionKey => PREFECTURE_TO_REGION[prefecture] ?? 'other';

export default function FacilityListPage() {
  const { t, i18n } = useTranslation();

  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorites();
  const { items: recentItems } = useRecentlyViewed();
  const [facilities, setFacilities] = useState<FacilityWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState(() => sessionStorage.getItem('list_search') ?? '');
  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('list_categories') ?? '[]') as FacilityCategory[]); }
    catch { return new Set(); }
  });
  const [activeLabels, setActiveLabels] = useState<Set<SummaryLabel>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('list_labels') ?? '[]') as SummaryLabel[]); }
    catch { return new Set(); }
  });
  const [activePrefecture, setActivePrefecture] = useState(() => sessionStorage.getItem('list_prefecture') ?? '');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // フィルター状態をsessionStorageに保持
  useEffect(() => { sessionStorage.setItem('list_search', searchText); }, [searchText]);
  useEffect(() => { sessionStorage.setItem('list_categories', JSON.stringify([...activeCategories])); }, [activeCategories]);
  useEffect(() => { sessionStorage.setItem('list_labels', JSON.stringify([...activeLabels])); }, [activeLabels]);
  useEffect(() => { sessionStorage.setItem('list_prefecture', activePrefecture); }, [activePrefecture]);

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
        address_ja: f.address_ja,
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

  // 都道府県リスト（address_jaから抽出・重複除去）
  const prefectures = useMemo(() => {
    const set = new Set<string>();
    facilities.forEach((f) => {
      const pref = getPrefecture(f.address_ja ?? f.address);
      if (pref) set.add(pref);
    });
    return Array.from(set).sort();
  }, [facilities]);

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortByDistance(true);
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  };

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

    const matchPrefecture =
      activePrefecture === '' ||
      getPrefecture(f.address_ja ?? f.address) === activePrefecture;

    const matchFavorite = !favoritesOnly || isFavorite(f.id);

    return matchSearch && matchCategory && matchLabel && matchPrefecture && matchFavorite;
  }).sort((a, b) => {
    if (!sortByDistance || !userLocation) return 0;
    return haversine(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
         - haversine(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
  });

  // 地域別グルーピング（近い順ソート時は使わずフラット表示にする）
  const groupedByRegion = useMemo(() => {
    const map = new Map<RegionKey, FacilityWithStats[]>();
    for (const f of filtered) {
      const region = getRegion(getPrefecture(f.address_ja ?? f.address));
      if (!map.has(region)) map.set(region, []);
      map.get(region)!.push(f);
    }
    return map;
  }, [filtered]);

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 12px',
    borderRadius: '9999px',
    border: '1px solid',
    borderColor: active ? '#6366f1' : '#d1d5db',
    backgroundColor: active ? '#6366f1' : '#fff',
    color: active ? '#fff' : '#374151',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px' }}>

      {/* 最近見た施設 */}
      {recentItems.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('facilityList.recentlyViewed')}
          </p>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {recentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/facility/${item.id}`)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  whiteSpace: 'nowrap',
                  maxWidth: '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'left',
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 検索ボックス */}
      <input
        type="text"
        placeholder={t('facilityList.searchPlaceholder')}
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

      {/* ⑧ 都道府県フィルター */}
      {prefectures.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', marginBottom: '8px', paddingBottom: '4px' }}>
          <button
            type="button"
            onClick={() => setActivePrefecture('')}
            style={chipStyle(activePrefecture === '')}
          >
            {t('map.allAreas')}
          </button>
          {prefectures.map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => setActivePrefecture(activePrefecture === pref ? '' : pref)}
              style={chipStyle(activePrefecture === pref)}
            >
              {pref}
            </button>
          ))}
        </div>
      )}

      {/* カテゴリフィルター */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            style={chipStyle(activeCategories.has(cat))}
          >
            {t(`facility.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* 許可レベルフィルター */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {ALL_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => toggleLabel(label)}
            style={chipStyle(activeLabels.has(label))}
          >
            {t(`facility.summaryLabel.${label}`)}
          </button>
        ))}
      </div>

      {/* お気に入り・近い順フィルター */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          style={{
            ...chipStyle(favoritesOnly),
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderColor: favoritesOnly ? '#ef4444' : '#d1d5db',
            backgroundColor: favoritesOnly ? '#ef4444' : '#fff',
          }}
        >
          <HeartIcon filled={favoritesOnly} color={favoritesOnly ? '#fff' : '#374151'} size={14} />
          {t('common.favoriteOnly')}
        </button>
        <button
          type="button"
          onClick={sortByDistance ? () => { setSortByDistance(false); setUserLocation(null); } : handleNearMe}
          disabled={geoLoading}
          style={{
            ...chipStyle(sortByDistance),
            borderColor: sortByDistance ? '#f97316' : '#d1d5db',
            backgroundColor: sortByDistance ? '#f97316' : '#fff',
            opacity: geoLoading ? 0.6 : 1,
          }}
        >
          📍 {geoLoading ? t('common.loading') : t('facilityList.nearMe')}
        </button>
      </div>

      {/* 件数 */}
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280' }}>
        {loading ? t('common.loading') : `${filtered.length} ${t('map.facilityCount')}`}
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
      ) : sortByDistance ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              isFavorite={isFavorite(facility.id)}
              onToggleFavorite={toggle}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {REGION_ORDER.filter((region) => groupedByRegion.has(region)).map((region) => (
            <div key={region}>
              <h2
                style={{
                  fontSize: '15px', fontWeight: 700, color: '#374151',
                  margin: '0 0 10px', paddingBottom: '4px',
                  borderBottom: '2px solid #e5e7eb',
                }}
              >
                {t(`facilityList.regions.${region}`)}
                <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: '#9ca3af' }}>
                  ({groupedByRegion.get(region)!.length})
                </span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groupedByRegion.get(region)!.map((facility) => (
                  <FacilityCard
                    key={facility.id}
                    facility={facility}
                    isFavorite={isFavorite(facility.id)}
                    onToggleFavorite={toggle}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
