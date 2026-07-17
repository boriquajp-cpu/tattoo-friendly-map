import { supabase } from './supabase';

export type FacilityTargetLang = 'en' | 'ko';

/**
 * 施設名・住所を英語/韓国語に一括翻訳する（キャッシュ優先）。
 * エラー時は空オブジェクトを返す（呼び出し側で日本語表示にフォールバックする）。
 */
export async function translateFacilities(
  facilityIds: string[],
  targetLang: FacilityTargetLang
): Promise<Record<string, { name: string; address: string }>> {
  if (facilityIds.length === 0) return {};

  try {
    const { data, error } = await supabase.functions.invoke<{
      translations?: Record<string, { name: string; address: string }>;
    }>('translate-facilities', { body: { facilityIds, targetLang } });

    if (error || !data?.translations) {
      console.error('translateFacilities failed:', error);
      return {};
    }
    return data.translations;
  } catch (err) {
    console.error('translateFacilities failed:', err);
    return {};
  }
}
