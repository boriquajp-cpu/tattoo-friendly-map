import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AffiliateParams } from '../lib/bookingLinks';

const KEYS = {
  affiliate_param_kkday: 'kkday',
  affiliate_param_klook: 'klook',
  affiliate_param_agoda: 'agoda',
  affiliate_param_tripcom: 'tripcom',
} as const satisfies Record<string, keyof AffiliateParams>;

let cache: AffiliateParams | null = null;

/**
 * 宿泊予約リンクのアフィリエイトパラメータを Supabase の app_settings から取得する。
 * 各社の提携審査が通るまでは全て null が返り、通常のリンクとして機能する。
 * 一度取得した値はモジュール内でキャッシュし、以後の呼び出しは再フェッチしない。
 */
export function useAffiliateSettings(): AffiliateParams {
  const [affiliate, setAffiliate] = useState<AffiliateParams>(cache ?? {});

  useEffect(() => {
    if (cache) return;

    void (async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', Object.keys(KEYS));

      if (error || !data) return;

      const result: AffiliateParams = {};
      for (const row of data) {
        const field = KEYS[row.key as keyof typeof KEYS];
        if (field) result[field] = row.value;
      }
      cache = result;
      setAffiliate(result);
    })();
  }, []);

  return affiliate;
}
