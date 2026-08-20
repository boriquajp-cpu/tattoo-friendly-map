import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface BlockedUserRow {
  blocked_user_id: string;
  created_at: string;
}

/**
 * ログインユーザーがブロックした投稿者のIDを管理する。
 * favoritesと異なり、ブロックはアカウントに紐づく必要がある機能のため、
 * 未ログイン時は常に空集合（localStorageフォールバックは持たない）。
 */
export function useBlockedUsers() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<BlockedUserRow[]>([]);
  const latestUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    latestUserId.current = userId;

    if (!userId) {
      setBlockedUsers(new Set());
      setRows([]);
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from('blocked_users')
        .select('blocked_user_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (latestUserId.current !== userId) return;

      setRows((data ?? []) as BlockedUserRow[]);
      setBlockedUsers(new Set((data ?? []).map((row) => row.blocked_user_id)));
    })();
  }, [user]);

  const toggle = useCallback((blockedUserId: string) => {
    if (!user) return;

    setBlockedUsers((prev) => {
      const next = new Set(prev);
      const wasBlocked = next.has(blockedUserId);
      if (wasBlocked) {
        next.delete(blockedUserId);
        void supabase.from('blocked_users').delete().eq('user_id', user.id).eq('blocked_user_id', blockedUserId);
        setRows((prevRows) => prevRows.filter((r) => r.blocked_user_id !== blockedUserId));
      } else {
        next.add(blockedUserId);
        void supabase.from('blocked_users').insert({ user_id: user.id, blocked_user_id: blockedUserId });
        setRows((prevRows) => [{ blocked_user_id: blockedUserId, created_at: new Date().toISOString() }, ...prevRows]);
      }
      return next;
    });
  }, [user]);

  const isBlocked = useCallback((id: string) => blockedUsers.has(id), [blockedUsers]);

  return { blockedUsers, rows, isBlocked, toggle };
}
