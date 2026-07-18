import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'tattoo_favorites';

const getStored = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(getStored()));
  // 直近にリクエストしたユーザーIDを保持し、アカウント切り替えが速い場合に
  // 古いレスポンスで新しい状態を上書きしてしまわないようにする
  const latestUserId = useRef<string | null>(null);

  // ログイン中はアカウントに紐づく favorites テーブルと同期する（端末をまたいで共有される）。
  // 未ログイン時は従来通り localStorage のみで管理する。
  // 初回ログイン時は、ゲスト時に localStorage に貯めていたお気に入りをアカウントへ
  // マージする（そのまま上書きすると、ログイン前のお気に入りが消えてしまうため）。
  useEffect(() => {
    const userId = user?.id ?? null;
    latestUserId.current = userId;

    if (!userId) {
      setFavorites(new Set(getStored()));
      return;
    }

    void (async () => {
      const localIds = getStored();
      if (localIds.length > 0) {
        await supabase
          .from('favorites')
          .upsert(
            localIds.map((facilityId) => ({ user_id: userId, facility_id: facilityId })),
            { onConflict: 'user_id,facility_id', ignoreDuplicates: true }
          );
      }

      const { data } = await supabase.from('favorites').select('facility_id').eq('user_id', userId);

      // この間に別アカウントへ切り替わっていたら、古い結果は反映しない
      if (latestUserId.current !== userId) return;

      setFavorites(new Set((data ?? []).map((row) => row.facility_id)));
      localStorage.removeItem(STORAGE_KEY);
    })();
  }, [user]);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const wasFavorite = next.has(id);
      if (wasFavorite) next.delete(id);
      else next.add(id);

      if (user) {
        if (wasFavorite) {
          void supabase.from('favorites').delete().eq('user_id', user.id).eq('facility_id', id);
        } else {
          void supabase.from('favorites').insert({ user_id: user.id, facility_id: id });
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }, [user]);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { favorites, isFavorite, toggle };
}
