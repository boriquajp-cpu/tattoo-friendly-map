import { useState, useCallback, useEffect } from 'react';
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

  // ログイン中はアカウントに紐づく favorites テーブルと同期する（端末をまたいで共有される）。
  // 未ログイン時は従来通り localStorage のみで管理する。
  useEffect(() => {
    if (!user) {
      setFavorites(new Set(getStored()));
      return;
    }
    void supabase
      .from('favorites')
      .select('facility_id')
      .eq('user_id', user.id)
      .then(({ data }) => setFavorites(new Set((data ?? []).map((row) => row.facility_id))));
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
