import type { FacilityWithStats } from '../types';

const STORAGE_KEY = 'tattoo_facilities_cache';

interface FacilitiesCache {
  data: FacilityWithStats[];
  savedAt: number;
}

/** 施設一覧の取得に成功した際に、オフライン時のフォールバック用に保存する */
export function saveFacilitiesCache(facilities: FacilityWithStats[]): void {
  try {
    const cache: FacilitiesCache = { data: facilities, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // 保存容量オーバー等は無視する（オフライン対応はベストエフォート）
  }
}

/** 施設一覧の取得に失敗した際、直近に保存されたキャッシュを返す（無ければnull） */
export function loadFacilitiesCache(): FacilitiesCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FacilitiesCache;
  } catch {
    return null;
  }
}
