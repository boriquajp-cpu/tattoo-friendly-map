import { useState, useCallback } from 'react';

const KEY = 'tattoo_recently_viewed';
const MAX = 8;

export interface RecentItem {
  id: string;
  name: string;
  category: string;
  summary_label: string;
}

const getStored = (): RecentItem[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentItem[]; }
  catch { return []; }
};

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(getStored);

  const addItem = useCallback((item: RecentItem) => {
    setItems((prev) => {
      const next = [item, ...prev.filter((i) => i.id !== item.id)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { items, addItem };
}
